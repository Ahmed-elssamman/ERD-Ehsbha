import { Prisma } from '@prisma/client';
import { businessDate, businessDayForDate, businessHour, DigestSnapshotVersion, MoneyPiastres, NotificationKind, tripEarningsPiastres, type TripFinancialInput } from '@ehsbha/shared-types';
import { addDays } from '../../common/utils/date';
import { DIGEST_AREA_RATIO, DIGEST_MIN_AREA_METERS, DIGEST_MIN_AREA_TRIPS, DIGEST_MIN_HOUR_TRIPS, DIGEST_TRIP_LIMIT } from './notifications.control';
import type { DigestAreaObservation, DigestAppObservation, DigestHourObservation, DigestSnapshot } from './digest.model';

interface DigestTrip extends TripFinancialInput { startedAt: Date; endedAt: Date; driverAppId: string; areaId: string | null; paidKmMeters: number }
interface EarningsBucket { amount: bigint; measure: bigint; count: number }
function money(value: bigint): number { return MoneyPiastres(Number(value)); }
function roundedRate(amount: bigint, units: bigint, divisor: bigint): number {
  if (divisor <= 0n) return 0;
  const value = amount * units;
  return money(value < 0n ? -((-value + divisor / 2n) / divisor) : (value + divisor / 2n) / divisor);
}

export function digestHourObservation(trips: DigestTrip[]): DigestHourObservation | null {
  const buckets = new Map<number, EarningsBucket>();
  for (const trip of trips) {
    const milliseconds = trip.endedAt.getTime() - trip.startedAt.getTime();
    if (milliseconds <= 0) continue;
    const hour = businessHour(trip.startedAt), current = buckets.get(hour) ?? { amount: 0n, measure: 0n, count: 0 };
    current.amount += BigInt(tripEarningsPiastres(trip)); current.measure += BigInt(milliseconds); current.count++;
    buckets.set(hour, current);
  }
  let best: DigestHourObservation | null = null;
  for (const [hour, value] of buckets) {
    if (value.count < DIGEST_MIN_HOUR_TRIPS) continue;
    const rate = roundedRate(value.amount, 3_600_000n, value.measure);
    if (!best || rate > best.earningsPerTripHourPiastres || (rate === best.earningsPerTripHourPiastres && hour < best.hour)) best = { hour, earningsPerTripHourPiastres: rate, tripCount: value.count };
  }
  return best;
}

async function highestApp(database: Prisma.TransactionClient, driverId: string, trips: DigestTrip[]): Promise<DigestAppObservation | null> {
  const buckets = new Map<string, EarningsBucket>();
  for (const trip of trips) {
    const value = buckets.get(trip.driverAppId) ?? { amount: 0n, measure: 0n, count: 0 };
    value.amount += BigInt(tripEarningsPiastres(trip)); value.count++; buckets.set(trip.driverAppId, value);
  }
  const best = [...buckets].sort((a, b) => a[1].amount === b[1].amount ? a[0].localeCompare(b[0]) : a[1].amount > b[1].amount ? -1 : 1)[0];
  if (!best) return null;
  const app = await database.driverApp.findFirst({ where: { id: best[0], driverId }, include: { appSource: { select: { name: true } } } });
  return app ? { appId: app.id, appName: app.customName ?? app.appSource.name, earningsPiastres: money(best[1].amount), tripCount: best[1].count } : null;
}

async function lowerArea(database: Prisma.TransactionClient, driverId: string, trips: DigestTrip[]): Promise<DigestAreaObservation | null> {
  const buckets = new Map<string, EarningsBucket>();
  for (const trip of trips) {
    if (!trip.areaId || trip.paidKmMeters <= 0) continue;
    const value = buckets.get(trip.areaId) ?? { amount: 0n, measure: 0n, count: 0 };
    value.amount += BigInt(tripEarningsPiastres(trip)); value.measure += BigInt(trip.paidKmMeters); value.count++; buckets.set(trip.areaId, value);
  }
  const ranked = [...buckets].filter(([, value]) => value.count >= DIGEST_MIN_AREA_TRIPS && value.measure >= BigInt(DIGEST_MIN_AREA_METERS))
    .map(([id, value]) => ({ id, rate: roundedRate(value.amount, 1000n, value.measure), count: value.count })).sort((a, b) => a.rate - b.rate || a.id.localeCompare(b.id));
  const lowest = ranked[0], median = ranked[Math.floor(ranked.length / 2)];
  if (ranked.length < 2 || !lowest || !median || median.rate <= 0 || lowest.rate >= median.rate * DIGEST_AREA_RATIO) return null;
  const area = await database.area.findFirst({ where: { id: lowest.id, driverId } });
  return area ? { areaId: area.id, areaName: area.name, earningsPerPaidKmPiastres: lowest.rate, tripCount: lowest.count } : null;
}

/** Caller holds the driver lock: source rows and their financial projections share one snapshot. */
export async function readDigestSnapshot(database: Prisma.TransactionClient, driverId: string, now: Date): Promise<DigestSnapshot> {
  const today = businessDate(now), yesterday = addDays(today, -1), from = addDays(today, -30);
  const goal = await database.goal.findFirst({ where: { driverId, period: 'MONTHLY', isActive: true, startsOn: { lte: today }, endsOn: { gte: today } }, orderBy: [{ startsOn: 'desc' }, { id: 'desc' }] });
  const remainingGoalDays = goal ? Math.floor((goal.endsOn.getTime() - today.getTime()) / 86_400_000) + 1 : null;
  const progress = goal ? await database.dailyAggregate.aggregate({ where: { driverId, date: { gte: goal.startsOn, lt: today } }, _sum: { netProfitPiastres: true } }) : null;
  const earned = progress?._sum.netProfitPiastres ?? 0n;
  const yda = await database.dailyAggregate.findUnique({ where: { driverId_date: { driverId, date: yesterday } } });
  const rows = await database.trip.findMany({ where: { driverId, deletedAt: null, startedAt: { gte: businessDayForDate(from).start, lt: businessDayForDate(today).start } },
    select: { startedAt: true, endedAt: true, earningsPiastres: true, grossPiastres: true, commissionPiastres: true, tipPiastres: true, driverAppId: true, areaId: true, paidKmMeters: true },
    orderBy: [{ startedAt: 'asc' }, { id: 'asc' }], take: DIGEST_TRIP_LIMIT + 1 });
  const complete = rows.length <= DIGEST_TRIP_LIMIT, trips = complete ? rows : [];
  const weekday = today.getUTCDay();
  return {
    kind: NotificationKind.DailyDigest, version: DigestSnapshotVersion.Current, snapshotDate: today.toISOString().slice(0, 10),
    windowStartDate: from.toISOString().slice(0, 10), windowEndDate: yesterday.toISOString().slice(0, 10), sourceTripCount: complete ? rows.length : null,
    insights: {
      todayTargetPiastres: goal && remainingGoalDays ? Math.max(0, roundedRate(BigInt(goal.targetPiastres) - earned, 1n, BigInt(remainingGoalDays))) : null,
      goalTargetPiastres: goal ? MoneyPiastres(goal.targetPiastres) : null, earnedBeforeTodayPiastres: goal ? money(earned) : null, remainingGoalDays,
      goalStartDate: goal?.startsOn.toISOString().slice(0, 10) ?? null, goalEndDate: goal?.endsOn.toISOString().slice(0, 10) ?? null,
      bestStartHour: digestHourObservation(trips), highestAppTotal: await highestApp(database, driverId, trips.filter((trip) => businessDate(trip.startedAt).getUTCDay() === weekday)),
      lowerAreaRate: await lowerArea(database, driverId, trips), yesterdayNetPiastres: yda ? money(yda.netProfitPiastres) : null,
      yesterdayEmptyRatioBp: yda && yda.totalKmMeters > 0n ? roundedRate(yda.emptyKmMeters, 10_000n, yda.totalKmMeters) : null,
    },
  };
}

export function digestHasEvidence(snapshot: DigestSnapshot): boolean {
  const value = snapshot.insights;
  return snapshot.sourceTripCount === null || value.todayTargetPiastres !== null || value.yesterdayNetPiastres !== null || value.bestStartHour !== null || value.highestAppTotal !== null || value.lowerAreaRate !== null;
}

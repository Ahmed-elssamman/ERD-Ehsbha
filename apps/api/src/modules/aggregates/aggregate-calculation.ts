import type { AggregateGroup, AggregateRatios, AggregateSession, AggregateTotals, AggregateTrip, WorkInterval } from './aggregate.model';
import { TripCostScope } from './aggregate.model';
import { tripEarningsPiastres } from '@ehsbha/shared-types';

/** Exact integer rounding, including negative net income; ties follow Math.round. */
function ratio(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) return 0;
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded = quotient + (remainder * 2n >= denominator ? 1n : remainder * 2n < -denominator ? -1n : 0n);
  const result = Number(rounded);
  if (!Number.isSafeInteger(result) || result < -2_147_483_648 || result > 2_147_483_647) throw new RangeError('Aggregate ratio exceeds supported range');
  return result;
}

export function aggregateRatios(totals: Pick<AggregateTotals, 'netProfitPiastres' | 'totalKmMeters' | 'emptyKmMeters' | 'onlineMinutes'>): AggregateRatios {
  return {
    profitPerKmPiastres: ratio(totals.netProfitPiastres * 1000n, totals.totalKmMeters),
    profitPerHourPiastres: ratio(totals.netProfitPiastres * 60n, BigInt(totals.onlineMinutes)),
    emptyRatioBp: ratio(totals.emptyKmMeters * 10000n, totals.totalKmMeters),
  };
}

export function netOperatingIncome(totals: Pick<AggregateTotals, 'grossPiastres' | 'tipPiastres' | 'commissionPiastres' | 'fuelPiastres' | 'expensePiastres' | 'maintenancePiastres'>): bigint {
  return totals.grossPiastres + totals.tipPiastres - totals.commissionPiastres
    - totals.fuelPiastres - totals.expensePiastres - totals.maintenancePiastres;
}

/** Count overlapping trips/platform sessions once, clipped to the reporting day. */
export function workMinutes(intervals: WorkInterval[], from: Date, to: Date): number {
  const bounded = intervals.map((interval) => ({ start: Math.max(interval.startedAt.getTime(), from.getTime()), end: Math.min(interval.endedAt.getTime(), to.getTime()) }))
    .filter((interval) => interval.end > interval.start).sort((a, b) => a.start - b.start);
  let end = from.getTime();
  let duration = 0;
  for (const interval of bounded) {
    duration += Math.max(0, interval.end - Math.max(interval.start, end));
    end = Math.max(end, interval.end);
  }
  return Math.round(duration / 60000);
}

export function dailyTotals(trips: AggregateTrip[], sessions: AggregateSession[], from: Date, to: Date, fuel: bigint, expenses: bigint, maintenance: bigint, scope = TripCostScope.Operating): AggregateTotals {
  const totals: AggregateTotals = { tripCount: 0, totalKmMeters: 0n, paidKmMeters: 0n, emptyKmMeters: 0n,
    grossKnownTripCount: 0, commissionKnownTripCount: 0,
    onlineMinutes: workMinutes([...trips, ...sessions], from, to), grossPiastres: 0n, tipPiastres: 0n,
    commissionPiastres: 0n, fuelPiastres: fuel, expensePiastres: expenses, maintenancePiastres: maintenance, maintAmortPiastres: 0n, netProfitPiastres: 0n };
  for (const trip of trips) {
    if (trip.startedAt < from || trip.startedAt >= to) continue;
    totals.tripCount += 1;
    totals.totalKmMeters += BigInt(trip.totalKmMeters);
    totals.paidKmMeters += BigInt(trip.paidKmMeters);
    totals.emptyKmMeters += BigInt(trip.emptyKmMeters);
    if (trip.grossPiastres !== null) { totals.grossPiastres += BigInt(trip.grossPiastres); totals.grossKnownTripCount += 1; }
    totals.tipPiastres += BigInt(trip.tipPiastres);
    if (trip.commissionPiastres !== null) { totals.commissionPiastres += BigInt(trip.commissionPiastres); totals.commissionKnownTripCount += 1; }
    totals.netProfitPiastres += BigInt(tripEarningsPiastres(trip));
    if (!trip.tollLinked || scope === TripCostScope.Contribution) totals.expensePiastres += BigInt(trip.tollPiastres);
    if (!trip.parkingLinked || scope === TripCostScope.Contribution) totals.expensePiastres += BigInt(trip.parkingPiastres);
  }
  totals.netProfitPiastres -= totals.fuelPiastres + totals.expensePiastres + totals.maintenancePiastres;
  return totals;
}

export function groupTotals(trips: AggregateTrip[], sessions: AggregateSession[], from: Date, to: Date): AggregateGroup {
  const totals = dailyTotals(trips, sessions, from, to, 0n, 0n, 0n, TripCostScope.Contribution);
  // Platform/area contribution excludes operating costs that have no allocation.
  return { tripCount: totals.tripCount, totalKmMeters: totals.totalKmMeters, onlineMinutes: totals.onlineMinutes,
    grossKnownTripCount: totals.grossKnownTripCount, commissionKnownTripCount: totals.commissionKnownTripCount,
    grossPiastres: totals.grossPiastres, netProfitPiastres: totals.netProfitPiastres };
}

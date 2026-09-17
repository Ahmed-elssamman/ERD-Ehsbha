import { Prisma } from '@prisma/client';
import { addCalendarDays, businessDay, calendarDateValue, previousReportRange, ReportSnapshotVersion, type ReportPeriod, type ReportPeriodRange } from '@ehsbha/shared-types';
import type { ReportContent, ReportDay, ReportPlatform } from '@ehsbha/api-contracts';
import { aggregateCoverage } from '../aggregates/aggregate-coverage';
import { reportDayHasActivity, reportInteger, reportRatio, reportTotals } from './report-calculation';
import { readReportCash } from './report-cash-reader';
import { REPORT_GROUP_LIMIT } from './reports.control';

async function readPlatforms(database: Prisma.TransactionClient, driverId: string, range: ReportPeriodRange): Promise<ReportPlatform[] | null> {
  const groups = await database.appDailyAggregate.groupBy({ by: ['driverAppId'], where: { driverId, date: { gte: calendarDateValue(range.startsOn), lt: calendarDateValue(range.nextStartsOn) } },
    _sum: { tripCount: true, grossKnownTripCount: true, commissionKnownTripCount: true, grossPiastres: true, netProfitPiastres: true, totalKmMeters: true, onlineMinutes: true },
    orderBy: { driverAppId: 'asc' }, take: REPORT_GROUP_LIMIT + 1 });
  if (groups.length > REPORT_GROUP_LIMIT) return null;
  const apps = await database.driverApp.findMany({ where: { driverId, id: { in: groups.map((row) => row.driverAppId) } }, include: { appSource: { select: { name: true } } } });
  const names = new Map(apps.map((app) => [app.id, app.customName ?? app.appSource.name]));
  return groups.map((row) => {
    const name = names.get(row.driverAppId), values = row._sum, coverage = aggregateCoverage(values);
    if (!name) throw new RangeError('Report platform does not belong to the driver');
    return { id: row.driverAppId, name, tripCount: reportInteger(values.tripCount ?? 0), totalKmMeters: reportInteger(values.totalKmMeters ?? 0n), workMinutes: reportInteger(values.onlineMinutes ?? 0),
      contributionPiastres: reportInteger(values.netProfitPiastres ?? 0n), contributionPerKmPiastres: reportRatio((values.netProfitPiastres ?? 0n) * 1000n, values.totalKmMeters ?? 0n),
      grossPiastres: coverage.grossPiastres, knownGrossPiastres: coverage.knownGrossPiastres, grossKnownTripCount: coverage.grossKnownTripCount };
  });
}

/** Caller holds the driver write lock throughout source/projection reads and snapshot persistence. */
export async function readReportContent(database: Prisma.TransactionClient, driverId: string, period: ReportPeriod, range: ReportPeriodRange): Promise<ReportContent> {
  const previous = previousReportRange(period, range);
  const rows = await database.dailyAggregate.findMany({ where: { driverId, date: { gte: calendarDateValue(previous.startsOn), lt: calendarDateValue(range.nextStartsOn) } }, orderBy: { date: 'asc' }, take: 63 });
  const currentRows = rows.filter((row) => row.date >= calendarDateValue(range.startsOn));
  const previousRows = rows.filter((row) => row.date < calendarDateValue(range.startsOn));
  const byDate = new Map(currentRows.map((row) => [row.date.toISOString().slice(0, 10), row]));
  const days: ReportDay[] = [];
  for (let date = range.startsOn; date <= range.endsOn; date = addCalendarDays(date, 1)) {
    const row = byDate.get(date); days.push({ date, recorded: row ? reportDayHasActivity(row) : false, totals: reportTotals(row ? [row] : []) });
  }
  const from = businessDay(range.startsOn).start, to = businessDay(range.nextStartsOn).start;
  const [platforms, cash, fuel, maintenance] = await Promise.all([
    readPlatforms(database, driverId, range), readReportCash(database, driverId, range),
    database.fuelLog.aggregate({ where: { driverId, deletedAt: null, dateTime: { gte: from, lt: to } }, _sum: { totalPiastres: true }, _count: true }),
    database.maintenanceRecord.aggregate({ where: { driverId, deletedAt: null, performedAt: { gte: from, lt: to } }, _sum: { costPiastres: true }, _count: true }),
  ]);
  const totals = reportTotals(currentRows);
  if (cash.totalPiastres !== totals.totalCostsPiastres) throw new RangeError('Report recorded costs and financial projections disagree');
  return { schemaVersion: ReportSnapshotVersion.Current, period, startsOn: range.startsOn, endsOn: range.endsOn, totals,
    previous: { startsOn: previous.startsOn, endsOn: previous.endsOn, totals: reportTotals(previousRows) }, days, platforms, vehicleCosts: cash.vehicleCosts,
    unassignedCostsPiastres: cash.unassignedCostsPiastres, largestCosts: cash.largestCosts, fuelPurchasesPiastres: reportInteger(fuel._sum.totalPiastres ?? 0), fuelPurchaseCount: fuel._count,
    maintenanceServicesPiastres: reportInteger(maintenance._sum.costPiastres ?? 0), maintenanceServiceCount: maintenance._count };
}

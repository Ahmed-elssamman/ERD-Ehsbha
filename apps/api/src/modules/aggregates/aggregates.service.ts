import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, ReportingCalendar } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { isoYearWeek, startOfUtcDay } from '../../common/utils/date';
import { businessDate, businessDatesBetween, businessDayForDate } from '@ehsbha/shared-types';
import { aggregateRatios, dailyTotals, groupTotals } from './aggregate-calculation';
import { FINANCIAL_PROJECTION_VERSION, AGGREGATE_DAY_MS, AGGREGATE_SUM_FIELDS, AGGREGATE_TRANSACTION_TIMEOUT_MS, AGGREGATE_TRIP_SELECT, AGGREGATE_SESSION_SELECT } from './aggregate.control';
import { AggregatePeriod, type AggregateRatios, type AggregateRepairPeriod, type WorkInterval } from './aggregate.model';
import { aggregateRepairDates, aggregateRepairPeriods } from './aggregate-repair-query';

@Injectable()
export class AggregatesService {
  constructor(private prisma: PrismaService) {}

  async ensureCalendar(driverId: string, timeout = AGGREGATE_TRANSACTION_TIMEOUT_MS): Promise<void> {
    const driver = await this.prisma.driver.findUniqueOrThrow({ where: { id: driverId }, select: { reportingCalendar: true, financialProjectionVersion: true } });
    if (driver.reportingCalendar === ReportingCalendar.CAIRO && driver.financialProjectionVersion === FINANCIAL_PROJECTION_VERSION) return;
    await this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      await this.ensureCalendarInTransaction(driverId, tx);
    }, { timeout });
  }

  /** Cross-driver reports must not combine calendars during the cutover. */
  async assertCalendarsReady(): Promise<void> {
    const pending = await this.prisma.driver.findFirst({ where: { OR: [{ reportingCalendar: ReportingCalendar.UTC }, { financialProjectionVersion: { not: FINANCIAL_PROJECTION_VERSION } }] }, select: { id: true } });
    if (pending) throw new ServiceUnavailableException({ code: 'REPORTING_PROJECTION_PENDING' });
  }

  private async ensureCalendarInTransaction(driverId: string, tx: Prisma.TransactionClient): Promise<void> {
    const driver = await tx.driver.findUniqueOrThrow({ where: { id: driverId }, select: { reportingCalendar: true, financialProjectionVersion: true } });
    if (driver.reportingCalendar === ReportingCalendar.CAIRO && driver.financialProjectionVersion === FINANCIAL_PROJECTION_VERSION) return;
    const dates = await aggregateRepairDates(tx, driverId);
    for (const date of dates) await this.replaceDay(driverId, date, tx);
    const weeks = new Map<string, Date>();
    const months = new Map<string, Date>();
    for (const date of dates) {
      const week = isoYearWeek(date);
      weeks.set(`${week.isoYear}-${week.isoWeek}`, date);
      months.set(`${date.getUTCFullYear()}-${date.getUTCMonth()}`, date);
    }
    for (const date of weeks.values()) await this.replaceWeek(driverId, date, tx);
    for (const date of months.values()) await this.replaceMonth(driverId, date, tx);
    for (const period of await aggregateRepairPeriods(tx, driverId)) {
      if (period.period === AggregatePeriod.Week) await this.replaceWeek(driverId, period.date, tx);
      else await this.replaceMonth(driverId, period.date, tx);
    }
    const now = new Date();
    await tx.recommendation.updateMany({ where: { driverId, expiresAt: { gt: now } }, data: { expiresAt: now } });
    await tx.driver.update({ where: { id: driverId }, data: { reportingCalendar: ReportingCalendar.CAIRO, financialProjectionVersion: FINANCIAL_PROJECTION_VERSION } });
  }

  async rebuildDay(driverId: string, date: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      await this.refreshDays(driverId, [date], tx);
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  async rebuildPeriod(driverId: string, period: AggregateRepairPeriod): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
      await this.ensureCalendarInTransaction(driverId, tx);
      if (period.period === AggregatePeriod.Week) await this.replaceWeek(driverId, period.date, tx);
      else await this.replaceMonth(driverId, period.date, tx);
    }, { timeout: AGGREGATE_TRANSACTION_TIMEOUT_MS });
  }

  /** Caller writes the source first, under the same driver lock and transaction. */
  async refreshIntervals(driverId: string, intervals: WorkInterval[], tx: Prisma.TransactionClient): Promise<void> {
    const dates: Date[] = [];
    for (const interval of intervals) dates.push(...businessDatesBetween(interval.startedAt, interval.endedAt));
    await this.refreshDays(driverId, dates, tx);
  }

  /** Timestamped costs are assigned by their Cairo date, before date-label arithmetic. */
  async refreshInstants(driverId: string, instants: Date[], tx: Prisma.TransactionClient): Promise<void> {
    await this.refreshDays(driverId, instants.map(businessDate), tx);
  }

  /** Dates are PostgreSQL DATE labels represented at UTC midnight, not timestamps. */
  async refreshDays(driverId: string, dates: Date[], tx: Prisma.TransactionClient): Promise<void> {
    await this.ensureCalendarInTransaction(driverId, tx);
    const unique = [...new Set(dates.map((date) => startOfUtcDay(date).getTime()))].sort((a, b) => a - b).map((time) => new Date(time));
    for (const date of unique) await this.replaceDay(driverId, date, tx);
    const weeks = new Map<string, Date>();
    const months = new Map<string, Date>();
    for (const date of unique) {
      const { isoYear, isoWeek } = isoYearWeek(date);
      weeks.set(`${isoYear}-${isoWeek}`, date);
      months.set(`${date.getUTCFullYear()}-${date.getUTCMonth()}`, date);
    }
    for (const date of weeks.values()) await this.replaceWeek(driverId, date, tx);
    for (const date of months.values()) await this.replaceMonth(driverId, date, tx);
    const now = new Date();
    await tx.recommendation.updateMany({ where: { driverId, expiresAt: { gt: now } }, data: { expiresAt: now } });
  }

  private async replaceDay(driverId: string, date: Date, tx: Prisma.TransactionClient): Promise<void> {
    const { start, end: next } = businessDayForDate(date);
    const [tripRows, sessionRows, fuels, expenses, maintenance, previous, odometer] = await Promise.all([
      tx.trip.findMany({ where: { driverId, deletedAt: null, startedAt: { lt: next }, endedAt: { gt: start } }, select: AGGREGATE_TRIP_SELECT }),
      tx.session.findMany({ where: { driverId, deletedAt: null, startedAt: { lt: next }, endedAt: { gt: start } }, select: AGGREGATE_SESSION_SELECT }),
      tx.fuelLog.aggregate({ where: { driverId, deletedAt: null, OR: [{ linkedExpenseId: null }, { linkedExpense: { deletedAt: { not: null } } }], dateTime: { gte: start, lt: next } }, _sum: { totalPiastres: true } }),
      tx.expense.aggregate({ where: { driverId, deletedAt: null, dateTime: { gte: start, lt: next } }, _sum: { amountPiastres: true } }),
      tx.maintenanceRecord.aggregate({ where: { driverId, deletedAt: null, performedAt: { gte: start, lt: next },
        OR: [{ linkedExpenseId: null }, { linkedExpense: { deletedAt: { not: null } } }] }, _sum: { costPiastres: true } }),
      tx.dailyAggregate.findUnique({ where: { driverId_date: { driverId, date } } }),
      tx.dailyOdometer.findUnique({ where: { driverId_date: { driverId, date } }, select: { totalKmMeters: true } }),
    ]);
    const trips = tripRows.map((trip) => ({ ...trip,
      tollLinked: trip.linkedExpenses.some((expense) => expense.category === 'TOLL'),
      parkingLinked: trip.linkedExpenses.some((expense) => expense.category === 'PARKING'),
    }));
    const sessions = sessionRows.flatMap((session) => session.endedAt ? [{ ...session, endedAt: session.endedAt }] : []);
    const totals = dailyTotals(trips, sessions, start, next, this.moneySum(fuels._sum.totalPiastres), this.moneySum(expenses._sum.amountPiastres), this.moneySum(maintenance._sum.costPiastres));
    totals.maintAmortPiastres = previous?.maintAmortPiastres ?? 0n;
    if (odometer) {
      if (odometer.totalKmMeters < totals.paidKmMeters) throw new BadRequestException({ code: 'DAILY_DISTANCE_CONFLICT' });
      totals.totalKmMeters = odometer.totalKmMeters;
      totals.emptyKmMeters = odometer.totalKmMeters - totals.paidKmMeters;
    }
    let ratios: AggregateRatios;
    try { ratios = aggregateRatios(totals); }
    catch { throw new BadRequestException({ code: 'VALIDATION_ERROR' }); }
    const data = { ...totals, ...ratios };
    await tx.dailyAggregate.upsert({ where: { driverId_date: { driverId, date } }, create: { driverId, date, ...data }, update: data });
    await tx.appDailyAggregate.deleteMany({ where: { driverId, date } });
    await tx.areaDailyAggregate.deleteMany({ where: { driverId, date } });
    const appIds = new Set([...trips.map((trip) => trip.driverAppId), ...sessions.flatMap((session) => session.driverAppId ? [session.driverAppId] : [])]);
    if (appIds.size) await tx.appDailyAggregate.createMany({ data: [...appIds].map((driverAppId) => ({
      driverId, driverAppId, date,
      ...groupTotals(trips.filter((trip) => trip.driverAppId === driverAppId), sessions.filter((session) => session.driverAppId === driverAppId), start, next),
    })) });
    const areaIds = new Set(trips.flatMap((trip) => trip.areaId && trip.startedAt >= start && trip.startedAt < next ? [trip.areaId] : []));
    if (areaIds.size) await tx.areaDailyAggregate.createMany({ data: [...areaIds].map((areaId) => {
      const { onlineMinutes: _minutes, ...group } = groupTotals(trips.filter((trip) => trip.areaId === areaId), [], start, next);
      return { driverId, areaId, date, ...group };
    }) });
  }

  private async periodTotals(driverId: string, from: Date, to: Date, tx: Prisma.TransactionClient) {
    const { _sum: sum } = await tx.dailyAggregate.aggregate({ where: { driverId, date: { gte: from, lt: to } }, _sum: AGGREGATE_SUM_FIELDS });
    const totals = { tripCount: sum.tripCount ?? 0, totalKmMeters: sum.totalKmMeters ?? 0n,
      grossKnownTripCount: sum.grossKnownTripCount ?? 0, commissionKnownTripCount: sum.commissionKnownTripCount ?? 0,
      paidKmMeters: sum.paidKmMeters ?? 0n, emptyKmMeters: sum.emptyKmMeters ?? 0n,
      onlineMinutes: sum.onlineMinutes ?? 0, grossPiastres: sum.grossPiastres ?? 0n,
      netProfitPiastres: sum.netProfitPiastres ?? 0n, fuelPiastres: sum.fuelPiastres ?? 0n,
      expensePiastres: sum.expensePiastres ?? 0n, maintenancePiastres: sum.maintenancePiastres ?? 0n, maintAmortPiastres: sum.maintAmortPiastres ?? 0n };
    try { return { ...totals, ...aggregateRatios(totals) }; }
    catch { throw new BadRequestException({ code: 'VALIDATION_ERROR' }); }
  }

  private moneySum(value: number | null): bigint {
    const amount = value ?? 0;
    if (!Number.isSafeInteger(amount)) throw new BadRequestException({ code: 'VALIDATION_ERROR' });
    return BigInt(amount);
  }

  private async replaceWeek(driverId: string, date: Date, tx: Prisma.TransactionClient): Promise<void> {
    const { isoYear, isoWeek } = isoYearWeek(date);
    const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * AGGREGATE_DAY_MS);
    const data = await this.periodTotals(driverId, monday, new Date(monday.getTime() + 7 * AGGREGATE_DAY_MS), tx);
    await tx.weeklyAggregate.upsert({ where: { driverId_isoYear_isoWeek: { driverId, isoYear, isoWeek } }, create: { driverId, isoYear, isoWeek, ...data }, update: data });
  }

  private async replaceMonth(driverId: string, date: Date, tx: Prisma.TransactionClient): Promise<void> {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const data = await this.periodTotals(driverId, new Date(Date.UTC(year, month - 1, 1)), new Date(Date.UTC(year, month, 1)), tx);
    await tx.monthlyAggregate.upsert({ where: { driverId_year_month: { driverId, year, month } }, create: { driverId, year, month, ...data }, update: data });
  }
}

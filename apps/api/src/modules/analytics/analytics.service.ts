import type { DailyAggregate, WeeklyAggregate, MonthlyAggregate } from '@prisma/client';
import { aggregateCoverage } from '../aggregates/aggregate-coverage';
import { OperatingCostBasis, tripContributionPiastres, TripCostBasis, businessDate, businessDayForDate, businessHour } from '@ehsbha/shared-types';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays, startOfUtcDay } from '../../common/utils/date';
import { AggregatesService } from '../aggregates/aggregates.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService, private aggregates: AggregatesService) {}

  async today(driverId: string) {
    const date = businessDate(new Date());
    return this.daily(driverId, date);
  }

  async daily(driverId: string, date: Date) {
    await this.aggregates.ensureCalendar(driverId);
    const d = startOfUtcDay(date);
    const row = await this.prisma.dailyAggregate.findUnique({
      where: { driverId_date: { driverId, date: d } },
    });
    return this.serializeDaily(d, row);
  }

  async weekly(driverId: string, isoYear: number, isoWeek: number) {
    await this.aggregates.ensureCalendar(driverId);
    const row = await this.prisma.weeklyAggregate.findUnique({
      where: { driverId_isoYear_isoWeek: { driverId, isoYear, isoWeek } },
    });
    return this.serializeWeekly(isoYear, isoWeek, row);
  }

  async monthly(driverId: string, year: number, month: number) {
    await this.aggregates.ensureCalendar(driverId);
    const row = await this.prisma.monthlyAggregate.findUnique({
      where: { driverId_year_month: { driverId, year, month } },
    });
    return this.serializeMonthly(year, month, row);
  }

  async apps(driverId: string, windowDays: number) {
    await this.aggregates.ensureCalendar(driverId);
    const today = businessDate(new Date());
    const since = addDays(today, 1 - windowDays);
    const rows = await this.prisma.appDailyAggregate.groupBy({
      by: ['driverAppId'],
      where: { driverId, date: { gte: since, lte: today } },
      _sum: {
        grossPiastres: true, grossKnownTripCount: true, commissionKnownTripCount: true,
        netProfitPiastres: true,
        totalKmMeters: true,
        onlineMinutes: true,
        tripCount: true,
      },
    });
    const driverApps = await this.prisma.driverApp.findMany({
      where: { driverId, id: { in: rows.map((r) => r.driverAppId) } },
      include: { appSource: true },
    });
    const out = rows.map((r) => {
      const app = driverApps.find((d) => d.id === r.driverAppId);
      const net = Number(r._sum.netProfitPiastres ?? 0);
      const km = Number(r._sum.totalKmMeters ?? 0);
      const minutes = Number(r._sum.onlineMinutes ?? 0);
      return {
        driverAppId: r.driverAppId,
        costBasis: TripCostBasis.Contribution,
        appName: app?.customName ?? app?.appSource.name ?? 'Unknown',
        color: app?.color ?? null,
        tripCount: Number(r._sum.tripCount ?? 0),
        netProfitPiastres: net,
        ...aggregateCoverage(r._sum),
        totalKmMeters: km,
        onlineMinutes: minutes,
        profitPerKmPiastres: km > 0 ? Math.round((net * 1000) / km) : 0,
        profitPerHourPiastres: minutes > 0 ? Math.round((net * 60) / minutes) : 0,
      };
    });
    out.sort((a, b) => b.profitPerHourPiastres - a.profitPerHourPiastres);
    return { windowDays, items: out };
  }

  async areas(driverId: string, windowDays: number) {
    await this.aggregates.ensureCalendar(driverId);
    const today = businessDate(new Date());
    const since = addDays(today, 1 - windowDays);
    const rows = await this.prisma.areaDailyAggregate.groupBy({
      by: ['areaId'],
      where: { driverId, date: { gte: since, lte: today } },
      _sum: {
        grossPiastres: true, grossKnownTripCount: true, commissionKnownTripCount: true,
        netProfitPiastres: true,
        totalKmMeters: true,
        tripCount: true,
      },
    });
    const areas = await this.prisma.area.findMany({
      where: { driverId, id: { in: rows.map((r) => r.areaId) } },
    });
    const out = rows.map((r) => {
      const a = areas.find((x) => x.id === r.areaId);
      const net = Number(r._sum.netProfitPiastres ?? 0);
      const km = Number(r._sum.totalKmMeters ?? 0);
      return {
        areaId: r.areaId,
        costBasis: TripCostBasis.Contribution,
        name: a?.name ?? 'Unknown',
        color: a?.color ?? null,
        tripCount: Number(r._sum.tripCount ?? 0),
        netProfitPiastres: net,
        ...aggregateCoverage(r._sum),
        totalKmMeters: km,
        profitPerKmPiastres: km > 0 ? Math.round((net * 1000) / km) : 0,
      };
    });
    out.sort((a, b) => b.netProfitPiastres - a.netProfitPiastres);
    return { windowDays, items: out };
  }

  async hours(driverId: string, windowDays: number) {
    const today = businessDate(new Date());
    const since = businessDayForDate(addDays(today, 1 - windowDays)).start;
    const until = businessDayForDate(today).end;
    const trips = await this.prisma.trip.findMany({
      where: { driverId, deletedAt: null, startedAt: { gte: since, lt: until } },
      select: { startedAt: true, earningsPiastres: true, grossPiastres: true, commissionPiastres: true, tipPiastres: true, tollPiastres: true, parkingPiastres: true, totalKmMeters: true },
    });
    const buckets = Array.from({ length: 4 }, () => ({
      tripCount: 0,
      contributionPiastres: 0,
      kmMeters: 0,
      label: '',
    }));
    buckets[0].label = 'morning';
    buckets[1].label = 'afternoon';
    buckets[2].label = 'evening';
    buckets[3].label = 'night';

    for (const t of trips) {
      const h = businessHour(t.startedAt);
      const idx = h >= 5 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 22 ? 2 : 3;
      const net = tripContributionPiastres(t);
      buckets[idx].tripCount++;
      buckets[idx].contributionPiastres += net;
      buckets[idx].kmMeters += t.totalKmMeters;
    }
    return {
      windowDays,
      items: buckets.map((b) => ({
        bucket: b.label,
        costBasis: TripCostBasis.Contribution,
        tripCount: b.tripCount,
        netProfitPiastres: b.contributionPiastres,
        totalKmMeters: b.kmMeters,
        profitPerKmPiastres: b.kmMeters > 0 ? Math.round((b.contributionPiastres * 1000) / b.kmMeters) : 0,
      })),
    };
  }

  async forecastMonthly(driverId: string, year?: number, month?: number) {
    await this.aggregates.ensureCalendar(driverId);
    const now = businessDate(new Date());
    const y = year ?? now.getUTCFullYear();
    const m = month ?? now.getUTCMonth() + 1;
    const monthly = await this.prisma.monthlyAggregate.findUnique({
      where: { driverId_year_month: { driverId, year: y, month: m } },
    });
    const totalDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const isCurrent = y === now.getUTCFullYear() && m === now.getUTCMonth() + 1;
    const elapsedDays = isCurrent ? Math.max(1, now.getUTCDate()) : totalDays;
    const net = Number(monthly?.netProfitPiastres ?? 0);
    const projected = Math.round((net * totalDays) / elapsedDays);

    const dailyRows = await this.prisma.dailyAggregate.findMany({
      where: {
        driverId,
        date: {
          gte: new Date(Date.UTC(y, m - 1, 1)),
          lt: new Date(Date.UTC(y, m, 1)),
        },
      },
      select: { netProfitPiastres: true },
    });
    const values = dailyRows.map((r) => Number(r.netProfitPiastres));
    const mean = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    const variance = values.length
      ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
      : 0;
    const stdev = Math.sqrt(variance);
    const remaining = Math.max(0, totalDays - elapsedDays);
    const confidenceBandPiastres = Math.round(stdev * Math.sqrt(remaining));

    return {
      year: y,
      month: m,
      currentNetPiastres: net,
      forecastNetPiastres: projected,
      confidenceBandPiastres,
      elapsedDays,
      totalDays,
    };
  }

  private serializeDaily(date: Date, row: DailyAggregate | null) {
    if (!row) {
      return {
        date,
        tripCount: 0,
        totalKmMeters: 0,
        paidKmMeters: 0,
        emptyKmMeters: 0,
        onlineMinutes: 0,
        grossPiastres: 0, knownGrossPiastres: 0, grossKnownTripCount: 0, commissionKnownTripCount: 0,
        fuelPiastres: 0,
        expensePiastres: 0, maintenancePiastres: 0, retainedMaintenanceEstimatePiastres: 0, costBasis: OperatingCostBasis.Recorded,
        netProfitPiastres: 0,
        profitPerKmPiastres: 0,
        profitPerHourPiastres: 0,
        emptyRatioBp: 0,
      };
    }
    return {
      date: row.date,
      tripCount: row.tripCount,
      totalKmMeters: Number(row.totalKmMeters),
      paidKmMeters: Number(row.paidKmMeters),
      emptyKmMeters: Number(row.emptyKmMeters),
      onlineMinutes: row.onlineMinutes,
      ...aggregateCoverage(row),
      fuelPiastres: Number(row.fuelPiastres),
      expensePiastres: Number(row.expensePiastres),
      maintenancePiastres: Number(row.maintenancePiastres), retainedMaintenanceEstimatePiastres: Number(row.maintAmortPiastres), costBasis: OperatingCostBasis.Recorded,
      netProfitPiastres: Number(row.netProfitPiastres),
      profitPerKmPiastres: row.profitPerKmPiastres,
      profitPerHourPiastres: row.profitPerHourPiastres,
      emptyRatioBp: row.emptyRatioBp,
    };
  }

  private serializeWeekly(isoYear: number, isoWeek: number, row: WeeklyAggregate | null) {
    if (!row) return { isoYear, isoWeek, tripCount: 0, netProfitPiastres: 0, maintenancePiastres: 0, retainedMaintenanceEstimatePiastres: 0, fuelPiastres: 0, expensePiastres: 0, costBasis: OperatingCostBasis.Recorded };
    return {
      isoYear,
      isoWeek,
      tripCount: row.tripCount,
      totalKmMeters: Number(row.totalKmMeters),
      paidKmMeters: Number(row.paidKmMeters),
      emptyKmMeters: Number(row.emptyKmMeters),
      onlineMinutes: row.onlineMinutes,
      ...aggregateCoverage(row),
      netProfitPiastres: Number(row.netProfitPiastres),
      fuelPiastres: Number(row.fuelPiastres),
      expensePiastres: Number(row.expensePiastres),
      maintenancePiastres: Number(row.maintenancePiastres), retainedMaintenanceEstimatePiastres: Number(row.maintAmortPiastres), costBasis: OperatingCostBasis.Recorded,
      profitPerKmPiastres: row.profitPerKmPiastres,
      profitPerHourPiastres: row.profitPerHourPiastres,
      emptyRatioBp: row.emptyRatioBp,
    };
  }

  private serializeMonthly(year: number, month: number, row: MonthlyAggregate | null) {
    if (!row) return { year, month, tripCount: 0, netProfitPiastres: 0, maintenancePiastres: 0, retainedMaintenanceEstimatePiastres: 0, fuelPiastres: 0, expensePiastres: 0, costBasis: OperatingCostBasis.Recorded };
    return {
      year,
      month,
      tripCount: row.tripCount,
      totalKmMeters: Number(row.totalKmMeters),
      paidKmMeters: Number(row.paidKmMeters),
      emptyKmMeters: Number(row.emptyKmMeters),
      onlineMinutes: row.onlineMinutes,
      ...aggregateCoverage(row),
      netProfitPiastres: Number(row.netProfitPiastres),
      fuelPiastres: Number(row.fuelPiastres),
      expensePiastres: Number(row.expensePiastres),
      maintenancePiastres: Number(row.maintenancePiastres), retainedMaintenanceEstimatePiastres: Number(row.maintAmortPiastres), costBasis: OperatingCostBasis.Recorded,
      profitPerKmPiastres: row.profitPerKmPiastres,
      profitPerHourPiastres: row.profitPerHourPiastres,
      emptyRatioBp: row.emptyRatioBp,
    };
  }
}

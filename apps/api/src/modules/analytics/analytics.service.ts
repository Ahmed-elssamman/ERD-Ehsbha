import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays, isoYearWeek, startOfUtcDay } from '../../common/utils/date';
import { safeDiv } from '../../common/utils/money';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async today(driverId: string) {
    const date = startOfUtcDay(new Date());
    return this.daily(driverId, date);
  }

  async daily(driverId: string, date: Date) {
    const d = startOfUtcDay(date);
    const row = await this.prisma.dailyAggregate.findUnique({
      where: { driverId_date: { driverId, date: d } },
    });
    return this.serializeDaily(d, row);
  }

  async weekly(driverId: string, isoYear: number, isoWeek: number) {
    const row = await this.prisma.weeklyAggregate.findUnique({
      where: { driverId_isoYear_isoWeek: { driverId, isoYear, isoWeek } },
    });
    return this.serializeWeekly(isoYear, isoWeek, row);
  }

  async monthly(driverId: string, year: number, month: number) {
    const row = await this.prisma.monthlyAggregate.findUnique({
      where: { driverId_year_month: { driverId, year, month } },
    });
    return this.serializeMonthly(year, month, row);
  }

  async apps(driverId: string, windowDays: number) {
    const since = startOfUtcDay(addDays(new Date(), -windowDays));
    const rows = await this.prisma.appDailyAggregate.groupBy({
      by: ['driverAppId'],
      where: { driverId, date: { gte: since } },
      _sum: {
        grossPiastres: true,
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
        appName: app?.customName ?? app?.appSource.name ?? 'Unknown',
        color: app?.color ?? null,
        tripCount: Number(r._sum.tripCount ?? 0),
        netProfitPiastres: net,
        grossPiastres: Number(r._sum.grossPiastres ?? 0),
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
    const since = startOfUtcDay(addDays(new Date(), -windowDays));
    const rows = await this.prisma.areaDailyAggregate.groupBy({
      by: ['areaId'],
      where: { driverId, date: { gte: since } },
      _sum: {
        grossPiastres: true,
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
        name: a?.name ?? 'Unknown',
        color: a?.color ?? null,
        tripCount: Number(r._sum.tripCount ?? 0),
        netProfitPiastres: net,
        grossPiastres: Number(r._sum.grossPiastres ?? 0),
        totalKmMeters: km,
        profitPerKmPiastres: km > 0 ? Math.round((net * 1000) / km) : 0,
      };
    });
    out.sort((a, b) => b.netProfitPiastres - a.netProfitPiastres);
    return { windowDays, items: out };
  }

  async hours(driverId: string, windowDays: number) {
    const since = addDays(new Date(), -windowDays);
    const trips = await this.prisma.trip.findMany({
      where: { driverId, startedAt: { gte: since } },
      select: { startedAt: true, grossPiastres: true, commissionPiastres: true, tipPiastres: true, totalKmMeters: true },
    });
    const buckets = Array.from({ length: 4 }, () => ({
      tripCount: 0,
      grossPiastres: 0,
      kmMeters: 0,
      label: '',
    }));
    buckets[0].label = 'morning';
    buckets[1].label = 'afternoon';
    buckets[2].label = 'evening';
    buckets[3].label = 'night';

    for (const t of trips) {
      const h = t.startedAt.getUTCHours();
      const idx = h >= 5 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 22 ? 2 : 3;
      const net = t.grossPiastres + t.tipPiastres - t.commissionPiastres;
      buckets[idx].tripCount++;
      buckets[idx].grossPiastres += net;
      buckets[idx].kmMeters += t.totalKmMeters;
    }
    return {
      windowDays,
      items: buckets.map((b) => ({
        bucket: b.label,
        tripCount: b.tripCount,
        netProfitPiastres: b.grossPiastres,
        totalKmMeters: b.kmMeters,
        profitPerKmPiastres: b.kmMeters > 0 ? Math.round((b.grossPiastres * 1000) / b.kmMeters) : 0,
      })),
    };
  }

  async forecastMonthly(driverId: string, year?: number, month?: number) {
    const now = new Date();
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

  private serializeDaily(date: Date, row: any) {
    if (!row) {
      return {
        date,
        tripCount: 0,
        totalKmMeters: 0,
        paidKmMeters: 0,
        emptyKmMeters: 0,
        onlineMinutes: 0,
        grossPiastres: 0,
        fuelPiastres: 0,
        expensePiastres: 0,
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
      grossPiastres: Number(row.grossPiastres),
      fuelPiastres: Number(row.fuelPiastres),
      expensePiastres: Number(row.expensePiastres),
      netProfitPiastres: Number(row.netProfitPiastres),
      profitPerKmPiastres: row.profitPerKmPiastres,
      profitPerHourPiastres: row.profitPerHourPiastres,
      emptyRatioBp: row.emptyRatioBp,
    };
  }

  private serializeWeekly(isoYear: number, isoWeek: number, row: any) {
    if (!row) return { isoYear, isoWeek, tripCount: 0, netProfitPiastres: 0 };
    return {
      isoYear,
      isoWeek,
      tripCount: row.tripCount,
      totalKmMeters: Number(row.totalKmMeters),
      paidKmMeters: Number(row.paidKmMeters),
      emptyKmMeters: Number(row.emptyKmMeters),
      onlineMinutes: row.onlineMinutes,
      grossPiastres: Number(row.grossPiastres),
      netProfitPiastres: Number(row.netProfitPiastres),
      fuelPiastres: Number(row.fuelPiastres),
      expensePiastres: Number(row.expensePiastres),
      profitPerKmPiastres: row.profitPerKmPiastres,
      profitPerHourPiastres: row.profitPerHourPiastres,
      emptyRatioBp: row.emptyRatioBp,
    };
  }

  private serializeMonthly(year: number, month: number, row: any) {
    if (!row) return { year, month, tripCount: 0, netProfitPiastres: 0 };
    return {
      year,
      month,
      tripCount: row.tripCount,
      totalKmMeters: Number(row.totalKmMeters),
      paidKmMeters: Number(row.paidKmMeters),
      emptyKmMeters: Number(row.emptyKmMeters),
      onlineMinutes: row.onlineMinutes,
      grossPiastres: Number(row.grossPiastres),
      netProfitPiastres: Number(row.netProfitPiastres),
      fuelPiastres: Number(row.fuelPiastres),
      expensePiastres: Number(row.expensePiastres),
      profitPerKmPiastres: row.profitPerKmPiastres,
      profitPerHourPiastres: row.profitPerHourPiastres,
      emptyRatioBp: row.emptyRatioBp,
    };
  }
}

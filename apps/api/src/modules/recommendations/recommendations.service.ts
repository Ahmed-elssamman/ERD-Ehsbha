import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { GoalsService } from '../goals/goals.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import {
  generateRecommendations,
  pickDailyDecisions,
  RecommendationCandidate,
} from '../analytics/engines/recommendation.engine';
import { addDays } from '../../common/utils/date';
import { computeFuelEfficiency } from '../analytics/engines/fuel.engine';
import { computeFatigue } from '../analytics/engines/score.engine';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly goals: GoalsService,
    private readonly maintenance: MaintenanceService,
  ) {}

  async listActive(driverId: string, surface = 'home') {
    return this.prisma.recommendation.findMany({
      where: {
        driverId,
        surface,
        dismissedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ score: 'desc' }, { generatedAt: 'desc' }],
      take: 10,
    });
  }

  async dismiss(driverId: string, id: string) {
    const row = await this.prisma.recommendation.findFirst({ where: { id, driverId } });
    if (!row) throw new NotFoundException({ code: 'RECOMMENDATION_NOT_FOUND' });
    await this.prisma.recommendation.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });
  }

  async todaysDecisions(driverId: string) {
    const cached = await this.prisma.recommendation.findMany({
      where: {
        driverId,
        surface: 'decisions',
        dismissedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { score: 'desc' },
      take: 3,
    });
    if (cached.length >= 3) return cached;

    const fresh = await this.generateForDriver(driverId);
    const decisions = pickDailyDecisions(fresh, 3);
    await this.persistDecisions(driverId, decisions);
    return this.prisma.recommendation.findMany({
      where: {
        driverId,
        surface: 'decisions',
        dismissedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { score: 'desc' },
      take: 3,
    });
  }

  async generateAndStore(driverId: string) {
    const candidates = await this.generateForDriver(driverId);
    const top = candidates.sort((a, b) => b.score - a.score).slice(0, 6);
    await this.persistHome(driverId, top);
    return top;
  }

  private async generateForDriver(driverId: string): Promise<RecommendationCandidate[]> {
    const driver = await this.prisma.driver.findUniqueOrThrow({
      where: { id: driverId },
      include: { user: true },
    });
    const locale = (driver.user.locale === 'en' ? 'en' : 'ar') as 'ar' | 'en';

    const since7 = addDays(new Date(), -7);
    const since90 = addDays(new Date(), -90);

    const [last7Days, last90Days, apps7d, fuel90d] = await Promise.all([
      this.prisma.dailyAggregate.findMany({ where: { driverId, date: { gte: since7 } } }),
      this.prisma.dailyAggregate.findMany({ where: { driverId, date: { gte: since90 } } }),
      this.analytics.apps(driverId, 7),
      this.prisma.fuelLog.findMany({
        where: { driverId, dateTime: { gte: since90 } },
        orderBy: { dateTime: 'asc' },
      }),
    ]);

    const sum7 = sumDays(last7Days);
    const sum90 = sumDays(last90Days);

    const fuelEff90 = computeFuelEfficiency(
      fuel90d.map((f) => ({
        dateTime: f.dateTime,
        liters: Number(f.liters),
        totalPiastres: f.totalPiastres,
        odometerMeters: Number(f.odometerMeters),
        isFullTank: f.isFullTank,
      })),
    );

    const last14Fuel = fuel90d.filter((f) => f.dateTime.getTime() >= addDays(new Date(), -14).getTime());
    const fuelEff14 = computeFuelEfficiency(
      last14Fuel.map((f) => ({
        dateTime: f.dateTime,
        liters: Number(f.liters),
        totalPiastres: f.totalPiastres,
        odometerMeters: Number(f.odometerMeters),
        isFullTank: f.isFullTank,
      })),
    );

    let monthlyGoal: { targetPiastres: number; currentNetPiastres: number; forecastNetPiastres: number } | undefined;
    const activeGoal = await this.prisma.goal.findFirst({
      where: { driverId, period: 'MONTHLY', isActive: true },
      orderBy: { startsOn: 'desc' },
    });
    if (activeGoal) {
      const prog = await this.goals.progress(driverId, activeGoal.id);
      monthlyGoal = {
        targetPiastres: prog.goal.targetPiastres,
        currentNetPiastres: prog.currentNetPiastres,
        forecastNetPiastres: prog.forecastNetPiastres,
      };
    }

    const fatigueState = await this.computeCurrentFatigue(driverId);

    const activeVehicle = await this.prisma.vehicle.findFirst({
      where: { driverId, isActive: true },
    });
    const maintenance = activeVehicle
      ? (await this.maintenance.risk(driverId, activeVehicle.id)).map((m) => ({
          code: m.item.code,
          name: m.item.name,
          status: m.status,
          risk: m.risk,
        }))
      : [];

    return generateRecommendations({
      locale,
      recent7d: sum7,
      baseline90d: {
        emptyRatioBp: sum90.emptyRatioBp,
        fuelKmPerLiter: fuelEff90.kmPerLiter,
        profitPerKmPiastres: sum90.profitPerKmPiastres,
      },
      appPerformance: apps7d.items.map((a) => ({
        driverAppId: a.driverAppId,
        appName: a.appName,
        profitPerHourPiastres: a.profitPerHourPiastres,
        onlineMinutes: a.onlineMinutes,
      })),
      maintenance,
      fatigue: fatigueState,
      monthlyGoal,
    }).map((r) => ({
      ...r,
      recent7d: { fuelKmPerLiter: fuelEff14.kmPerLiter },
    } as any));
  }

  private async computeCurrentFatigue(driverId: string) {
    const now = new Date();
    const oneDay = addDays(now, -1);
    const oneWeek = addDays(now, -7);
    const trips = await this.prisma.trip.findMany({
      where: { driverId, startedAt: { gte: oneWeek } },
      orderBy: { startedAt: 'asc' },
    });
    const sessions = await this.prisma.session.findMany({
      where: { driverId, startedAt: { gte: oneWeek } },
    });
    const dailyMin = sessions
      .filter((s) => s.startedAt.getTime() >= oneDay.getTime())
      .reduce((s, x) => s + x.activeMinutes, 0);
    const weeklyMin = sessions.reduce((s, x) => s + x.activeMinutes, 0);

    let nightMin = 0;
    let totalMin = 0;
    for (const t of trips) {
      if (t.startedAt.getTime() < oneDay.getTime()) continue;
      const dur = Math.max(0, (t.endedAt.getTime() - t.startedAt.getTime()) / 60_000);
      totalMin += dur;
      const h = t.startedAt.getUTCHours();
      if (h >= 23 || h < 5) nightMin += dur;
    }
    const nightShare = totalMin > 0 ? nightMin / totalMin : 0;

    let continuous = 0;
    if (trips.length > 0) {
      const last = trips[trips.length - 1];
      let lastEnd = last.endedAt.getTime();
      let lastStart = last.startedAt.getTime();
      for (let i = trips.length - 2; i >= 0; i--) {
        const gap = (lastStart - trips[i].endedAt.getTime()) / 60_000;
        if (gap < 15) {
          lastStart = trips[i].startedAt.getTime();
        } else break;
      }
      continuous = Math.max(0, (lastEnd - lastStart) / 60_000);
    }

    let sleepGapHours = 24;
    if (sessions.length > 0) {
      const sorted = [...sessions].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      let maxGap = 0;
      for (let i = 1; i < sorted.length; i++) {
        const prevEnd = sorted[i - 1].endedAt ?? sorted[i - 1].startedAt;
        const gap = (sorted[i].startedAt.getTime() - prevEnd.getTime()) / 3_600_000;
        if (gap > maxGap) maxGap = gap;
      }
      sleepGapHours = Math.min(24, maxGap);
    }

    return computeFatigue({
      continuousDriveMinutes: continuous,
      dailyOnlineMinutes: dailyMin,
      weeklyOnlineMinutes: weeklyMin,
      nightShare,
      sleepGapHours,
    });
  }

  private async persistHome(driverId: string, items: RecommendationCandidate[]) {
    const now = new Date();
    await this.prisma.recommendation.updateMany({
      where: { driverId, surface: 'home', dismissedAt: null },
      data: { dismissedAt: now },
    });
    for (const it of items) {
      await this.prisma.recommendation.create({
        data: {
          driverId,
          type: it.type,
          title: it.title,
          body: it.body,
          score: it.score,
          payload: (it.payload ?? {}) as any,
          surface: 'home',
          generatedAt: now,
          expiresAt: new Date(now.getTime() + it.ttlMinutes * 60_000),
        },
      });
    }
  }

  private async persistDecisions(driverId: string, items: RecommendationCandidate[]) {
    const now = new Date();
    await this.prisma.recommendation.updateMany({
      where: { driverId, surface: 'decisions', dismissedAt: null },
      data: { dismissedAt: now },
    });
    for (const it of items) {
      await this.prisma.recommendation.create({
        data: {
          driverId,
          type: it.type,
          title: it.title,
          body: it.body,
          score: it.score,
          payload: (it.payload ?? {}) as any,
          surface: 'decisions',
          generatedAt: now,
          expiresAt: new Date(now.getTime() + it.ttlMinutes * 60_000),
        },
      });
    }
  }
}

function sumDays(rows: any[]) {
  const totalKm = rows.reduce((s, r) => s + Number(r.totalKmMeters), 0);
  const paidKm = rows.reduce((s, r) => s + Number(r.paidKmMeters), 0);
  const emptyKm = rows.reduce((s, r) => s + Number(r.emptyKmMeters), 0);
  const net = rows.reduce((s, r) => s + Number(r.netProfitPiastres), 0);
  const gross = rows.reduce((s, r) => s + Number(r.grossPiastres), 0);
  const minutes = rows.reduce((s, r) => s + r.onlineMinutes, 0);
  return {
    netProfitPiastres: net,
    grossPiastres: gross,
    onlineMinutes: minutes,
    totalKmMeters: totalKm,
    paidKmMeters: paidKm,
    emptyKmMeters: emptyKm,
    emptyRatioBp: totalKm > 0 ? Math.round((emptyKm / totalKm) * 10_000) : 0,
    profitPerKmPiastres: totalKm > 0 ? Math.round((net * 1000) / totalKm) : 0,
    fuelKmPerLiter: 0,
  };
}

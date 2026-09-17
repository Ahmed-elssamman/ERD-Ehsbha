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
import { businessDate, businessDayForDate } from '@ehsbha/shared-types';
import { AggregatesService } from '../aggregates/aggregates.service';
import { fuelComparisonRecommendations } from '../analytics/engines/fuel-comparison.engine';
import { fuelSnapshot } from '../fuel/fuel-history';
import { FUEL_EVIDENCE_RECORD_LIMIT } from '../fuel/fuel.control';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly goals: GoalsService,
    private readonly maintenance: MaintenanceService,
    private aggregates: AggregatesService,
  ) {}

  async listActive(driverId: string, surface = 'home') {
    await this.aggregates.ensureCalendar(driverId);
    return this.prisma.withRetry(() => this.prisma.recommendation.findMany({
      where: {
        driverId,
        surface,
        dismissedAt: null, type: { not: 'fatigue_high' },
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ score: 'desc' }, { generatedAt: 'desc' }],
      take: 10,
    }), 'recommendations.listActive');
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
    await this.aggregates.ensureCalendar(driverId);
    return this.prisma.withRetry(async () => {
      const cached = await this.prisma.recommendation.findMany({
        where: {
          driverId,
          surface: 'decisions',
          dismissedAt: null, type: { not: 'fatigue_high' },
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
          dismissedAt: null, type: { not: 'fatigue_high' },
          expiresAt: { gt: new Date() },
        },
        orderBy: { score: 'desc' },
        take: 3,
      });
    }, 'recommendations.todaysDecisions');
  }

  async generateAndStore(driverId: string) {
    const candidates = await this.generateForDriver(driverId);
    const top = candidates.sort((a, b) => b.score - a.score).slice(0, 6);
    await this.persistHome(driverId, top);
    return top;
  }

  private async generateForDriver(driverId: string): Promise<RecommendationCandidate[]> {
    await this.aggregates.ensureCalendar(driverId);
    const driver = await this.prisma.driver.findUniqueOrThrow({
      where: { id: driverId },
      include: { user: true },
    });
    const locale = (driver.user.locale === 'en' ? 'en' : 'ar') as 'ar' | 'en';

    const today = businessDate(new Date());
    const since7 = addDays(today, -6);
    const since90 = addDays(today, -89);

    const [last7Days, last90Days, apps7d, fuel90d, fuelVehicles] = await Promise.all([
      this.prisma.dailyAggregate.findMany({ where: { driverId, date: { gte: since7, lte: today } } }),
      this.prisma.dailyAggregate.findMany({ where: { driverId, date: { gte: since90, lte: today } } }),
      this.analytics.apps(driverId, 7),
      this.prisma.fuelLog.findMany({
        where: { driverId, deletedAt: null, dateTime: { gte: businessDayForDate(since90).start, lte: new Date() } },
        take: FUEL_EVIDENCE_RECORD_LIMIT + 1,
        orderBy: [{ dateTime: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.vehicle.findMany({ where: { driverId }, select: { id: true, make: true, model: true } }),
    ]);

    const sum7 = sumDays(last7Days);
    const sum90 = sumDays(last90Days);

    const fuelCandidates = fuel90d.length > FUEL_EVIDENCE_RECORD_LIMIT ? [] : fuelComparisonRecommendations(
      fuelVehicles.map((vehicle) => ({ id: vehicle.id, label: [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.id,
        points: fuel90d.filter((row) => row.vehicleId === vehicle.id).map((row) => ({ ...fuelSnapshot(row), id: row.id, dateTime: row.dateTime })) })),
      businessDayForDate(addDays(today, -13)).start, locale);

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

    return [...fuelCandidates, ...generateRecommendations({
      locale,
      recent7d: sum7,
      baseline90d: {
        emptyRatioBp: sum90.emptyRatioBp,
        profitPerKmPiastres: sum90.profitPerKmPiastres,
      },
      appPerformance: apps7d.items.map((a) => ({
        driverAppId: a.driverAppId,
        appName: a.appName,
        profitPerHourPiastres: a.profitPerHourPiastres,
        onlineMinutes: a.onlineMinutes,
      })),
      maintenance,
      monthlyGoal,
    })];
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: (it.payload ?? {}) as any,
          surface: 'decisions',
          generatedAt: now,
          expiresAt: new Date(now.getTime() + it.ttlMinutes * 60_000),
        },
      });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumDays(rows: any[]) {
  const totalKm = rows.reduce((s, r) => s + Number(r.totalKmMeters), 0);
  const paidKm = rows.reduce((s, r) => s + Number(r.paidKmMeters), 0);
  const emptyKm = rows.reduce((s, r) => s + Number(r.emptyKmMeters), 0);
  const net = rows.reduce((s, r) => s + Number(r.netProfitPiastres), 0);
  const minutes = rows.reduce((s, r) => s + r.onlineMinutes, 0);
  return {
    netProfitPiastres: net,
    onlineMinutes: minutes,
    totalKmMeters: totalKm,
    paidKmMeters: paidKm,
    emptyKmMeters: emptyKm,
    emptyRatioBp: totalKm > 0 ? Math.round((emptyKm / totalKm) * 10_000) : 0,
    profitPerKmPiastres: totalKm > 0 ? Math.round((net * 1000) / totalKm) : 0,
    fuelKmPerLiter: 0,
  };
}

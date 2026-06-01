import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type DashboardRange = '1d' | '7d' | '30d' | '90d';

const RANGE_DAYS: Record<DashboardRange, number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

interface Kpi {
  value: number;
  deltaPct: number | null;
  sparkline: number[];
}

function kpi(value: number, deltaPct: number | null = null, sparkline: number[] = []): Kpi {
  return { value, deltaPct, sparkline };
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(range: DashboardRange = '7d') {
    const days = RANGE_DAYS[range];
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 3600_000);
    const prevSince = new Date(now.getTime() - 2 * days * 24 * 3600_000);

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 3600_000);
    const startOfMonth = new Date(now.getTime() - 30 * 24 * 3600_000);
    const since30 = new Date(now.getTime() - 30 * 24 * 3600_000);

    const [
      totalUsers,
      newUsersToday,
      newUsersWeek,
      newUsersMonth,
      newUsersCurrentPeriod,
      newUsersPreviousPeriod,
      activeDrivers30d,
      totalDrivers,
      totalTrips,
      tripsToday,
      tripsWeek,
      tripsMonth,
      tripsCurrentPeriod,
      tripsPreviousPeriod,
      openTickets,
      pendingReviews,
      flaggedPosts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({
        where: { createdAt: { gte: prevSince, lt: since } },
      }),
      this.prisma.trip.findMany({
        where: { startedAt: { gte: since30 } },
        select: { driverId: true },
        distinct: ['driverId'],
      }),
      this.prisma.driver.count(),
      this.prisma.trip.count(),
      this.prisma.trip.count({ where: { startedAt: { gte: startOfToday } } }),
      this.prisma.trip.count({ where: { startedAt: { gte: startOfWeek } } }),
      this.prisma.trip.count({ where: { startedAt: { gte: startOfMonth } } }),
      this.prisma.trip.count({ where: { startedAt: { gte: since } } }),
      this.prisma.trip.count({
        where: { startedAt: { gte: prevSince, lt: since } },
      }),
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.platformReview.count({ where: { isApproved: false } }),
      this.prisma.communityPost.count({ where: { isHidden: false } }).then(() => 0),
    ]);

    const activeDriverCount = activeDrivers30d.length;
    const inactiveDriverCount = Math.max(0, totalDrivers - activeDriverCount);

    const usersGrowthPct = pctDelta(newUsersCurrentPeriod, newUsersPreviousPeriod);
    const tripsGrowthPct = pctDelta(tripsCurrentPeriod, tripsPreviousPeriod);

    return {
      range,
      generatedAt: now.toISOString(),
      users: {
        total: kpi(totalUsers),
        active30d: kpi(activeDriverCount), // proxy: distinct trip authors in 30d
        newToday: kpi(newUsersToday),
        newThisWeek: kpi(newUsersWeek),
        newThisMonth: kpi(newUsersMonth),
      },
      drivers: {
        total: kpi(totalDrivers),
        active: kpi(activeDriverCount),
        inactive: kpi(inactiveDriverCount),
        retentionPct: kpi(totalDrivers > 0 ? (activeDriverCount / totalDrivers) * 100 : 0),
      },
      trips: {
        total: kpi(totalTrips),
        today: kpi(tripsToday),
        weekly: kpi(tripsWeek),
        monthly: kpi(tripsMonth),
      },
      ocr: {
        requests: kpi(0),
        successRatePct: kpi(0),
        failureRatePct: kpi(0),
        meanConfidencePct: kpi(0),
      },
      business: {
        growthRatePct: kpi(usersGrowthPct ?? 0, usersGrowthPct),
        engagementRatePct: kpi(
          totalUsers > 0 ? (activeDriverCount / totalUsers) * 100 : 0,
        ),
        retentionRatePct: kpi(
          totalDrivers > 0 ? (activeDriverCount / totalDrivers) * 100 : 0,
        ),
        conversionRatePct: kpi(tripsGrowthPct ?? 0, tripsGrowthPct),
      },
      queues: {
        openTickets,
        pendingReviews,
        flaggedPosts,
        unreadAlerts: 0,
      },
    };
  }
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

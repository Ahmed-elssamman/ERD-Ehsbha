import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const since30 = new Date(Date.now() - 30 * 86400_000);

    const [
      tripsByApp,
      tripsByDay,
      topDriversByProfit,
      totals,
      tripsByArea,
      topPosts,
      topTicketSubjects,
    ] = await Promise.all([
      this.prisma.trip.groupBy({
        by: ['driverAppId'],
        where: { startedAt: { gte: since30 } },
        _count: { _all: true },
        _sum: { grossPiastres: true },
      }),
      this.prisma.$queryRaw<Array<{ day: Date; trips: bigint; gross: bigint }>>`
        SELECT DATE_TRUNC('day', "started_at")::date AS day,
               COUNT(*)::bigint AS trips,
               SUM("gross_piastres")::bigint AS gross
        FROM trips
        WHERE "started_at" >= ${since30}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      this.prisma.monthlyAggregate.findMany({
        orderBy: { netProfitPiastres: 'desc' },
        take: 10,
        include: { driver: { include: { user: { select: { phone: true } } } } },
      }),
      this.prisma.dailyAggregate.aggregate({
        where: { date: { gte: since30 } },
        _sum: {
          grossPiastres: true,
          netProfitPiastres: true,
          totalKmMeters: true,
          fuelPiastres: true,
        },
      }),
      this.prisma.trip.groupBy({
        by: ['areaId'],
        where: { startedAt: { gte: since30 }, areaId: { not: null } },
        _count: { id: true },
        _sum: { grossPiastres: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.prisma.communityPost.findMany({
        where: { isHidden: false },
        orderBy: { likeCount: 'desc' },
        take: 10,
        include: { driver: { include: { user: { select: { phone: true } } } } },
      }),
      this.prisma.supportTicket.groupBy({
        by: ['category', 'status'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
    ]);

    const appNames = await this.prisma.driverApp.findMany({
      where: { id: { in: tripsByApp.map((t) => t.driverAppId) } },
      include: { appSource: { select: { code: true, name: true } } },
    });
    const appMap = new Map(appNames.map((a) => [a.id, a.appSource.name]));

    const areaIds = tripsByArea.map((a) => a.areaId).filter((x): x is string => !!x);
    const areas = await this.prisma.area.findMany({
      where: { id: { in: areaIds } },
      select: { id: true, name: true },
    });
    const areaMap = new Map(areas.map((a) => [a.id, a.name]));

    return {
      since: since30.toISOString(),
      tripsByApp: tripsByApp.map((t) => ({
        driverAppId: t.driverAppId,
        appName: appMap.get(t.driverAppId) ?? 'Unknown',
        tripCount: t._count?._all ?? 0,
        grossPiastres: Number(t._sum?.grossPiastres ?? 0),
      })),
      tripsByDay: tripsByDay.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        trips: Number(r.trips),
        gross: Number(r.gross),
      })),
      tripsByArea: tripsByArea.map((a) => ({
        areaId: a.areaId,
        areaName: a.areaId ? areaMap.get(a.areaId) ?? 'Unknown' : 'Unknown',
        tripCount: a._count?.id ?? 0,
        grossPiastres: Number(a._sum?.grossPiastres ?? 0),
      })),
      topDriversByProfit: topDriversByProfit.map((m) => ({
        driverId: m.driverId,
        year: m.year,
        month: m.month,
        netProfitPiastres: Number(m.netProfitPiastres),
        grossPiastres: Number(m.grossPiastres),
        phone: m.driver.user.phone,
        displayName: m.driver.displayName,
      })),
      topPosts: topPosts.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        likeCount: p.likeCount,
        dislikeCount: p.dislikeCount,
        driverId: p.driverId,
        driverDisplayName: p.driver.displayName,
        driverPhone: p.driver.user.phone,
        createdAt: p.createdAt.toISOString(),
      })),
      topTicketSubjects: topTicketSubjects.map((t) => ({
        category: t.category,
        status: t.status,
        count: t._count?.id ?? 0,
      })),
      totals: {
        grossPiastres: Number(totals._sum.grossPiastres ?? 0n),
        netProfitPiastres: Number(totals._sum.netProfitPiastres ?? 0n),
        totalKmMeters: Number(totals._sum.totalKmMeters ?? 0n),
        fuelPiastres: Number(totals._sum.fuelPiastres ?? 0n),
      },
    };
  }
}

import { aggregateCoverage } from '../aggregates/aggregate-coverage';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AggregatesService } from '../aggregates/aggregates.service';
import { businessDate, businessDayForDate } from '@ehsbha/shared-types';
import { addDays } from '../../common/utils/date';

@Injectable()
export class AdminAnalyticsService {
  constructor(private prisma: PrismaService, private aggregates: AggregatesService) {}

  async overview() {
    await this.aggregates.assertCalendarsReady();
    const today = businessDate(new Date());
    const sinceDate = addDays(today, -29);
    const since30 = businessDayForDate(sinceDate).start;
    const until = businessDayForDate(today).end;

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
        where: { deletedAt: null, startedAt: { gte: since30, lt: until } },
        _count: { _all: true, grossPiastres: true, commissionPiastres: true },
        _sum: { grossPiastres: true },
      }),
      this.prisma.$queryRaw<Array<{ day: Date; trips: bigint; gross: bigint | null; grossKnown: bigint; commissionKnown: bigint }>>`
        SELECT ("started_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo')::date AS day,
               COUNT(*)::bigint AS trips, COUNT(gross_piastres)::bigint AS "grossKnown", COUNT(commission_piastres)::bigint AS "commissionKnown",
               SUM("gross_piastres")::bigint AS gross
        FROM trips
        WHERE deleted_at IS NULL
          AND "started_at" >= (${since30}::timestamptz AT TIME ZONE 'UTC')
          AND "started_at" < (${until}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      this.prisma.monthlyAggregate.findMany({
        orderBy: { netProfitPiastres: 'desc' },
        take: 10,
        include: { driver: { include: { user: { select: { phone: true } } } } },
      }),
      this.prisma.dailyAggregate.aggregate({
        where: { date: { gte: sinceDate, lte: today } },
        _sum: {
          tripCount: true, grossKnownTripCount: true, commissionKnownTripCount: true, grossPiastres: true,
          netProfitPiastres: true,
          totalKmMeters: true,
          fuelPiastres: true, expensePiastres: true, maintenancePiastres: true, maintAmortPiastres: true,
        },
      }),
      this.prisma.trip.groupBy({
        by: ['areaId'],
        where: { deletedAt: null, startedAt: { gte: since30, lt: until }, areaId: { not: null } },
        _count: { id: true, grossPiastres: true, commissionPiastres: true },
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
        ...aggregateCoverage({ grossPiastres: t._sum.grossPiastres, tripCount: t._count._all, grossKnownTripCount: t._count.grossPiastres, commissionKnownTripCount: t._count.commissionPiastres }),
      })),
      tripsByDay: tripsByDay.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        trips: Number(r.trips),
        gross: Number(r.grossKnown) === Number(r.trips) ? Number(r.gross ?? 0) : null,
        knownGrossPiastres: Number(r.gross ?? 0), grossKnownTripCount: Number(r.grossKnown), commissionKnownTripCount: Number(r.commissionKnown),
      })),
      tripsByArea: tripsByArea.map((a) => ({
        areaId: a.areaId,
        areaName: a.areaId ? areaMap.get(a.areaId) ?? 'Unknown' : 'Unknown',
        tripCount: a._count?.id ?? 0,
        ...aggregateCoverage({ grossPiastres: a._sum.grossPiastres, tripCount: a._count.id, grossKnownTripCount: a._count.grossPiastres, commissionKnownTripCount: a._count.commissionPiastres }),
      })),
      topDriversByProfit: topDriversByProfit.map((m) => ({
        driverId: m.driverId,
        year: m.year,
        month: m.month,
        netProfitPiastres: Number(m.netProfitPiastres),
        ...aggregateCoverage(m),
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
        tripCount: totals._sum.tripCount ?? 0, ...aggregateCoverage(totals._sum),
        netProfitPiastres: Number(totals._sum.netProfitPiastres ?? 0n),
        totalKmMeters: Number(totals._sum.totalKmMeters ?? 0n),
        fuelPiastres: Number(totals._sum.fuelPiastres ?? 0n),
        expensePiastres: Number(totals._sum.expensePiastres ?? 0n), maintenancePiastres: Number(totals._sum.maintenancePiastres ?? 0n), retainedMaintenanceEstimatePiastres: Number(totals._sum.maintAmortPiastres ?? 0n),
      },
    };
  }
}

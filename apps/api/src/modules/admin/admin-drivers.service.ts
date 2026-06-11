import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface ListInput {
  cursor?: string;
  limit: number;
  search?: string;
  baseCity?: string;
}

/**
 * Governed error codes used by this service:
 * - {@link GOVERNED_ERROR_REGISTRY.NOT_FOUND} - when a driver is not found
 * - {@link GOVERNED_ERROR_REGISTRY.ADMIN_PERMISSIONS_STALE} - when admin permissions are stale
 * - {@link GOVERNED_ERROR_REGISTRY.ADMIN_MFA_REQUIRED} - when MFA verification is required for this action
 * - {@link GOVERNED_ERROR_REGISTRY.SESSION_EXPIRED} - when the admin session has expired
 * - {@link GOVERNED_ERROR_REGISTRY.FORBIDDEN} - when admin lacks permission for the action
 */
@Injectable()
export class AdminDriversService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListInput) {
    const where: Prisma.DriverWhereInput = {
      ...(input.baseCity ? { baseCity: input.baseCity } : {}),
      ...(input.search
        ? {
            OR: [
              { displayName: { contains: input.search, mode: 'insensitive' } },
              { user: { phone: { contains: input.search } } },
              { id: input.search },
            ],
          }
        : {}),
    };

    const cursor = input.cursor ? { id: input.cursor } : undefined;
    const items = await this.prisma.driver.findMany({
      where,
      take: input.limit + 1,
      ...(cursor ? { cursor, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { phone: true, status: true } },
        _count: { select: { trips: true, vehicles: true } },
      },
    });

    const driverIds = items.map((d) => d.id);
    const lastTrips = driverIds.length
      ? await this.prisma.trip.groupBy({
          by: ['driverId'],
          where: { driverId: { in: driverIds } },
          _max: { startedAt: true },
        })
      : [];
    const lastTripMap = new Map(lastTrips.map((t) => [t.driverId, t._max.startedAt]));

    const hasNext = items.length > input.limit;
    const page = hasNext ? items.slice(0, input.limit) : items;

    return {
      items: page.map((d) => ({
        id: d.id,
        userId: d.userId,
        displayName: d.displayName,
        phone: d.user.phone,
        baseCity: d.baseCity,
        userStatus: d.user.status,
        vehicleCount: d._count.vehicles,
        tripCount: d._count.trips,
        lastTripAt: lastTripMap.get(d.id)?.toISOString() ?? null,
        joinedAt: d.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async get(id: string) {
    const d = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        user: { select: { phone: true, email: true, locale: true, status: true, createdAt: true } },
        vehicles: { orderBy: { isActive: 'desc' } },
        driverApps: { include: { appSource: true }, orderBy: { createdAt: 'asc' } },
        areas: { orderBy: { name: 'asc' } },
        _count: { select: { trips: true, fuelLogs: true, expenses: true, maintenanceRecords: true } },
      },
    });
    if (!d) throw new NotFoundException({ code: 'DRIVER_NOT_FOUND' });

    const [latestScore, last30Days, totalProfit, scoreHistory, areaBreakdown, appBreakdown] = await Promise.all([
      this.prisma.scoreSnapshot.findFirst({ where: { driverId: id }, orderBy: { date: 'desc' } }),
      this.prisma.dailyAggregate.findMany({
        where: {
          driverId: id,
          date: { gte: new Date(Date.now() - 30 * 86400_000) },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.dailyAggregate.aggregate({
        where: { driverId: id },
        _sum: { netProfitPiastres: true, grossPiastres: true, totalKmMeters: true, fuelPiastres: true, expensePiastres: true },
      }),
      this.prisma.scoreSnapshot.findMany({
        where: { driverId: id },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      this.prisma.areaDailyAggregate.groupBy({
        by: ['areaId'],
        where: { driverId: id },
        _sum: { tripCount: true, grossPiastres: true, netProfitPiastres: true },
        orderBy: { _sum: { grossPiastres: 'desc' } },
        take: 10,
      }),
      this.prisma.appDailyAggregate.groupBy({
        by: ['driverAppId'],
        where: { driverId: id },
        _sum: { tripCount: true, grossPiastres: true, netProfitPiastres: true },
        orderBy: { _sum: { grossPiastres: 'desc' } },
        take: 10,
      }),
    ]);

    const areaIds = areaBreakdown.map((a) => a.areaId);
    const areas = await this.prisma.area.findMany({ where: { id: { in: areaIds } }, select: { id: true, name: true } });
    const areaMap = new Map(areas.map((a) => [a.id, a.name]));

    const appIds = appBreakdown.map((a) => a.driverAppId);
    const apps = await this.prisma.driverApp.findMany({
      where: { id: { in: appIds } },
      include: { appSource: { select: { name: true, code: true } } },
    });
    const appMap = new Map(apps.map((a) => [a.id, a.customName ?? a.appSource.name]));

    return {
      ...d,
      latestScore,
      last30DaysAggregates: last30Days.map((a) => ({
        date: a.date.toISOString().slice(0, 10),
        tripCount: a.tripCount,
        grossPiastres: Number(a.grossPiastres),
        netProfitPiastres: Number(a.netProfitPiastres),
        totalKmMeters: Number(a.totalKmMeters),
      })),
      scoreHistory: scoreHistory
        .map((s) => ({
          date: s.date.toISOString().slice(0, 10),
          overall: s.overall,
          efficiency: s.efficiency,
          profit: s.profit,
          safety: s.safety,
          consistency: s.consistency,
        }))
        .reverse(),
      areaBreakdown: areaBreakdown.map((a) => ({
        areaId: a.areaId,
        areaName: areaMap.get(a.areaId) ?? 'Unknown',
        tripCount: a._sum.tripCount ?? 0,
        grossPiastres: Number(a._sum.grossPiastres ?? 0n),
        netProfitPiastres: Number(a._sum.netProfitPiastres ?? 0n),
      })),
      appBreakdown: appBreakdown.map((a) => ({
        driverAppId: a.driverAppId,
        appName: appMap.get(a.driverAppId) ?? 'Unknown',
        tripCount: a._sum.tripCount ?? 0,
        grossPiastres: Number(a._sum.grossPiastres ?? 0n),
        netProfitPiastres: Number(a._sum.netProfitPiastres ?? 0n),
      })),
      totals: {
        netProfitPiastres: Number(totalProfit._sum.netProfitPiastres ?? 0n),
        grossPiastres: Number(totalProfit._sum.grossPiastres ?? 0n),
        totalKmMeters: Number(totalProfit._sum.totalKmMeters ?? 0n),
        fuelPiastres: Number(totalProfit._sum.fuelPiastres ?? 0n),
        expensePiastres: Number(totalProfit._sum.expensePiastres ?? 0n),
      },
    };
  }

  async recentTrips(driverId: string, limit: number) {
    const trips = await this.prisma.trip.findMany({
      where: { driverId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        driverApp: { include: { appSource: { select: { name: true, code: true } } } },
        area: { select: { name: true } },
      },
    });
    return trips.map((t) => ({
      id: t.id,
      startedAt: t.startedAt.toISOString(),
      endedAt: t.endedAt.toISOString(),
      grossPiastres: t.grossPiastres,
      totalKmMeters: t.totalKmMeters,
      emptyKmMeters: t.emptyKmMeters,
      appName: t.driverApp.customName ?? t.driverApp.appSource.name,
      areaName: t.area?.name ?? null,
    }));
  }
}

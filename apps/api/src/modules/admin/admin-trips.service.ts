import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface ListInput {
  cursor?: string;
  limit: number;
  driverId?: string;
  driverAppId?: string;
  startedAfter?: string;
  startedBefore?: string;
  includeDeleted?: boolean;
}

@Injectable()
export class AdminTripsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListInput) {
    const where: Prisma.TripWhereInput = {
      ...(input.driverId ? { driverId: input.driverId } : {}),
      ...(input.driverAppId ? { driverAppId: input.driverAppId } : {}),
      ...(input.includeDeleted ? {} : { deletedAt: null }),
      ...(input.startedAfter || input.startedBefore
        ? {
            startedAt: {
              ...(input.startedAfter ? { gte: new Date(input.startedAfter) } : {}),
              ...(input.startedBefore ? { lte: new Date(input.startedBefore) } : {}),
            },
          }
        : {}),
    };

    const cursor = input.cursor ? { id: input.cursor } : undefined;
    const items = await this.prisma.trip.findMany({
      where,
      take: input.limit + 1,
      ...(cursor ? { cursor, skip: 1 } : {}),
      orderBy: { startedAt: 'desc' },
      include: {
        driver: { include: { user: { select: { phone: true } } } },
        driverApp: { include: { appSource: { select: { name: true, code: true } } } },
        area: { select: { name: true } },
      },
    });

    const hasNext = items.length > input.limit;
    const page = hasNext ? items.slice(0, input.limit) : items;

    return {
      items: page.map((t) => ({
        id: t.id,
        driverId: t.driverId,
        driverPhone: t.driver.user.phone,
        driverDisplayName: t.driver.displayName,
        driverAppId: t.driverAppId,
        appName: t.driverApp.customName ?? t.driverApp.appSource.name,
        appCode: t.driverApp.appSource.code,
        areaName: t.area?.name ?? null,
        startedAt: t.startedAt.toISOString(),
        endedAt: t.endedAt.toISOString(),
        grossPiastres: t.grossPiastres,
        receivedPiastres: t.receivedPiastres,
        tipPiastres: t.tipPiastres,
        commissionPiastres: t.commissionPiastres,
        tollPiastres: t.tollPiastres,
        parkingPiastres: t.parkingPiastres,
        totalKmMeters: t.totalKmMeters,
        paidKmMeters: t.paidKmMeters,
        emptyKmMeters: t.emptyKmMeters,
        deletedAt: t.deletedAt?.toISOString() ?? null,
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async get(id: string) {
    const t = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        driver: { include: { user: { select: { phone: true, email: true } } } },
        driverApp: { include: { appSource: true } },
        area: true,
        vehicle: { select: { id: true, type: true, make: true, model: true, year: true } },
      },
    });
    if (!t) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    return t;
  }
}

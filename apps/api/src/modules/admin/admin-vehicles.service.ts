import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VehicleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface ListInput {
  cursor?: string;
  limit: number;
  type?: VehicleType;
  isActive?: boolean;
  driverId?: string;
}

/**
 * Governed error codes used by this service:
 * - {@link GOVERNED_ERROR_REGISTRY.NOT_FOUND} - when a vehicle is not found
 * - {@link GOVERNED_ERROR_REGISTRY.ADMIN_PERMISSIONS_STALE} - when admin permissions are stale
 * - {@link GOVERNED_ERROR_REGISTRY.ADMIN_MFA_REQUIRED} - when MFA verification is required for this action
 * - {@link GOVERNED_ERROR_REGISTRY.SESSION_EXPIRED} - when the admin session has expired
 * - {@link GOVERNED_ERROR_REGISTRY.FORBIDDEN} - when admin lacks permission for the action
 */
@Injectable()
export class AdminVehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListInput) {
    const where: Prisma.VehicleWhereInput = {
      ...(input.type ? { type: input.type } : {}),
      ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
      ...(input.driverId ? { driverId: input.driverId } : {}),
    };
    const cursor = input.cursor ? { id: input.cursor } : undefined;
    const items = await this.prisma.vehicle.findMany({
      where,
      take: input.limit + 1,
      ...(cursor ? { cursor, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { include: { user: { select: { phone: true } } } },
        _count: { select: { trips: true, fuelLogs: true, maintenanceRecords: true } },
      },
    });
    const hasNext = items.length > input.limit;
    const page = hasNext ? items.slice(0, input.limit) : items;

    return {
      items: page.map((v) => ({
        id: v.id,
        type: v.type,
        make: v.make,
        model: v.model,
        year: v.year,
        fuelType: v.fuelType,
        isActive: v.isActive,
        odometerMeters: Number(v.odometerMeters),
        driverId: v.driverId,
        driverPhone: v.driver.user.phone,
        driverDisplayName: v.driver.displayName,
        tripCount: v._count.trips,
        fuelLogCount: v._count.fuelLogs,
        maintenanceCount: v._count.maintenanceRecords,
        createdAt: v.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async get(id: string) {
    const v = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        driver: { include: { user: { select: { phone: true } } } },
        _count: { select: { trips: true, fuelLogs: true, maintenanceRecords: true, expenses: true } },
      },
    });
    if (!v) throw new NotFoundException({ code: 'VEHICLE_NOT_FOUND' });
    return v;
  }
}

import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export interface DriverReferences {
  vehicleId?: string | null;
  driverAppId?: string | null;
  areaId?: string | null;
}

/** Also used by service entry points invoked through batch imports and sync. */
export async function assertDriverReferences(
  database: Prisma.TransactionClient,
  driverId: string,
  references: DriverReferences,
): Promise<void> {
  if (references.vehicleId) {
    const vehicle = await database.vehicle.findFirst({
      where: { id: references.vehicleId, driverId },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException({ code: 'NOT_FOUND' });
  }
  if (references.driverAppId) {
    const app = await database.driverApp.findFirst({
      where: { id: references.driverAppId, driverId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException({ code: 'NOT_FOUND' });
  }
  if (references.areaId) {
    const area = await database.area.findFirst({
      where: { id: references.areaId, driverId },
      select: { id: true },
    });
    if (!area) throw new NotFoundException({ code: 'NOT_FOUND' });
  }
}

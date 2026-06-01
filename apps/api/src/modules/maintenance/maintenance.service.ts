import { Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { computeMaintenanceRisk, RiskInput } from '../analytics/engines/maintenance.engine';

export const CreateMaintenanceRecordSchema = z.object({
  maintenanceItemId: z.string().min(1),
  performedAt: z.coerce.date(),
  odometerMeters: z.number().int().min(0),
  costPiastres: z.number().int().min(0),
  notes: z.string().max(500).nullable().optional(),
});
export type CreateMaintenanceRecordDto = z.infer<typeof CreateMaintenanceRecordSchema>;

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  listItems() {
    return this.prisma.maintenanceItem.findMany({ orderBy: { name: 'asc' } });
  }

  async listRecords(driverId: string, vehicleId: string) {
    await this.assertVehicleOwned(driverId, vehicleId);
    return this.prisma.maintenanceRecord.findMany({
      where: { driverId, vehicleId },
      include: { maintenanceItem: true },
      orderBy: { performedAt: 'desc' },
    });
  }

  async addRecord(driverId: string, vehicleId: string, dto: CreateMaintenanceRecordDto) {
    await this.assertVehicleOwned(driverId, vehicleId);
    return this.prisma.maintenanceRecord.create({
      data: {
        driverId,
        vehicleId,
        maintenanceItemId: dto.maintenanceItemId,
        performedAt: dto.performedAt,
        odometerMeters: BigInt(dto.odometerMeters),
        costPiastres: dto.costPiastres,
        notes: dto.notes ?? null,
      },
    });
  }

  async risk(driverId: string, vehicleId: string) {
    const vehicle = await this.assertVehicleOwned(driverId, vehicleId);
    const items = await this.prisma.maintenanceItem.findMany();

    const applicable = items.filter((i) =>
      vehicle.type === 'CAR' ? i.appliesToCar : i.appliesToBike,
    );

    const now = new Date();
    const out = [] as Array<{
      item: typeof items[number];
      status: string;
      risk: number;
      kmSinceLastMeters: number;
      daysSinceLast: number | null;
      lastServiceAt: Date | null;
    }>;

    for (const item of applicable) {
      const last = await this.prisma.maintenanceRecord.findFirst({
        where: { driverId, vehicleId, maintenanceItemId: item.id },
        orderBy: { performedAt: 'desc' },
      });
      const lastKm = last ? Number(last.odometerMeters) : 0;
      const currentKm = Number(vehicle.odometerMeters);
      const input: RiskInput = {
        currentOdoMeters: currentKm,
        lastServiceOdoMeters: lastKm,
        lastServiceAt: last?.performedAt ?? null,
        intervalKm: item.defaultIntervalKm,
        intervalDays: item.defaultIntervalDays,
        now,
      };
      const { risk, status } = computeMaintenanceRisk(input);
      out.push({
        item,
        status,
        risk,
        kmSinceLastMeters: Math.max(0, currentKm - lastKm),
        daysSinceLast: last
          ? Math.floor((now.getTime() - last.performedAt.getTime()) / 86_400_000)
          : null,
        lastServiceAt: last?.performedAt ?? null,
      });
    }

    out.sort((a, b) => b.risk - a.risk);
    return out;
  }

  private async assertVehicleOwned(driverId: string, vehicleId: string) {
    const v = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, driverId } });
    if (!v) throw new NotFoundException({ code: 'VEHICLE_NOT_FOUND' });
    return v;
  }
}

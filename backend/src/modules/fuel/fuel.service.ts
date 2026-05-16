import { Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { AggregatesService } from '../aggregates/aggregates.service';

export const CreateFuelSchema = z.object({
  vehicleId: z.string().min(1),
  dateTime: z.coerce.date(),
  liters: z.number().positive().max(500),
  pricePerLiterPiastres: z.number().int().min(1).max(20000),
  totalPiastres: z.number().int().min(1),
  odometerMeters: z.number().int().min(0),
  isFullTank: z.boolean().default(false),
  notes: z.string().max(500).nullable().optional(),
  clientMutationId: z.string().min(8).max(64).optional(),
});
export type CreateFuelDto = z.infer<typeof CreateFuelSchema>;

export const UpdateFuelSchema = CreateFuelSchema.partial();
export type UpdateFuelDto = z.infer<typeof UpdateFuelSchema>;

export const ListFuelSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListFuelDto = z.infer<typeof ListFuelSchema>;

@Injectable()
export class FuelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregates: AggregatesService,
  ) {}

  list(driverId: string, q: ListFuelDto) {
    const where: any = { driverId };
    if (q.from || q.to) {
      where.dateTime = {};
      if (q.from) where.dateTime.gte = q.from;
      if (q.to) where.dateTime.lte = q.to;
    }
    return this.prisma.fuelLog.findMany({ where, orderBy: { dateTime: 'desc' }, take: q.limit });
  }

  async create(driverId: string, dto: CreateFuelDto) {
    if (dto.clientMutationId) {
      const dup = await this.prisma.fuelLog.findUnique({ where: { clientMutationId: dto.clientMutationId } });
      if (dup) return dup;
    }
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.fuelLog.create({
        data: {
          driverId,
          vehicleId: dto.vehicleId,
          dateTime: dto.dateTime,
          liters: dto.liters,
          pricePerLiterPiastres: dto.pricePerLiterPiastres,
          totalPiastres: dto.totalPiastres,
          odometerMeters: BigInt(dto.odometerMeters),
          isFullTank: dto.isFullTank,
          notes: dto.notes ?? null,
          clientMutationId: dto.clientMutationId ?? null,
        },
      });
      await this.aggregates.applyFuel({
        driverId,
        dateTime: created.dateTime,
        totalPiastres: created.totalPiastres,
        sign: 1,
      }, tx);
      await tx.vehicle.update({
        where: { id: dto.vehicleId },
        data: { odometerMeters: BigInt(Math.max(dto.odometerMeters, 0)) },
      });
      return created;
    });
  }

  async update(driverId: string, id: string, dto: UpdateFuelDto) {
    const existing = await this.prisma.fuelLog.findFirst({ where: { id, driverId } });
    if (!existing) throw new NotFoundException({ code: 'FUEL_NOT_FOUND' });
    return this.prisma.$transaction(async (tx) => {
      await this.aggregates.applyFuel({
        driverId,
        dateTime: existing.dateTime,
        totalPiastres: existing.totalPiastres,
        sign: -1,
      }, tx);
      const updated = await tx.fuelLog.update({
        where: { id },
        data: {
          vehicleId: dto.vehicleId ?? undefined,
          dateTime: dto.dateTime ?? undefined,
          liters: dto.liters ?? undefined,
          pricePerLiterPiastres: dto.pricePerLiterPiastres ?? undefined,
          totalPiastres: dto.totalPiastres ?? undefined,
          odometerMeters: dto.odometerMeters !== undefined ? BigInt(dto.odometerMeters) : undefined,
          isFullTank: dto.isFullTank ?? undefined,
          notes: dto.notes === undefined ? undefined : dto.notes,
        },
      });
      await this.aggregates.applyFuel({
        driverId,
        dateTime: updated.dateTime,
        totalPiastres: updated.totalPiastres,
        sign: 1,
      }, tx);
      return updated;
    });
  }

  async remove(driverId: string, id: string) {
    const existing = await this.prisma.fuelLog.findFirst({ where: { id, driverId } });
    if (!existing) throw new NotFoundException({ code: 'FUEL_NOT_FOUND' });
    await this.prisma.$transaction(async (tx) => {
      await tx.fuelLog.delete({ where: { id } });
      await this.aggregates.applyFuel({
        driverId,
        dateTime: existing.dateTime,
        totalPiastres: existing.totalPiastres,
        sign: -1,
      }, tx);
    });
  }
}

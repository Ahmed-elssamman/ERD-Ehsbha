import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfUtcDay } from '../../common/utils/date';

export const SetDailyOdometerSchema = z.object({
  date: z.coerce.date().optional(),
  totalKmMeters: z.number().int().min(0),
  notes: z.string().max(200).nullable().optional(),
});
export type SetDailyOdometerDto = z.infer<typeof SetDailyOdometerSchema>;

@Injectable()
export class OdometerService {
  constructor(private readonly prisma: PrismaService) {}

  async get(driverId: string, date?: Date) {
    const d = startOfUtcDay(date ?? new Date());
    return this.prisma.dailyOdometer.findUnique({
      where: { driverId_date: { driverId, date: d } },
    });
  }

  /**
   * Driver sets the total km they drove on a given day (from the vehicle odometer).
   * The system stores it AND recomputes the day's empty-km in DailyAggregate:
   *   emptyKm = max(0, totalKm − sum of trip paidKm for that day)
   */
  async set(driverId: string, dto: SetDailyOdometerDto) {
    const date = startOfUtcDay(dto.date ?? new Date());

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.dailyOdometer.upsert({
        where: { driverId_date: { driverId, date } },
        create: {
          driverId,
          date,
          totalKmMeters: BigInt(dto.totalKmMeters),
          notes: dto.notes ?? null,
        },
        update: {
          totalKmMeters: BigInt(dto.totalKmMeters),
          notes: dto.notes ?? null,
        },
      });

      // Recompute empty km for the day
      const nextDay = new Date(date.getTime() + 86_400_000);
      const tripsToday = await tx.trip.findMany({
        where: { driverId, startedAt: { gte: date, lt: nextDay } },
        select: { paidKmMeters: true },
      });
      const paidKmSum = tripsToday.reduce((s, t) => s + t.paidKmMeters, 0);
      const emptyKm = Math.max(0, dto.totalKmMeters - paidKmSum);
      const emptyRatioBp = dto.totalKmMeters > 0
        ? Math.round((emptyKm / dto.totalKmMeters) * 10_000)
        : 0;

      // Update DailyAggregate. If it doesn't exist yet for this date, create it.
      await tx.dailyAggregate.upsert({
        where: { driverId_date: { driverId, date } },
        create: {
          driverId,
          date,
          totalKmMeters: BigInt(dto.totalKmMeters),
          paidKmMeters: BigInt(paidKmSum),
          emptyKmMeters: BigInt(emptyKm),
          emptyRatioBp,
        },
        update: {
          totalKmMeters: BigInt(dto.totalKmMeters),
          emptyKmMeters: BigInt(emptyKm),
          emptyRatioBp,
        },
      });

      return row;
    });
  }
}

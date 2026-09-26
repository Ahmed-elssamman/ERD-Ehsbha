import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfUtcDay } from '../../common/utils/date';
import { businessDate } from '@ehsbha/shared-types';
import { lockDriverWrites } from '../../common/authorization/driver-write-lock';
import { AggregatesService } from '../aggregates/aggregates.service';
import { SetDailyOdometerSchema } from '@ehsbha/api-contracts';

export { SetDailyOdometerSchema };
export type SetDailyOdometerDto = z.infer<typeof SetDailyOdometerSchema>;

@Injectable()
export class OdometerService {
  constructor(private prisma: PrismaService, private aggregates: AggregatesService) {}

  async get(driverId: string, date?: Date) {
    const d = date ? startOfUtcDay(date) : businessDate(new Date());
    return this.prisma.dailyOdometer.findUnique({
      where: { driverId_date: { driverId, date: d } },
    });
  }

  /**
   * Driver sets the total km they drove on a given day (from the vehicle odometer).
   * The recorded total replaces trip distance in daily/weekly/monthly metrics.
   * Totals below the day's paid trip distance are rejected atomically.
   */
  async set(driverId: string, dto: SetDailyOdometerDto) {
    const date = dto.date ? startOfUtcDay(dto.date) : businessDate(new Date());

    return this.prisma.$transaction(async (tx) => {
      await lockDriverWrites(tx, driverId);
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

      await this.aggregates.refreshDays(driverId, [date], tx);

      return row;
    });
  }
}

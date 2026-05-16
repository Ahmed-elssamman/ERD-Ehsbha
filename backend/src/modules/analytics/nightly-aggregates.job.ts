import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AggregatesService } from '../aggregates/aggregates.service';
import { addDays, startOfUtcDay } from '../../common/utils/date';

@Injectable()
export class NightlyAggregatesJob {
  private readonly logger = new Logger(NightlyAggregatesJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregates: AggregatesService,
  ) {}

  @Cron('17 3 * * *', { name: 'nightly-aggregates' })
  async run(): Promise<void> {
    this.logger.log('Nightly aggregates recompute starting');
    const yesterday = startOfUtcDay(addDays(new Date(), -1));
    const drivers = await this.prisma.driver.findMany({ select: { id: true } });

    for (const d of drivers) {
      try {
        await this.recomputeDay(d.id, yesterday);
      } catch (err) {
        this.logger.error(`Driver ${d.id} recompute failed: ${(err as Error).message}`);
      }
    }
    this.logger.log(`Nightly aggregates done for ${drivers.length} drivers`);
  }

  async recomputeDay(driverId: string, date: Date): Promise<void> {
    const next = addDays(date, 1);
    const trips = await this.prisma.trip.findMany({
      where: { driverId, startedAt: { gte: date, lt: next } },
    });
    const fuels = await this.prisma.fuelLog.findMany({
      where: { driverId, dateTime: { gte: date, lt: next } },
    });
    const expenses = await this.prisma.expense.findMany({
      where: { driverId, dateTime: { gte: date, lt: next } },
    });
    const sessions = await this.prisma.session.findMany({
      where: { driverId, startedAt: { gte: date, lt: next }, endedAt: { not: null } },
    });

    await this.prisma.dailyAggregate.deleteMany({ where: { driverId, date } });

    for (const t of trips) {
      await this.aggregates.applyTrip({
        driverId,
        driverAppId: t.driverAppId,
        areaId: t.areaId,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
        grossPiastres: t.grossPiastres,
        tipPiastres: t.tipPiastres,
        commissionPiastres: t.commissionPiastres,
        totalKmMeters: t.totalKmMeters,
        paidKmMeters: t.paidKmMeters,
        emptyKmMeters: t.emptyKmMeters,
        sign: 1,
      });
    }
    for (const f of fuels) {
      await this.aggregates.applyFuel({
        driverId,
        dateTime: f.dateTime,
        totalPiastres: f.totalPiastres,
        sign: 1,
      });
    }
    for (const e of expenses) {
      await this.aggregates.applyExpense({
        driverId,
        dateTime: e.dateTime,
        amountPiastres: e.amountPiastres,
        sign: 1,
      });
    }
    for (const s of sessions) {
      if (!s.endedAt) continue;
      await this.aggregates.applySession({
        driverId,
        driverAppId: s.driverAppId,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        activeMinutes: s.activeMinutes,
        sign: 1,
      });
    }
  }
}

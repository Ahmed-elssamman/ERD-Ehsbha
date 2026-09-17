import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AggregatesService } from '../aggregates/aggregates.service';
import { AGGREGATE_DRIVER_PAGE_SIZE } from '../aggregates/aggregate.control';
import { addDays } from '../../common/utils/date';
import { businessDate, DRIVER_TIME_ZONE } from '@ehsbha/shared-types';

@Injectable()
export class NightlyAggregatesJob {
  private logger = new Logger(NightlyAggregatesJob.name);
  private running = false;

  constructor(private prisma: PrismaService, private aggregates: AggregatesService) {}

  @Cron('17 3 * * *', { name: 'nightly-aggregates', timeZone: DRIVER_TIME_ZONE })
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const yesterday = addDays(businessDate(new Date()), -1);
      let cursor = '';
      while (true) {
        const drivers = await this.prisma.driver.findMany({ select: { id: true }, orderBy: { id: 'asc' },
          take: AGGREGATE_DRIVER_PAGE_SIZE, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
        if (!drivers.length) break;
        for (const driver of drivers) {
          try { await this.recomputeDay(driver.id, yesterday); }
          catch { this.logger.error('Aggregate reconciliation failed; the transaction was rolled back'); }
        }
        cursor = drivers[drivers.length - 1].id;
      }
    } finally { this.running = false; }
  }

  async recomputeDay(driverId: string, date: Date): Promise<void> {
    await this.aggregates.rebuildDay(driverId, date);
  }
}

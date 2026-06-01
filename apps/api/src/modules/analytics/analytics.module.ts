import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { NightlyAggregatesJob } from './nightly-aggregates.job';
import { AggregatesModule } from '../aggregates/aggregates.module';

@Module({
  imports: [AggregatesModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, NightlyAggregatesJob],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

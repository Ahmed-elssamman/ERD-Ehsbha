import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceQueriesService } from './maintenance-queries.service';
import { AggregatesModule } from '../aggregates/aggregates.module';

@Module({
  imports: [AggregatesModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceQueriesService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}

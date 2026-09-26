import { Module } from '@nestjs/common';
import { AggregatesModule } from '../aggregates/aggregates.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportPreferencesService } from './report-preferences.service';
import { ReportDeliveryService } from './report-delivery.service';

@Module({ imports: [AggregatesModule], controllers: [ReportsController], providers: [ReportsService, ReportPreferencesService, ReportDeliveryService] })
export class ReportsModule {}

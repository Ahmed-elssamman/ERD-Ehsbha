import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { GoalsModule } from '../goals/goals.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';

@Module({
  imports: [AnalyticsModule, GoalsModule, MaintenanceModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}

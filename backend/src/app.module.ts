import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { AppsModule } from './modules/apps/apps.module';
import { AreasModule } from './modules/areas/areas.module';
import { TripsModule } from './modules/trips/trips.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { FuelModule } from './modules/fuel/fuel.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { GoalsModule } from './modules/goals/goals.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { ScoreModule } from './modules/score/score.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SyncModule } from './modules/sync/sync.module';
import { HealthModule } from './modules/health/health.module';
import { OdometerModule } from './modules/odometer/odometer.module';
import { CommunityModule } from './modules/community/community.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SupportModule } from './modules/support/support.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    DriversModule,
    VehiclesModule,
    AppsModule,
    AreasModule,
    TripsModule,
    SessionsModule,
    FuelModule,
    ExpensesModule,
    MaintenanceModule,
    GoalsModule,
    AnalyticsModule,
    RecommendationsModule,
    ScoreModule,
    NotificationsModule,
    SyncModule,
    HealthModule,
    OdometerModule,
    CommunityModule,
    ReviewsModule,
    SupportModule,
  ],
})
export class AppModule {}

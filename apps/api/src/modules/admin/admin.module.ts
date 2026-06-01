import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { loadEnv } from '../../config/env';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { AdminAuditService } from './audit.service';
import { AdminPermissionsGuard } from './permissions.decorator';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminDriversController } from './admin-drivers.controller';
import { AdminDriversService } from './admin-drivers.service';
import { AdminTripsController } from './admin-trips.controller';
import { AdminTripsService } from './admin-trips.service';
import { AdminVehiclesController } from './admin-vehicles.controller';
import { AdminVehiclesService } from './admin-vehicles.service';
import { AdminCommunityController } from './admin-community.controller';
import { AdminCommunityService } from './admin-community.service';
import { AdminReviewsController } from './admin-reviews.controller';
import { AdminReviewsService } from './admin-reviews.service';
import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditQueryService } from './admin-audit.service';
import { AdminRolesController } from './admin-roles.controller';
import { AdminRolesService } from './admin-roles.service';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminMiscController } from './admin-misc.controller';
import { AdminManagementController } from './admin-management.controller';
import { AdminManagementService } from './admin-management.service';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsService } from './admin-settings.service';
import { AdminBulkController } from './admin-bulk.controller';
import { AdminBulkService } from './admin-bulk.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => {
        const env = loadEnv();
        return {
          secret: env.ADMIN_JWT_ACCESS_SECRET,
          signOptions: {
            expiresIn: env.ADMIN_JWT_ACCESS_TTL as never,
            issuer: 'ehsbha.admin',
            audience: 'admin-app',
          },
        };
      },
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminUsersController,
    AdminDriversController,
    AdminTripsController,
    AdminVehiclesController,
    AdminCommunityController,
    AdminReviewsController,
    AdminSupportController,
    AdminNotificationsController,
    AdminAuditController,
    AdminRolesController,
    AdminAnalyticsController,
    AdminMiscController,
    AdminManagementController,
    AdminSettingsController,
    AdminBulkController,
  ],
  providers: [
    AdminAuthService,
    AdminJwtStrategy,
    AdminAuditService,
    AdminPermissionsGuard,
    AdminDashboardService,
    AdminUsersService,
    AdminDriversService,
    AdminTripsService,
    AdminVehiclesService,
    AdminCommunityService,
    AdminReviewsService,
    AdminSupportService,
    AdminNotificationsService,
    AdminAuditQueryService,
    AdminRolesService,
    AdminAnalyticsService,
    AdminManagementService,
    AdminSettingsService,
    AdminBulkService,
  ],
  exports: [AdminAuditService],
})
export class AdminModule {}

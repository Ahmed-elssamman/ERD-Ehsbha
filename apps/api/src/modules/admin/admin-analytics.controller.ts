import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { AdminAnalyticsService } from './admin-analytics.service';

@Controller('admin/analytics')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminAnalyticsController {
  constructor(private readonly svc: AdminAnalyticsService) {}

  @Get('overview')
  @RequirePermissions('analytics.read')
  overview() {
    return this.svc.overview();
  }
}

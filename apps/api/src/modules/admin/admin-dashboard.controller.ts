import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { AdminDashboardService, DashboardRange } from './admin-dashboard.service';

const QuerySchema = z.object({
  range: z.enum(['1d', '7d', '30d', '90d']).default('7d'),
});

@Controller('admin/dashboard')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminDashboardController {
  constructor(private readonly svc: AdminDashboardService) {}

  @Get('overview')
  @RequirePermissions('dashboard.read')
  overview(@Query(new ZodValidationPipe(QuerySchema)) q: z.infer<typeof QuerySchema>) {
    return this.svc.overview(q.range as DashboardRange);
  }
}

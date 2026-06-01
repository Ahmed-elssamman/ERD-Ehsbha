import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { AdminNotificationsService } from './admin-notifications.service';

const AlertsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  severity: z.enum(['info', 'medium', 'high', 'critical']).optional(),
  resolved: z.coerce.boolean().optional(),
});

const NotifsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

@Controller('admin/notifications')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminNotificationsController {
  constructor(private readonly svc: AdminNotificationsService) {}

  @Get('alerts')
  @RequirePermissions('notifications.read')
  alerts(@Query(new ZodValidationPipe(AlertsQuerySchema)) q: z.infer<typeof AlertsQuerySchema>) {
    return this.svc.listAlerts(q.cursor, q.limit, q.severity, q.resolved);
  }

  @Get('outbound')
  @RequirePermissions('notifications.read')
  outbound(@Query(new ZodValidationPipe(NotifsQuerySchema)) q: z.infer<typeof NotifsQuerySchema>) {
    return this.svc.listUserNotifications(q.cursor, q.limit);
  }
}

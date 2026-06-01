import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminBulkService } from './admin-bulk.service';
import type { AuthenticatedAdmin } from './admin.types';

const BulkBody = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  reason: z.string().min(3).max(500),
});

const BulkTransitionBody = BulkBody.extend({
  status: z.enum(['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED']),
});

@Controller('admin')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminBulkController {
  constructor(private readonly svc: AdminBulkService) {}

  @Post('drivers/bulk/suspend')
  @RequirePermissions('drivers.suspend')
  bulkSuspendDrivers(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(BulkBody)) dto: z.infer<typeof BulkBody>,
  ) {
    return this.svc.setDriversUserStatus(admin, dto.ids, 'SUSPENDED', dto.reason);
  }

  @Post('drivers/bulk/activate')
  @RequirePermissions('drivers.activate')
  bulkActivateDrivers(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(BulkBody)) dto: z.infer<typeof BulkBody>,
  ) {
    return this.svc.setDriversUserStatus(admin, dto.ids, 'ACTIVE', dto.reason);
  }

  @Post('trips/bulk/delete')
  @RequirePermissions('trips.delete')
  bulkDeleteTrips(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(BulkBody)) dto: z.infer<typeof BulkBody>,
  ) {
    return this.svc.softDeleteTrips(admin, dto.ids, dto.reason);
  }

  @Post('trips/bulk/restore')
  @RequirePermissions('trips.restore')
  bulkRestoreTrips(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(BulkBody)) dto: z.infer<typeof BulkBody>,
  ) {
    return this.svc.restoreTrips(admin, dto.ids, dto.reason);
  }

  @Post('community/posts/bulk/delete')
  @RequirePermissions('community.delete')
  bulkDeletePosts(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(BulkBody)) dto: z.infer<typeof BulkBody>,
  ) {
    return this.svc.deleteCommunityPosts(admin, dto.ids, dto.reason);
  }

  @Post('reviews/bulk/delete')
  @RequirePermissions('reviews.delete')
  bulkDeleteReviews(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(BulkBody)) dto: z.infer<typeof BulkBody>,
  ) {
    return this.svc.deleteReviews(admin, dto.ids, dto.reason);
  }

  @Post('support/tickets/bulk/transition')
  @RequirePermissions('support.transition')
  bulkTransitionTickets(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(BulkTransitionBody)) dto: z.infer<typeof BulkTransitionBody>,
  ) {
    return this.svc.transitionTickets(admin, dto.ids, dto.status, dto.reason);
  }

  @Post('support/tickets/bulk/delete')
  @RequirePermissions('support.close')
  bulkDeleteTickets(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(BulkBody)) dto: z.infer<typeof BulkBody>,
  ) {
    return this.svc.deleteTickets(admin, dto.ids, dto.reason);
  }

  @Post('vehicles/bulk/delete')
  @RequirePermissions('vehicles.delete')
  bulkDeleteVehicles(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(BulkBody)) dto: z.infer<typeof BulkBody>,
  ) {
    return this.svc.deleteVehicles(admin, dto.ids, dto.reason);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminReviewsService } from './admin-reviews.service';
import type { AuthenticatedAdmin } from './admin.types';
// Shared admin review schemas available via @ehsbha/api-contracts (admin schemas in admin-operations.ts)

/** @see {@link OffsetQuerySchema} from `@ehsbha/api-contracts` for pagination shape (offset, limit). Supports sort by createdAt desc and filter by isApproved, isFeatured. */
const ListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  isApproved: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
});

const ReasonBodySchema = z.object({ reason: z.string().min(3).max(500) });

@Controller('admin/reviews')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminReviewsController {
  constructor(private readonly svc: AdminReviewsService) {}

  /**
   * Paginated list of platform reviews.
   * @see {@link OffsetQuerySchema} from `@ehsbha/api-contracts` for pagination shape (offset, limit).
   * Filters: isApproved, isFeatured. Default sort: createdAt desc.
   */
  @Get()
  @RequirePermissions('reviews.read')
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: z.infer<typeof ListQuerySchema>) {
    return this.svc.list(q.cursor, q.limit, q.isApproved, q.isFeatured);
  }

  @Get('summary')
  @RequirePermissions('reviews.read')
  summary() {
    return this.svc.summary();
  }

  @Post(':id/approve')
  @RequirePermissions('reviews.approve')
  approve(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.svc.setApproved(admin, id, true);
  }

  @Post(':id/unapprove')
  @RequirePermissions('reviews.unapprove')
  unapprove(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.svc.setApproved(admin, id, false);
  }

  @Post(':id/feature')
  @RequirePermissions('reviews.feature')
  feature(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.svc.setFeatured(admin, id, true);
  }

  @Post(':id/unfeature')
  @RequirePermissions('reviews.unfeature')
  unfeature(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.svc.setFeatured(admin, id, false);
  }

  @Delete(':id')
  @RequirePermissions('reviews.delete')
  remove(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReasonBodySchema)) dto: z.infer<typeof ReasonBodySchema>,
  ) {
    return this.svc.delete(admin, id, dto.reason);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminCommunityService } from './admin-community.service';
import type { AuthenticatedAdmin } from './admin.types';
// Shared admin community schemas available via @ehsbha/api-contracts (admin schemas in admin-operations.ts)

/** @see {@link OffsetQuerySchema} from `@ehsbha/api-contracts` for pagination shape (offset, limit). Supports sort by createdAt desc and filter by isHidden. */
const ListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  isHidden: z.coerce.boolean().optional(),
});

const ReasonBodySchema = z.object({
  reason: z.string().min(3).max(500),
});

@Controller('admin/community')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminCommunityController {
  constructor(private readonly svc: AdminCommunityService) {}

  /**
   * Paginated list of community posts.
   * @see {@link OffsetQuerySchema} from `@ehsbha/api-contracts` for pagination shape (offset, limit).
   * Filters: isHidden. Default sort: createdAt desc.
   */
  @Get('posts')
  @RequirePermissions('community.read')
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: z.infer<typeof ListQuerySchema>) {
    return this.svc.listPosts(q.cursor, q.limit, q.isHidden);
  }

  @Get('posts/:id')
  @RequirePermissions('community.read')
  get(@Param('id') id: string) {
    return this.svc.getPost(id);
  }

  @Post('posts/:id/hide')
  @RequirePermissions('community.hide')
  hide(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.svc.setHidden(admin, id, true);
  }

  @Post('posts/:id/unhide')
  @RequirePermissions('community.unhide')
  unhide(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.svc.setHidden(admin, id, false);
  }

  @Delete('posts/:id')
  @RequirePermissions('community.delete')
  remove(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReasonBodySchema)) dto: z.infer<typeof ReasonBodySchema>,
  ) {
    return this.svc.delete(admin, id, dto.reason);
  }
}

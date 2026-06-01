import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminCommunityService } from './admin-community.service';
import type { AuthenticatedAdmin } from './admin.types';

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

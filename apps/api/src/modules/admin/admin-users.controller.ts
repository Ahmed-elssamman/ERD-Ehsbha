import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminUsersService } from './admin-users.service';
import type { AuthenticatedAdmin } from './admin.types';

const ListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  search: z.string().optional(),
});

const ActionBodySchema = z.object({
  reason: z.string().min(3).max(500),
  reasonCode: z
    .enum(['POLICY_VIOLATION', 'FRAUD', 'SPAM', 'USER_REQUEST', 'OTHER'])
    .default('OTHER'),
});

const BulkActionBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  reason: z.string().min(3).max(500),
  reasonCode: z
    .enum(['POLICY_VIOLATION', 'FRAUD', 'SPAM', 'USER_REQUEST', 'OTHER'])
    .default('OTHER'),
});

@Controller('admin/users')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminUsersController {
  constructor(private readonly svc: AdminUsersService) {}

  @Get()
  @RequirePermissions('users.read')
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: z.infer<typeof ListQuerySchema>) {
    return this.svc.list(q);
  }

  @Get(':id')
  @RequirePermissions('users.read')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post(':id/suspend')
  @RequirePermissions('users.suspend')
  suspend(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ActionBodySchema)) dto: z.infer<typeof ActionBodySchema>,
  ) {
    return this.svc.setStatus(admin, id, 'SUSPENDED', dto.reason, dto.reasonCode);
  }

  @Post(':id/activate')
  @RequirePermissions('users.activate')
  activate(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ActionBodySchema)) dto: z.infer<typeof ActionBodySchema>,
  ) {
    return this.svc.setStatus(admin, id, 'ACTIVE', dto.reason, dto.reasonCode);
  }

  @Post('bulk/suspend')
  @RequirePermissions('users.suspend')
  bulkSuspend(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(BulkActionBodySchema)) dto: z.infer<typeof BulkActionBodySchema>,
  ) {
    return this.svc.bulkSetStatus(admin, dto.ids, 'SUSPENDED', dto.reason, dto.reasonCode);
  }

  @Post('bulk/activate')
  @RequirePermissions('users.activate')
  bulkActivate(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(BulkActionBodySchema)) dto: z.infer<typeof BulkActionBodySchema>,
  ) {
    return this.svc.bulkSetStatus(admin, dto.ids, 'ACTIVE', dto.reason, dto.reasonCode);
  }

  @Post('bulk/delete')
  @RequirePermissions('users.delete')
  bulkDelete(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(BulkActionBodySchema)) dto: z.infer<typeof BulkActionBodySchema>,
  ) {
    return this.svc.bulkSetStatus(admin, dto.ids, 'DELETED', dto.reason, dto.reasonCode);
  }
}

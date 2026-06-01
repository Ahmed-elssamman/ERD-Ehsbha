import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { AdminAuditQueryService } from './admin-audit.service';

const ListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  actorAdminId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  occurredAfter: z.string().datetime().optional(),
  occurredBefore: z.string().datetime().optional(),
});

@Controller('admin/audit')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminAuditController {
  constructor(private readonly svc: AdminAuditQueryService) {}

  @Get()
  @RequirePermissions('audit.read')
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: z.infer<typeof ListQuerySchema>) {
    return this.svc.list(q);
  }

  @Get('actions')
  @RequirePermissions('audit.read')
  actions() {
    return this.svc.actions();
  }

  @Get(':id')
  @RequirePermissions('audit.read')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }
}

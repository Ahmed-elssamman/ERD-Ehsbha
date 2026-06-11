import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { AdminAuditQueryService } from './admin-audit.service';
// Shared admin audit schemas available via @ehsbha/api-contracts (admin schemas in admin-operations.ts)

/** @see {@link OffsetQuerySchema} from `@ehsbha/api-contracts` for pagination shape (offset, limit). Supports sort by occurredAt desc and filter by actorAdminId, action, targetType, targetId, date range. */
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

  /**
   * Paginated list of audit log entries.
   * @see {@link OffsetQuerySchema} from `@ehsbha/api-contracts` for pagination shape (offset, limit).
   * Filters: actorAdminId, action, targetType, targetId, date range. Default sort: occurredAt desc.
   */
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

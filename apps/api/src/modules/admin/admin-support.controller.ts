import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminSupportService } from './admin-support.service';
import type { AuthenticatedAdmin } from './admin.types';

const ListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED']).optional(),
  category: z.enum(['BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'QUESTION', 'OTHER']).optional(),
});

const TransitionSchema = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED']),
  reason: z.string().min(3).max(500).optional(),
});

const NoteSchema = z.object({
  adminNote: z.string().min(1).max(5000),
});

@Controller('admin/support')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminSupportController {
  constructor(private readonly svc: AdminSupportService) {}

  @Get('tickets')
  @RequirePermissions('support.read')
  list(@Query(new ZodValidationPipe(ListQuerySchema)) q: z.infer<typeof ListQuerySchema>) {
    return this.svc.list(q.cursor, q.limit, q.status, q.category);
  }

  @Get('summary')
  @RequirePermissions('support.read')
  summary() {
    return this.svc.summary();
  }

  @Get('tickets/:id')
  @RequirePermissions('support.read')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post('tickets/:id/transition')
  @RequirePermissions('support.transition')
  transition(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TransitionSchema)) dto: z.infer<typeof TransitionSchema>,
  ) {
    return this.svc.transition(admin, id, dto.status, dto.reason);
  }

  @Post('tickets/:id/note')
  @RequirePermissions('support.reply')
  note(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(NoteSchema)) dto: z.infer<typeof NoteSchema>,
  ) {
    return this.svc.setNote(admin, id, dto.adminNote);
  }
}

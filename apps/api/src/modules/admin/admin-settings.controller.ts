import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminSettingsService } from './admin-settings.service';
import type { AuthenticatedAdmin } from './admin.types';
// Shared admin settings schemas available via @ehsbha/api-contracts (admin schemas in admin-operations.ts)

const UpdateSettingSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(z.any()), z.array(z.any())]),
});

@Controller('admin/settings')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminSettingsController {
  constructor(private readonly svc: AdminSettingsService) {}

  @Get()
  @RequirePermissions('settings.read')
  list() {
    return this.svc.list();
  }

  @Patch(':key')
  @RequirePermissions('settings.update')
  update(
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(UpdateSettingSchema)) dto: z.infer<typeof UpdateSettingSchema>,
  ) {
    return this.svc.update(actor, key, dto.value as never);
  }
}

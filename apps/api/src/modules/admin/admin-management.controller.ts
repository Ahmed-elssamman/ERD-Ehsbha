import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminManagementService } from './admin-management.service';
import type { AuthenticatedAdmin } from './admin.types';

const CreateAdminSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(80),
  roleCodes: z.array(z.string().min(1)).min(1).max(10),
});

const SetActiveSchema = z.object({ isActive: z.boolean() });

const UpdateRolePermsSchema = z.object({
  permissions: z.array(z.string().regex(/^[a-z_]+\.[a-z_]+$/)).max(200),
});

@Controller('admin')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminManagementController {
  constructor(private readonly svc: AdminManagementService) {}

  @Post('admins')
  @RequirePermissions('roles.manage')
  create(
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(CreateAdminSchema)) dto: z.infer<typeof CreateAdminSchema>,
  ) {
    return this.svc.createAdmin(actor, dto);
  }

  @Delete('admins/:id')
  @RequirePermissions('roles.manage')
  remove(@CurrentAdmin() actor: AuthenticatedAdmin, @Param('id') id: string) {
    return this.svc.deleteAdmin(actor, id);
  }

  @Patch('admins/:id/active')
  @RequirePermissions('roles.manage')
  setActive(
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetActiveSchema)) dto: z.infer<typeof SetActiveSchema>,
  ) {
    return this.svc.setAdminActive(actor, id, dto.isActive);
  }

  @Patch('roles/:id/permissions')
  @RequirePermissions('roles.manage')
  setRolePerms(
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRolePermsSchema)) dto: z.infer<typeof UpdateRolePermsSchema>,
  ) {
    return this.svc.updateRolePermissions(actor, id, dto.permissions);
  }
}

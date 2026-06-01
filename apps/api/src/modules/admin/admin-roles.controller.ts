import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { AdminRolesService } from './admin-roles.service';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminRolesController {
  constructor(private readonly svc: AdminRolesService) {}

  @Get('roles')
  @RequirePermissions('roles.read')
  roles() {
    return this.svc.listRoles();
  }

  @Get('permissions')
  @RequirePermissions('roles.read')
  permissions() {
    return this.svc.listPermissions();
  }

  @Get('admins')
  @RequirePermissions('roles.read')
  admins() {
    return this.svc.listAdmins();
  }
}

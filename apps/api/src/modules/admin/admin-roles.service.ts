import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles() {
    const rows = await this.prisma.adminRole.findMany({
      orderBy: { isSystem: 'desc' },
      include: {
        permissionLinks: { include: { permission: true } },
        _count: { select: { userLinks: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissionCount: r.permissionLinks.length,
      userCount: r._count.userLinks,
      permissions: r.permissionLinks.map((pl) => `${pl.permission.scope}.${pl.permission.action}`),
    }));
  }

  async listPermissions() {
    const rows = await this.prisma.adminPermission.findMany({ orderBy: [{ scope: 'asc' }, { action: 'asc' }] });
    return rows.map((p) => ({ id: p.id, scope: p.scope, action: p.action, description: p.description }));
  }

  async listAdmins() {
    const rows = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
      include: { roleLinks: { include: { role: true } } },
    });
    return rows.map((a) => ({
      id: a.id,
      email: a.email,
      displayName: a.displayName,
      isActive: a.isActive,
      mfaEnabled: a.mfaEnabled,
      lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      roles: a.roleLinks.map((r) => r.role.code),
    }));
  }
}

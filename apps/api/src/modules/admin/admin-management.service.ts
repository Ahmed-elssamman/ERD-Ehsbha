import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './audit.service';
import type { AuthenticatedAdmin } from './admin.types';

interface CreateAdminInput {
  email: string;
  password: string;
  displayName: string;
  roleCodes: string[];
}

@Injectable()
export class AdminManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async createAdmin(actor: AuthenticatedAdmin, input: CreateAdminInput) {
    const email = input.email.toLowerCase().trim();
    const existing = await this.prisma.adminUser.findUnique({ where: { email } });
    if (existing) throw new BadRequestException({ code: 'ADMIN_EMAIL_TAKEN' });

    const roles = await this.prisma.adminRole.findMany({ where: { code: { in: input.roleCodes } } });
    if (roles.length !== input.roleCodes.length) {
      throw new BadRequestException({ code: 'ADMIN_ROLE_NOT_FOUND' });
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const admin = await this.prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        displayName: input.displayName,
        isActive: true,
        createdById: actor.id,
        roleLinks: { create: roles.map((r) => ({ roleId: r.id })) },
      },
    });

    await this.audit.record({
      actor,
      action: 'roles.manage',
      targetType: 'AdminUser',
      targetId: admin.id,
      after: { email: admin.email, displayName: admin.displayName, roles: roles.map((r) => r.code) },
      reason: 'Create admin',
    });

    return { id: admin.id, email: admin.email, displayName: admin.displayName };
  }

  async deleteAdmin(actor: AuthenticatedAdmin, id: string) {
    if (id === actor.id) {
      throw new BadRequestException({ code: 'ADMIN_CANNOT_DELETE_SELF' });
    }
    const before = await this.prisma.adminUser.findUnique({
      where: { id },
      include: { roleLinks: { include: { role: true } } },
    });
    if (!before) throw new NotFoundException({ code: 'ADMIN_NOT_FOUND' });

    await this.prisma.adminUser.delete({ where: { id } });
    await this.audit.record({
      actor,
      action: 'roles.manage',
      targetType: 'AdminUser',
      targetId: id,
      before: {
        email: before.email,
        displayName: before.displayName,
        roles: before.roleLinks.map((rl) => rl.role.code),
      },
      reason: 'Delete admin',
    });
    return { ok: true };
  }

  async setAdminActive(actor: AuthenticatedAdmin, id: string, isActive: boolean) {
    if (id === actor.id && !isActive) {
      throw new BadRequestException({ code: 'ADMIN_CANNOT_DEACTIVATE_SELF' });
    }
    const before = await this.prisma.adminUser.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!before) throw new NotFoundException({ code: 'ADMIN_NOT_FOUND' });
    const after = await this.prisma.adminUser.update({
      where: { id },
      data: { isActive, permissionsVersion: { increment: 1 } },
      select: { id: true, isActive: true },
    });
    if (!isActive) {
      await this.prisma.adminRefreshToken.updateMany({
        where: { adminUserId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.record({
      actor,
      action: 'roles.manage',
      targetType: 'AdminUser',
      targetId: id,
      before,
      after,
      reason: isActive ? 'Activate admin' : 'Deactivate admin',
    });
    return after;
  }

  async updateRolePermissions(actor: AuthenticatedAdmin, roleId: string, permissionCodes: string[]) {
    const role = await this.prisma.adminRole.findUnique({
      where: { id: roleId },
      include: { permissionLinks: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException({ code: 'ROLE_NOT_FOUND' });
    if (role.code === 'super_admin') {
      throw new BadRequestException({
        code: 'ROLE_IMMUTABLE',
        message: 'The super_admin role cannot be edited (it always has all permissions).',
      });
    }

    const before = role.permissionLinks
      .map((pl) => `${pl.permission.scope}.${pl.permission.action}`)
      .sort();

    // Look up permission ids for the requested codes.
    const allPerms = await this.prisma.adminPermission.findMany();
    const permByCode = new Map(allPerms.map((p) => [`${p.scope}.${p.action}`, p.id]));
    const requestedIds: number[] = [];
    for (const code of permissionCodes) {
      const id = permByCode.get(code);
      if (id == null) {
        throw new BadRequestException({
          code: 'UNKNOWN_PERMISSION',
          message: `Unknown permission: ${code}`,
        });
      }
      requestedIds.push(id);
    }

    await this.prisma.$transaction([
      this.prisma.adminRolePermission.deleteMany({ where: { roleId } }),
      ...(requestedIds.length > 0
        ? [
            this.prisma.adminRolePermission.createMany({
              data: requestedIds.map((pid) => ({ roleId, permissionId: pid })),
            }),
          ]
        : []),
      // Bump permissions_version for every admin holding this role so their
      // live tokens are forced to re-authenticate.
      this.prisma.adminUser.updateMany({
        where: { roleLinks: { some: { roleId } } },
        data: { permissionsVersion: { increment: 1 } },
      }),
    ]);

    const after = [...permissionCodes].sort();
    await this.audit.record({
      actor,
      action: 'roles.manage',
      targetType: 'AdminRole',
      targetId: roleId,
      before,
      after,
      reason: `Update permissions for role ${role.code}`,
    });

    return { id: roleId, permissions: after };
  }
}

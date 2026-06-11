import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface ListInput {
  cursor?: string;
  limit: number;
  actorAdminId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  occurredAfter?: string;
  occurredBefore?: string;
}

/**
 * Governed error codes used by this service:
 * - {@link GOVERNED_ERROR_REGISTRY.NOT_FOUND} - when an audit log entry is not found
 * - {@link GOVERNED_ERROR_REGISTRY.ADMIN_PERMISSIONS_STALE} - when admin permissions are stale
 * - {@link GOVERNED_ERROR_REGISTRY.ADMIN_MFA_REQUIRED} - when MFA verification is required for this action
 * - {@link GOVERNED_ERROR_REGISTRY.SESSION_EXPIRED} - when the admin session has expired
 * - {@link GOVERNED_ERROR_REGISTRY.FORBIDDEN} - when admin lacks permission for the action
 */
@Injectable()
export class AdminAuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListInput) {
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(input.actorAdminId ? { actorAdminId: input.actorAdminId } : {}),
      ...(input.action ? { action: input.action } : {}),
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.targetId ? { targetId: input.targetId } : {}),
      ...(input.occurredAfter || input.occurredBefore
        ? {
            occurredAt: {
              ...(input.occurredAfter ? { gte: new Date(input.occurredAfter) } : {}),
              ...(input.occurredBefore ? { lte: new Date(input.occurredBefore) } : {}),
            },
          }
        : {}),
    };
    const items = await this.prisma.adminAuditLog.findMany({
      where,
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      orderBy: { occurredAt: 'desc' },
      include: { actor: { select: { email: true, displayName: true } } },
    });
    const hasNext = items.length > input.limit;
    const page = hasNext ? items.slice(0, input.limit) : items;
    return {
      items: page.map((r) => ({
        id: r.id,
        actorAdminId: r.actorAdminId,
        actorEmail: r.actor.email,
        actorDisplayName: r.actor.displayName,
        actorRole: r.actorRole,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        reasonCode: r.reasonCode,
        ip: r.ip,
        occurredAt: r.occurredAt.toISOString(),
        hasBefore: r.before !== null,
        hasAfter: r.after !== null,
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async get(id: string) {
    const r = await this.prisma.adminAuditLog.findUnique({
      where: { id },
      include: { actor: { select: { email: true, displayName: true } } },
    });
    if (!r) throw new NotFoundException({ code: 'AUDIT_NOT_FOUND' });
    return r;
  }

  async actions() {
    const rows = await this.prisma.adminAuditLog.groupBy({
      by: ['action'],
      _count: { _all: true },
      orderBy: { _count: { action: 'desc' } },
      take: 50,
    });
    return rows.map((r) => ({ action: r.action, count: r._count._all }));
  }
}

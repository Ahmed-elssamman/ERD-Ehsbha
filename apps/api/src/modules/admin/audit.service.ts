import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedAdmin } from './admin.types';

export interface AuditRecordInput {
  actor: AuthenticatedAdmin;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  reasonCode?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: {
        actorAdminId: input.actor.id,
        actorRole: input.actor.roles[0] ?? 'unknown',
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before:
          input.before === undefined || input.before === null
            ? Prisma.JsonNull
            : (input.before as Prisma.InputJsonValue),
        after:
          input.after === undefined || input.after === null
            ? Prisma.JsonNull
            : (input.after as Prisma.InputJsonValue),
        reason: input.reason ?? null,
        reasonCode: input.reasonCode ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
      },
    });
  }
}

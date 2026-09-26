import { Injectable } from '@nestjs/common';
import { IdempotencyStatus, Prisma, type IdempotencyRecord } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ClaimResult, IdempotencyScope } from './idempotency.types';

@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claim(
    scope: IdempotencyScope,
    requestHash: string,
    expiresAt: Date,
  ): Promise<ClaimResult> {
    await this.prisma.idempotencyRecord.deleteMany({
      where: {
        realm: scope.realm,
        actorId: scope.actorId,
        operationId: scope.operationId,
        key: scope.key,
        OR: [
          { expiresAt: { lte: new Date() } },
          { status: IdempotencyStatus.RETRYABLE_FAILURE },
        ],
      },
    });

    try {
      const record = await this.prisma.idempotencyRecord.create({
        data: {
          ...scope,
          requestHash,
          expiresAt,
          status: IdempotencyStatus.IN_PROGRESS,
        },
      });
      return { kind: 'claimed', record };
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
      const existing = await this.load(scope);
      if (!existing) throw error;
      return { kind: 'existing', record: existing };
    }
  }

  load(scope: IdempotencyScope): Promise<IdempotencyRecord | null> {
    return this.prisma.idempotencyRecord.findUnique({
      where: {
        realm_actorId_operationId_key: scope,
      },
    });
  }

  complete(recordId: string, responseStatus: number, responseBody: Prisma.InputJsonValue) {
    return this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseStatus,
        responseBody,
        completedAt: new Date(),
      },
    });
  }

  markRetryableFailure(recordId: string) {
    return this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: IdempotencyStatus.RETRYABLE_FAILURE,
        responseStatus: null,
        responseBody: Prisma.DbNull,
        completedAt: null,
      },
    });
  }

  expire(now = new Date()) {
    return this.prisma.idempotencyRecord.deleteMany({
      where: { expiresAt: { lte: now } },
    });
  }
}

function isUniqueConstraint(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

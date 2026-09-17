import { ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { syncMutationSchema } from '@ehsbha/api-contracts';
import { SyncMutationKind, SyncMutationStatus } from '@ehsbha/shared-types';
import { syncFailure } from './sync-errors';

describe('sync failure classification', () => {
  const mutation = syncMutationSchema.parse({ clientMutationId: 'test-session-start', kind: SyncMutationKind.SessionStart, payload: { driverAppId: 'app' } });
  it('preserves governed conflict and not-found meanings', () => {
    expect(syncFailure(mutation, new ConflictException({ code: 'SESSION_ALREADY_OPEN' })).status).toBe(SyncMutationStatus.Conflict);
    expect(syncFailure(mutation, new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' })).error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(syncFailure(mutation, new NotFoundException({ code: 'NOT_FOUND' })).status).toBe(SyncMutationStatus.NotFound);
  });
  it('keeps private internals out of responses', () => {
    for (const error of [new Error('private SQL and financial payload'), new HttpException({ code: 'PRIVATE_CODE', message: 'private details' }, 500)]) {
      const result = syncFailure(mutation, error);
      expect(result.status).toBe(SyncMutationStatus.InternalError);
      expect(JSON.stringify(result)).not.toContain('private');
      expect(result.error).toEqual({ code: 'INTERNAL_ERROR', messageKey: 'errors.internalError' });
    }
  });
  it('marks transaction contention as retryable with the same identity', () => {
    const error = new Prisma.PrismaClientKnownRequestError('private database details', { code: 'P2034', clientVersion: 'test' });
    const result = syncFailure(mutation, error);
    expect(result.status).toBe(SyncMutationStatus.RetryableError);
    expect(result.error.code).toBe('SERVICE_UNAVAILABLE');
  });
  it('reports invalid produced records as internal contract failures without exposing values', () => {
    const parsed = z.object({ status: z.enum(['valid']) }).safeParse({ status: 'private stored value' });
    if (parsed.success) throw new Error('Expected an invalid produced record');
    const result = syncFailure(mutation, parsed.error);
    expect(result.status).toBe(SyncMutationStatus.InternalError);
    expect(result.error).toEqual({ code: 'CONTRACT_VIOLATION', messageKey: 'errors.contractViolation' });
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('uses the existing connectivity classification for database and adapter outages', () => {
    for (const error of [new Prisma.PrismaClientKnownRequestError('private connection information', { code: 'P1017', clientVersion: 'test' }),
      new Error('Connection terminated with private provider details')]) {
      const result = syncFailure(mutation, error);
      expect(result.status).toBe(SyncMutationStatus.RetryableError);
      expect(result.error).toEqual({ code: 'SERVICE_UNAVAILABLE', messageKey: 'errors.serviceUnavailable' });
    }
  });
});

import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { IdempotencyStatus, Prisma } from '@prisma/client';
import { IdempotencyRepository } from './idempotency.repository';
import type { BeginResult, IdempotencyScope } from './idempotency.types';

const DEFAULT_RETENTION_HOURS = 24;
const MAX_REPLAY_BYTES = 64 * 1024;
const FORBIDDEN_REPLAY_KEYS = /password|secret|token|authorization|cookie|mfa|image|credential/i;

@Injectable()
export class IdempotencyService {
  constructor(private readonly repository: IdempotencyRepository) {}

  hashRequest(payload: unknown): string {
    return createHash('sha256').update(canonicalJson(payload)).digest('hex');
  }

  async begin(
    scope: IdempotencyScope,
    payload: unknown,
    retentionHours = DEFAULT_RETENTION_HOURS,
  ): Promise<BeginResult> {
    validateKey(scope.key);
    const requestHash = this.hashRequest(payload);
    const expiresAt = new Date(Date.now() + retentionHours * 60 * 60 * 1000);
    const claim = await this.repository.claim(scope, requestHash, expiresAt);

    if (claim.kind === 'claimed') {
      return { kind: 'execute', recordId: claim.record.id, requestHash };
    }
    if (claim.record.requestHash !== requestHash) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'Idempotency key was already used with a different request',
      });
    }
    if (claim.record.status === IdempotencyStatus.IN_PROGRESS) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_IN_PROGRESS',
        message: 'An identical request is still in progress',
        retryAfterSeconds: 1,
      });
    }
    if (
      claim.record.status === IdempotencyStatus.COMPLETED
      && claim.record.responseStatus !== null
      && claim.record.responseBody !== null
    ) {
      return {
        kind: 'replay',
        response: {
          status: claim.record.responseStatus,
          body: claim.record.responseBody,
        },
      };
    }
    return { kind: 'execute', recordId: claim.record.id, requestHash };
  }

  async complete(recordId: string, responseStatus: number, body: unknown): Promise<void> {
    const safeBody = sanitizeReplayBody(body);
    await this.repository.complete(recordId, responseStatus, safeBody);
  }

  async markRetryableFailure(recordId: string): Promise<void> {
    await this.repository.markRetryableFailure(recordId);
  }
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Idempotency payload contains a non-finite number');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  throw new TypeError(`Unsupported idempotency payload value: ${typeof value}`);
}

function sanitizeReplayBody(body: unknown): Prisma.InputJsonValue {
  const canonical = canonicalize(body);
  if (canonical === null) {
    throw new TypeError('Idempotency replay body must not be null');
  }
  assertReplaySafe(canonical);
  const serialized = JSON.stringify(canonical);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_REPLAY_BYTES) {
    throw new TypeError('Idempotency replay body exceeds 64 KiB');
  }
  return canonical;
}

function assertReplaySafe(value: unknown, path = ''): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertReplaySafe(child, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_REPLAY_KEYS.test(key)) {
      throw new TypeError(`Idempotency replay body contains forbidden field: ${path}${key}`);
    }
    assertReplaySafe(child, `${path}${key}.`);
  }
}

function validateKey(key: string): void {
  if (key.length < 8 || key.length > 128 || !/^[\x21-\x7e]+$/.test(key)) {
    throw new ConflictException({
      code: 'VALIDATION_ERROR',
      message: 'Idempotency-Key must contain 8 to 128 visible ASCII characters',
    });
  }
}

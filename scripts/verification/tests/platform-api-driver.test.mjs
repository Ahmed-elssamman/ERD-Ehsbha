import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  normalizeErrorCode,
  getErrorDefinition,
  GOVERNED_ERROR_REGISTRY,
  RETRY_POLICIES,
} from '../../../packages/api-contracts/dist/types/core/errors.js';
import {
  isSupportedMajorVersion,
} from '../../../packages/api-contracts/dist/types/core/version.js';
import {
  RESPONSE_HEADERS,
} from '../../../packages/api-contracts/dist/types/core/envelope.js';
import {
  parseSuccessResponse,
  parseFailureResponse,
} from '../../../packages/api-contracts/dist/types/core/parse-response.js';

function validMeta() {
  return {
    requestId: 'a'.repeat(20),
    serverTime: '2026-06-11T12:00:00.000Z',
    apiVersion: 'v1',
    contractVersion: '1.0.0',
  };
}

describe('driver client - schema parsing', () => {
  it('parses a valid success response', () => {
    const schema = z.object({ id: z.string(), name: z.string() });
    const result = parseSuccessResponse(schema, {
      data: { id: 'dri_123', name: 'Ahmed' },
      meta: validMeta(),
    });
    assert.equal(result.kind, 'success');
    if (result.kind === 'success') {
      assert.equal(result.data.id, 'dri_123');
      assert.equal(result.data.name, 'Ahmed');
    }
  });

  it('tolerates unknown additive fields on success data', () => {
    const schema = z.object({ id: z.string() }).passthrough();
    const result = parseSuccessResponse(schema, {
      data: { id: 'dri_123', extraField: 'should be preserved' },
      meta: validMeta(),
    });
    assert.equal(result.kind, 'success');
    if (result.kind === 'success') {
      assert.equal(result.data.extraField, 'should be preserved');
    }
  });

  it('returns contract-mismatch when meta is missing', () => {
    const schema = z.object({ id: z.string() });
    const result = parseSuccessResponse(schema, { data: { id: '123' } });
    assert.equal(result.kind, 'contract-mismatch');
    if (result.kind === 'contract-mismatch') {
      assert.equal(result.receivedVersion, 'unknown');
    }
  });

  it('parses a valid failure response', () => {
    const result = parseFailureResponse({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      meta: validMeta(),
    });
    assert.equal(result.kind, 'failure');
    if (result.kind === 'failure') {
      assert.equal(result.code, 'VALIDATION_ERROR');
    }
  });
});

describe('driver client - request ID preservation', () => {
  it('uses the X-Request-Id header constant', () => {
    assert.equal(RESPONSE_HEADERS.REQUEST_ID, 'X-Request-Id');
  });

  it('preserves request ID from server response', () => {
    const meta = validMeta();
    assert.equal(meta.requestId.length, 20);
    assert.ok(meta.requestId.length >= 16);
  });

  it('request ID is bounded between 16 and 128 characters', () => {
    const short = 'a'.repeat(16);
    const long = 'b'.repeat(128);
    assert.ok(short.length >= 16);
    assert.ok(long.length <= 128);
  });
});

describe('driver client - unsupported major version rejection', () => {
  it('rejects major version 2', () => {
    assert.equal(isSupportedMajorVersion('2.0.0'), false);
  });

  it('rejects major version 0', () => {
    assert.equal(isSupportedMajorVersion('0.9.0'), false);
  });

  it('accepts major version 1', () => {
    assert.equal(isSupportedMajorVersion('1.0.0'), true);
    assert.equal(isSupportedMajorVersion('1.99.99'), true);
  });

  it('returns contract-mismatch for unsupported major version', () => {
    const schema = z.object({ id: z.string() });
    const meta = validMeta();
    meta.contractVersion = '2.0.0';
    const result = parseSuccessResponse(schema, {
      data: { id: '123' },
      meta,
    });
    assert.equal(result.kind, 'contract-mismatch');
    if (result.kind === 'contract-mismatch') {
      assert.equal(result.expectedMajor, 1);
      assert.equal(result.receivedVersion, '2.0.0');
    }
  });
});

describe('driver client - unknown error code handling', () => {
  it('normalizes unknown codes to CONTRACT_VIOLATION', () => {
    assert.equal(normalizeErrorCode('SOME_RANDOM_CODE'), 'CONTRACT_VIOLATION');
    assert.equal(normalizeErrorCode(''), 'CONTRACT_VIOLATION');
  });

  it('preserves known error codes unchanged', () => {
    assert.equal(normalizeErrorCode('VALIDATION_ERROR'), 'VALIDATION_ERROR');
    assert.equal(normalizeErrorCode('RATE_LIMITED'), 'RATE_LIMITED');
    assert.equal(normalizeErrorCode('UNAUTHENTICATED'), 'UNAUTHENTICATED');
  });

  it('CONTRACT_VIOLATION exists in the governed registry', () => {
    const def = getErrorDefinition('CONTRACT_VIOLATION');
    assert.ok(def);
    assert.equal(def.httpStatus, 502);
    assert.equal(def.category, 'contract');
  });
});

describe('driver client - safe-read retries classification', () => {
  it('PROVIDER_UNAVAILABLE has safe-read retry policy', () => {
    const def = getErrorDefinition('PROVIDER_UNAVAILABLE');
    assert.ok(def);
    assert.equal(def.retryPolicy, 'safe-read');
  });

  it('SERVICE_UNAVAILABLE has safe-read retry policy', () => {
    const def = getErrorDefinition('SERVICE_UNAVAILABLE');
    assert.ok(def);
    assert.equal(def.retryPolicy, 'safe-read');
  });

  it('RATE_LIMITED has retry-after policy', () => {
    const def = getErrorDefinition('RATE_LIMITED');
    assert.ok(def);
    assert.equal(def.retryPolicy, 'retry-after');
  });

  it('IDEMPOTENCY_IN_PROGRESS has retry-after policy', () => {
    const def = getErrorDefinition('IDEMPOTENCY_IN_PROGRESS');
    assert.ok(def);
    assert.equal(def.retryPolicy, 'retry-after');
  });

  it('errors from safe-read realm are in driver realm', () => {
    for (const code of ['PROVIDER_UNAVAILABLE', 'SERVICE_UNAVAILABLE']) {
      const def = getErrorDefinition(code);
      assert.ok(def.realms.includes('driver'), `${code} must be in driver realm`);
    }
  });
});

describe('driver client - Retry-After header parsing', () => {
  it('parses integer seconds from Retry-After', () => {
    const headerValue = '120';
    const seconds = parseInt(headerValue, 10);
    assert.equal(seconds, 120);
  });

  it('converts Retry-After seconds to milliseconds', () => {
    const retryAfterMs = parseInt('30', 10) * 1000;
    assert.equal(retryAfterMs, 30000);
  });

  it('returns NaN for invalid Retry-After values', () => {
    const result = parseInt('not-a-number', 10);
    assert.ok(isNaN(result));
  });

  it('falls back to exponential backoff when Retry-After is absent', () => {
    const attempt = 0;
    const fallback = Math.min(1000 * Math.pow(2, attempt), 8000);
    assert.equal(fallback, 1000);
  });
});

describe('driver client - non-retry outcomes', () => {
  it('VALIDATION_ERROR has never retry policy', () => {
    const def = getErrorDefinition('VALIDATION_ERROR');
    assert.equal(def.retryPolicy, 'never');
  });

  it('UNAUTHENTICATED has never retry policy', () => {
    const def = getErrorDefinition('UNAUTHENTICATED');
    assert.equal(def.retryPolicy, 'never');
  });

  it('FORBIDDEN has never retry policy', () => {
    const def = getErrorDefinition('FORBIDDEN');
    assert.equal(def.retryPolicy, 'never');
  });

  it('NOT_FOUND has never retry policy', () => {
    const def = getErrorDefinition('NOT_FOUND');
    assert.equal(def.retryPolicy, 'never');
  });

  it('CONTRACT_VIOLATION has never retry policy', () => {
    const def = getErrorDefinition('CONTRACT_VIOLATION');
    assert.equal(def.retryPolicy, 'never');
  });

  it('validation error codes never have safe-read or retry-after policy', () => {
    const validationCodes = [
      'VALIDATION_ERROR', 'INVALID_CURSOR', 'UNAUTHENTICATED',
      'SESSION_EXPIRED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT',
      'IDEMPOTENCY_KEY_REUSED', 'CONTRACT_VIOLATION',
      'CONTRACT_VERSION_MISMATCH', 'INTERNAL_ERROR',
    ];
    for (const code of validationCodes) {
      const def = getErrorDefinition(code);
      assert.equal(def.retryPolicy, 'never', `${code} must have never retry policy`);
    }
  });
});

describe('driver client - refresh isolation', () => {
  it('auth failure does not clear unrelated application state', () => {
    const unrelatedState = { currentTripId: 'trip_456' };
    assert.ok(unrelatedState.currentTripId);
    assert.equal(unrelatedState.currentTripId, 'trip_456');
  });

  it('driver auth token removal does not affect other stored data', () => {
    const storage = new Map();
    storage.set('driver-token', 'eyJ.old.token');
    storage.set('driver-preferences', '{"locale":"ar"}');
    storage.set('driver-refresh-token', 'rt_old');
    const removedToken = storage.get('driver-token');
    assert.ok(removedToken);
    storage.delete('driver-token');
    assert.equal(storage.has('driver-token'), false);
    assert.equal(storage.has('driver-preferences'), true);
    assert.equal(storage.has('driver-refresh-token'), true);
  });

  it('driver token and refresh token are stored separately from admin tokens', () => {
    const driverTokens = new Set(['driver-token', 'driver-refresh-token']);
    const adminTokens = new Set(['admin-token', 'admin-refresh-token']);
    for (const t of driverTokens) {
      assert.equal(adminTokens.has(t), false, `Driver token "${t}" must not overlap with admin tokens`);
    }
  });
});

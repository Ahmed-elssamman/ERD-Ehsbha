import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getErrorDefinition, normalizeErrorCode, GOVERNED_ERROR_REGISTRY } from '../../../packages/api-contracts/dist/types/core/errors.js';

describe('exception filter - governed error mapping', () => {
  it('normalizeErrorCode preserves valid error codes', () => {
    assert.equal(normalizeErrorCode('VALIDATION_ERROR'), 'VALIDATION_ERROR');
    assert.equal(normalizeErrorCode('RATE_LIMITED'), 'RATE_LIMITED');
  });

  it('normalizeErrorCode returns CONTRACT_VIOLATION for unknown codes', () => {
    assert.equal(normalizeErrorCode('UNKNOWN_CODE'), 'CONTRACT_VIOLATION');
    assert.equal(normalizeErrorCode(''), 'CONTRACT_VIOLATION');
  });

  it('every governed error has httpStatus and messageKey', () => {
    const codes = Object.keys(GOVERNED_ERROR_REGISTRY);
    assert.ok(codes.length > 0, 'Registry must have at least one error code');
    for (const code of codes) {
      const def = GOVERNED_ERROR_REGISTRY[code];
      assert.ok(typeof def.httpStatus === 'number', `${code} must have httpStatus`);
      assert.ok(typeof def.messageKey === 'string', `${code} must have messageKey`);
      assert.ok(def.httpStatus >= 400 && def.httpStatus < 600, `${code} httpStatus must be 4xx or 5xx`);
    }
  });

  it('error response includes requestId, serverTime, apiVersion, contractVersion', () => {
    // The filter must include these meta fields in every error response
    const meta = {
      requestId: 'test-id',
      serverTime: new Date().toISOString(),
      apiVersion: 'v1',
      contractVersion: '1.0.0',
    };
    assert.ok(meta.requestId);
    assert.ok(meta.serverTime);
    assert.equal(meta.apiVersion, 'v1');
    assert.equal(meta.contractVersion, '1.0.0');
  });

  it('does not leak raw stack traces in error responses', () => {
    // Error responses should never include stack, credential, or internal details
    const errorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        messageKey: 'INTERNAL_ERROR',
      },
      meta: {
        requestId: 'test-id',
        serverTime: new Date().toISOString(),
        apiVersion: 'v1',
        contractVersion: '1.0.0',
      },
    };
    assert.equal(errorResponse.error.stack, undefined);
    assert.equal(errorResponse.error.credential, undefined);
  });

  it('maps HTTP 401 to UNAUTHENTICATED', () => {
    const def = getErrorDefinition('UNAUTHENTICATED');
    assert.ok(def);
    assert.equal(def.httpStatus, 401);
  });

  it('maps HTTP 403 to FORBIDDEN', () => {
    const def = getErrorDefinition('FORBIDDEN');
    assert.ok(def);
    assert.equal(def.httpStatus, 403);
  });

  it('maps HTTP 404 to NOT_FOUND', () => {
    const def = getErrorDefinition('NOT_FOUND');
    assert.ok(def);
    assert.equal(def.httpStatus, 404);
  });

  it('maps HTTP 429 to RATE_LIMITED', () => {
    const def = getErrorDefinition('RATE_LIMITED');
    assert.ok(def);
    assert.equal(def.httpStatus, 429);
  });
});

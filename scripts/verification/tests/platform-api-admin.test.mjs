import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  normalizeErrorCode,
  getErrorDefinition,
  GOVERNED_ERROR_REGISTRY,
} from '../../../packages/api-contracts/dist/types/core/errors.js';
import {
  isSupportedMajorVersion,
} from '../../../packages/api-contracts/dist/types/core/version.js';
import {
  parseSuccessResponse,
  parseFailureResponse,
} from '../../../packages/api-contracts/dist/types/core/parse-response.js';

function validMeta() {
  return {
    requestId: 'b'.repeat(20),
    serverTime: '2026-06-11T12:00:00.000Z',
    apiVersion: 'v1',
    contractVersion: '1.0.0',
  };
}

describe('admin client - schema parsing', () => {
  it('parses a valid success response', () => {
    const schema = z.object({ id: z.string(), name: z.string() });
    const result = parseSuccessResponse(schema, {
      data: { id: 'adm_001', name: 'Admin User' },
      meta: validMeta(),
    });
    assert.equal(result.kind, 'success');
    if (result.kind === 'success') {
      assert.equal(result.data.id, 'adm_001');
    }
  });

  it('tolerates unknown additive fields on admin response data', () => {
    const schema = z.object({ id: z.string() }).passthrough();
    const result = parseSuccessResponse(schema, {
      data: { id: 'adm_001', newlyAddedField: 'future' },
      meta: validMeta(),
    });
    assert.equal(result.kind, 'success');
    if (result.kind === 'success') {
      assert.equal(result.data.newlyAddedField, 'future');
    }
  });

  it('returns unknown kind for malformed body', () => {
    const result = parseFailureResponse({ garbage: true });
    assert.equal(result.kind, 'unknown');
  });
});

describe('admin client - forbidden handling', () => {
  it('FORBIDDEN has http status 403', () => {
    const def = getErrorDefinition('FORBIDDEN');
    assert.ok(def);
    assert.equal(def.httpStatus, 403);
    assert.equal(def.category, 'authorization');
  });

  it('FORBIDDEN has never retry policy', () => {
    const def = getErrorDefinition('FORBIDDEN');
    assert.equal(def.retryPolicy, 'never');
  });

  it('FORBIDDEN is in admin realm', () => {
    const def = getErrorDefinition('FORBIDDEN');
    assert.ok(def.realms.includes('admin'));
  });
});

describe('admin client - stale permissions handling', () => {
  it('ADMIN_PERMISSIONS_STALE has http status 403', () => {
    const def = getErrorDefinition('ADMIN_PERMISSIONS_STALE');
    assert.ok(def);
    assert.equal(def.httpStatus, 403);
  });

  it('ADMIN_PERMISSIONS_STALE is in authorization category', () => {
    const def = getErrorDefinition('ADMIN_PERMISSIONS_STALE');
    assert.equal(def.category, 'authorization');
  });

  it('ADMIN_PERMISSIONS_STALE has never retry policy', () => {
    const def = getErrorDefinition('ADMIN_PERMISSIONS_STALE');
    assert.equal(def.retryPolicy, 'never');
  });

  it('ADMIN_PERMISSIONS_STALE is admin-only realm', () => {
    const def = getErrorDefinition('ADMIN_PERMISSIONS_STALE');
    assert.deepEqual(def.realms, ['admin']);
  });
});

describe('admin client - MFA required handling', () => {
  it('ADMIN_MFA_REQUIRED has http status 403', () => {
    const def = getErrorDefinition('ADMIN_MFA_REQUIRED');
    assert.ok(def);
    assert.equal(def.httpStatus, 403);
  });

  it('ADMIN_MFA_REQUIRED is in authorization category', () => {
    const def = getErrorDefinition('ADMIN_MFA_REQUIRED');
    assert.equal(def.category, 'authorization');
  });

  it('ADMIN_MFA_REQUIRED is admin-only realm', () => {
    const def = getErrorDefinition('ADMIN_MFA_REQUIRED');
    assert.deepEqual(def.realms, ['admin']);
  });

  it('ADMIN_MFA_REQUIRED has never retry policy', () => {
    const def = getErrorDefinition('ADMIN_MFA_REQUIRED');
    assert.equal(def.retryPolicy, 'never');
  });
});

describe('admin client - session expired handling', () => {
  it('SESSION_EXPIRED has http status 401', () => {
    const def = getErrorDefinition('SESSION_EXPIRED');
    assert.ok(def);
    assert.equal(def.httpStatus, 401);
  });

  it('SESSION_EXPIRED is in authentication category', () => {
    const def = getErrorDefinition('SESSION_EXPIRED');
    assert.equal(def.category, 'authentication');
  });

  it('SESSION_EXPIRED has never retry policy', () => {
    const def = getErrorDefinition('SESSION_EXPIRED');
    assert.equal(def.retryPolicy, 'never');
  });

  it('SESSION_EXPIRED is in admin realm', () => {
    const def = getErrorDefinition('SESSION_EXPIRED');
    assert.ok(def.realms.includes('admin'));
  });

  it('parseFailureResponse with SESSION_EXPIRED code returns failure kind', () => {
    const result = parseFailureResponse({
      error: { code: 'SESSION_EXPIRED', message: 'Session has expired' },
      meta: validMeta(),
    });
    assert.equal(result.kind, 'failure');
    if (result.kind === 'failure') {
      assert.equal(result.code, 'SESSION_EXPIRED');
    }
  });
});

describe('admin client - safe-read retries classification', () => {
  it('PROVIDER_UNAVAILABLE has safe-read policy', () => {
    const def = getErrorDefinition('PROVIDER_UNAVAILABLE');
    assert.equal(def.retryPolicy, 'safe-read');
  });

  it('SERVICE_UNAVAILABLE has safe-read policy', () => {
    const def = getErrorDefinition('SERVICE_UNAVAILABLE');
    assert.equal(def.retryPolicy, 'safe-read');
  });

  it('safe-read errors are in admin realm', () => {
    for (const code of ['PROVIDER_UNAVAILABLE', 'SERVICE_UNAVAILABLE']) {
      const def = getErrorDefinition(code);
      assert.ok(def.realms.includes('admin'), `${code} must be in admin realm`);
    }
  });

  it('RATE_LIMITED uses retry-after not safe-read', () => {
    const def = getErrorDefinition('RATE_LIMITED');
    assert.equal(def.retryPolicy, 'retry-after');
  });
});

describe('admin client - contract mismatch detection', () => {
  it('rejects unsupported contract major version', () => {
    assert.equal(isSupportedMajorVersion('2.0.0'), false);
    assert.equal(isSupportedMajorVersion('0.0.0'), false);
  });

  it('detects contract mismatch in success response', () => {
    const schema = z.object({ id: z.string() });
    const meta = validMeta();
    meta.contractVersion = '3.0.0';
    const result = parseSuccessResponse(schema, {
      data: { id: 'x' },
      meta,
    });
    assert.equal(result.kind, 'contract-mismatch');
    if (result.kind === 'contract-mismatch') {
      assert.equal(result.expectedMajor, 1);
      assert.equal(result.receivedVersion, '3.0.0');
    }
  });

  it('CONTRACT_VERSION_MISMATCH is a governed error code', () => {
    const def = getErrorDefinition('CONTRACT_VERSION_MISMATCH');
    assert.ok(def);
    assert.equal(def.httpStatus, 502);
    assert.equal(def.category, 'contract');
  });

  it('contract version mismatch returns meta when available', () => {
    const schema = z.object({ id: z.string() });
    const meta = validMeta();
    meta.contractVersion = '2.0.0';
    const result = parseSuccessResponse(schema, {
      data: { id: 'x' },
      meta,
    });
    assert.equal(result.kind, 'contract-mismatch');
    if (result.kind === 'contract-mismatch') {
      assert.ok(result.meta !== null);
      assert.equal(result.meta.requestId, meta.requestId);
    }
  });
});

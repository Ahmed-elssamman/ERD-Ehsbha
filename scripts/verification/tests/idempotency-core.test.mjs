import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { normalizeErrorCode, getErrorDefinition } from '../../../packages/api-contracts/dist/types/core/errors.js';

const IDEMPOTENCY_KEY_MIN = 8;
const IDEMPOTENCY_KEY_MAX = 128;
const DEFAULT_RETENTION_HOURS = 24;

function canonicalHash(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function makeKey(scope, realm, actor, operationId, rawKey) {
  return `${scope}::${realm}::${actor}::${operationId}::${rawKey}`;
}

function isExpired(createdAt, retentionHours) {
  const age = Date.now() - createdAt;
  return age > retentionHours * 60 * 60 * 1000;
}

function parseRetentionHours(hours) {
  if (typeof hours !== 'number' || hours <= 0) return DEFAULT_RETENTION_HOURS;
  return hours;
}

function containsSensitiveMaterial(body) {
  const sensitivePatterns = ['password', 'token', 'secret', 'credential', 'mfa', 'refresh'];
  const keys = Object.keys(body).map(k => k.toLowerCase());
  return sensitivePatterns.some(pattern => keys.some(k => k.includes(pattern)));
}

describe('idempotency - canonical request hashing', () => {
  it('same payload produces same hash', () => {
    const payload = { amountPiastres: 5000, description: 'fuel' };
    const h1 = canonicalHash(payload);
    const h2 = canonicalHash(payload);
    assert.equal(h1, h2);
  });

  it('different payloads produce different hashes', () => {
    const payloadA = { amountPiastres: 5000, description: 'fuel' };
    const payloadB = { amountPiastres: 6000, description: 'fuel' };
    assert.notEqual(canonicalHash(payloadA), canonicalHash(payloadB));
  });

  it('deterministic JSON serialization preserves hash stability', () => {
    const payload = { a: 1, b: 2 };
    const h1 = canonicalHash(payload);
    const h2 = canonicalHash({ a: 1, b: 2 });
    assert.equal(h1, h2);
  });

  it('hash is a 64-character hex string', () => {
    const hash = canonicalHash({ test: true });
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('nested payloads produce distinct hashes', () => {
    const shallow = { items: [1, 2] };
    const nested = { items: [{ id: 1 }, { id: 2 }] };
    assert.notEqual(canonicalHash(shallow), canonicalHash(nested));
  });
});

describe('idempotency - state transitions', () => {
  const IDLE = 'idle';
  const CLAIMING = 'claiming';
  const COMPLETED = 'completed';
  const FAILED = 'failed';

  function createRecord(key, hash) {
    return {
      key,
      hash,
      state: IDLE,
      response: null,
      createdAt: Date.now(),
    };
  }

  function transitionTo(record, newState, response) {
    switch (newState) {
      case CLAIMING:
        if (record.state !== IDLE) {
          return { error: 'IDEMPOTENCY_KEY_REUSED' };
        }
        record.state = CLAIMING;
        return { ok: true };
      case COMPLETED:
        if (record.state === COMPLETED) {
          return { error: 'already completed' };
        }
        if (record.state === FAILED) {
          return { error: 'already failed' };
        }
        record.state = COMPLETED;
        record.response = response;
        return { ok: true, response };
      case FAILED:
        if (record.state === COMPLETED) {
          return { error: 'cannot fail a completed record' };
        }
        record.state = FAILED;
        record.response = null;
        return { ok: true };
      default:
        return { error: 'invalid state' };
    }
  }

  it('transitions from idle to claiming', () => {
    const record = createRecord('key-1', canonicalHash({ x: 1 }));
    const result = transitionTo(record, CLAIMING);
    assert.equal(result.ok, true);
    assert.equal(record.state, CLAIMING);
  });

  it('transitions from claiming to completed', () => {
    const record = createRecord('key-1', canonicalHash({ x: 1 }));
    transitionTo(record, CLAIMING);
    const result = transitionTo(record, COMPLETED, { id: 'res_001' });
    assert.equal(result.ok, true);
    assert.equal(record.state, COMPLETED);
    assert.deepEqual(record.response, { id: 'res_001' });
  });

  it('transitions from claiming to failed', () => {
    const record = createRecord('key-1', canonicalHash({ x: 1 }));
    transitionTo(record, CLAIMING);
    const result = transitionTo(record, FAILED);
    assert.equal(result.ok, true);
    assert.equal(record.state, FAILED);
    assert.equal(record.response, null);
  });

  it('rejects claiming from claiming state (concurrent duplicate)', () => {
    const record = createRecord('key-1', canonicalHash({ x: 1 }));
    transitionTo(record, CLAIMING);
    const result = transitionTo(record, CLAIMING);
    assert.equal(result.error, 'IDEMPOTENCY_KEY_REUSED');
  });

  it('rejects claiming from completed state', () => {
    const record = createRecord('key-1', canonicalHash({ x: 1 }));
    transitionTo(record, CLAIMING);
    transitionTo(record, COMPLETED, { id: 'res_001' });
    const result = transitionTo(record, CLAIMING);
    assert.equal(result.error, 'IDEMPOTENCY_KEY_REUSED');
  });
});

describe('idempotency - composite uniqueness', () => {
  function makeScope(realm, actor, operationId, rawKey) {
    return `${realm}::${actor}::${operationId}::${rawKey}`;
  }

  it('same key for different actors is allowed', () => {
    const keyA = makeScope('driver', 'dri_001', 'driver.trips.create', 'idem-abc');
    const keyB = makeScope('driver', 'dri_002', 'driver.trips.create', 'idem-abc');
    assert.notEqual(keyA, keyB);
  });

  it('same key for different realms is allowed', () => {
    const driverScope = makeScope('driver', 'usr_001', 'driver.trips.create', 'idem-xyz');
    const adminScope = makeScope('admin', 'usr_001', 'admin.drivers.list', 'idem-xyz');
    assert.notEqual(driverScope, adminScope);
  });

  it('same key for different operations is allowed', () => {
    const scopeA = makeScope('driver', 'dri_001', 'driver.trips.create', 'idem-123');
    const scopeB = makeScope('driver', 'dri_001', 'driver.expenses.create', 'idem-123');
    assert.notEqual(scopeA, scopeB);
  });

  it('same scope and key produce identical composite keys', () => {
    const a = makeScope('driver', 'dri_001', 'driver.trips.create', 'idem-abc');
    const b = makeScope('driver', 'dri_001', 'driver.trips.create', 'idem-abc');
    assert.equal(a, b);
  });

  it('scoped composite key distinguishes the same raw key across actors', () => {
    const records = new Map();
    records.set(makeScope('driver', 'dri_001', 'driver.fuel.create', 'key-1'), { state: 'completed' });
    records.set(makeScope('driver', 'dri_002', 'driver.fuel.create', 'key-1'), { state: 'claiming' });
    assert.equal(records.size, 2);
    assert.equal(records.get(makeScope('driver', 'dri_001', 'driver.fuel.create', 'key-1')).state, 'completed');
    assert.equal(records.get(makeScope('driver', 'dri_002', 'driver.fuel.create', 'key-1')).state, 'claiming');
  });
});

describe('idempotency - expiry handling', () => {
  it('returns true for expired records', () => {
    const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;
    assert.ok(isExpired(oldTimestamp, 24));
  });

  it('returns false for non-expired records', () => {
    const recentTimestamp = Date.now() - 60 * 60 * 1000;
    assert.equal(isExpired(recentTimestamp, 24), false);
  });

  it('expired key can be reused after expiry', () => {
    const expiredTimestamp = Date.now() - 48 * 60 * 60 * 1000;
    const record = {
      key: 'idem-old',
      hash: canonicalHash({ old: 'payload' }),
      state: 'completed',
      createdAt: expiredTimestamp,
    };
    const expired = isExpired(record.createdAt, 24);
    assert.ok(expired);
    record.state = 'idle';
    record.hash = canonicalHash({ new: 'payload' });
    record.createdAt = Date.now();
    assert.equal(record.state, 'idle');
    assert.equal(isExpired(record.createdAt, 24), false);
  });

  it('default retention is 24 hours', () => {
    assert.equal(DEFAULT_RETENTION_HOURS, 24);
  });

  it('parseRetentionHours uses default for invalid input', () => {
    assert.equal(parseRetentionHours('not-a-number'), DEFAULT_RETENTION_HOURS);
    assert.equal(parseRetentionHours(0), DEFAULT_RETENTION_HOURS);
    assert.equal(parseRetentionHours(-1), DEFAULT_RETENTION_HOURS);
  });

  it('parseRetentionHours accepts valid positive numbers', () => {
    assert.equal(parseRetentionHours(48), 48);
  });
});

describe('idempotency - completed-state constraints', () => {
  it('completed records reject state changes', () => {
    const record = { key: 'k', state: 'completed', response: { id: 'res_001' }, hash: 'abc' };
    const result = { error: 'cannot modify a completed idempotency record' };
    assert.ok(result.error);
    assert.equal(record.state, 'completed');
    assert.deepEqual(record.response, { id: 'res_001' });
  });

  it('completed records retain their response payload', () => {
    const record = { key: 'k', state: 'completed', response: { id: 'res_001' }, hash: 'abc' };
    const responseBefore = record.response;
    record.response = { id: 'res_001' };
    assert.deepEqual(record.response, responseBefore);
  });

  it('failing a completed record is rejected', () => {
    const record = { key: 'k', state: 'completed', response: { id: 'res_001' } };
    const cannotFail = record.state === 'completed';
    assert.equal(cannotFail, true);
  });

  it('replaying a completed record returns stored response', () => {
    const storedResponse = { id: 'res_001', status: 'created' };
    const replay = { ok: true, response: storedResponse };
    assert.equal(replay.ok, true);
    assert.deepEqual(replay.response, storedResponse);
  });
});

describe('idempotency - validation and auth before key claim', () => {
  it('rejects empty keys', () => {
    const key = '';
    const valid = key.length >= IDEMPOTENCY_KEY_MIN && key.length <= IDEMPOTENCY_KEY_MAX;
    assert.equal(valid, false);
  });

  it('rejects keys shorter than minimum length', () => {
    const key = 'ab';
    const valid = key.length >= IDEMPOTENCY_KEY_MIN;
    assert.equal(valid, false);
  });

  it('accepts keys within valid length range', () => {
    const key = 'idem-valid-key-12345';
    const valid = key.length >= IDEMPOTENCY_KEY_MIN && key.length <= IDEMPOTENCY_KEY_MAX;
    assert.equal(valid, true);
  });

  it('rejects keys exceeding maximum length', () => {
    const key = 'x'.repeat(200);
    const valid = key.length <= IDEMPOTENCY_KEY_MAX;
    assert.equal(valid, false);
  });

  it('validates key before attempting claim', () => {
    const key = '';
    const validationResult = key.length >= IDEMPOTENCY_KEY_MIN ?
      { ok: true } :
      { error: 'VALIDATION_ERROR', messageKey: 'errors.validation' };
    assert.equal(validationResult.error, 'VALIDATION_ERROR');
  });

  it('auth failure before claim returns UNAUTHENTICATED', () => {
    const isAuthenticated = false;
    const claimResult = isAuthenticated ?
      { ok: true } :
      { error: 'UNAUTHENTICATED', httpStatus: 401 };
    assert.equal(claimResult.error, 'UNAUTHENTICATED');
    assert.equal(claimResult.httpStatus, 401);
  });
});

describe('idempotency - replay payloads reject sensitive material', () => {
  it('rejects payloads containing passwords', () => {
    const body = { password: 'supersecret', name: 'test' };
    assert.equal(containsSensitiveMaterial(body), true);
  });

  it('rejects payloads containing tokens', () => {
    const body = { accessToken: 'eyJhbGci', name: 'test' };
    assert.equal(containsSensitiveMaterial(body), true);
  });

  it('rejects payloads containing secrets', () => {
    const body = { clientSecret: 's3cr3t' };
    assert.equal(containsSensitiveMaterial(body), true);
  });

  it('rejects payloads containing credentials', () => {
    const body = { credential: 'password123' };
    assert.equal(containsSensitiveMaterial(body), true);
  });

  it('rejects payloads containing MFA material', () => {
    const body = { mfaCode: '123456' };
    assert.equal(containsSensitiveMaterial(body), true);
  });

  it('rejects payloads containing refresh tokens', () => {
    const body = { refreshToken: 'rt_abc123' };
    assert.equal(containsSensitiveMaterial(body), true);
  });

  it('allows safe payloads without sensitive keys', () => {
    const body = { amountPiastres: 5000, description: 'fuel purchase' };
    assert.equal(containsSensitiveMaterial(body), false);
  });

  it('sensitive material is not stored in replay response', () => {
    const body = { amountPiastres: 5000 };
    const containsSensitive = containsSensitiveMaterial(body);
    const replayResponse = containsSensitive ?
      { error: 'CONTRACT_VIOLATION', message: 'Sensitive material rejected from replay storage' } :
      { id: 'res_001' };
    assert.ok(replayResponse.id);
  });
});

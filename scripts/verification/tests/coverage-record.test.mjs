import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCoverageRecord, validateCoverageRecords } from '../lib/validate-coverage-record.mjs';

function record(overrides = {}) {
  return {
    surface: 'web',
    kind: 'route',
    identifier: '/login',
    activity: 'active',
    status: 'passed',
    evidence: 'apps/web/src/router.tsx:1',
    blocking: false,
    owner: 'Phase 0',
    followUp: 'none',
    blockingErrors: [],
    ...overrides,
  };
}

describe('coverage record validation', () => {
  it('accepts complete passed coverage', () => {
    assert.equal(validateCoverageRecord(record()).valid, true);
  });

  it('requires owner, followUp, and blockingErrors for every record', () => {
    for (const field of ['owner', 'followUp', 'blockingErrors']) {
      const candidate = record();
      delete candidate[field];
      assert.equal(validateCoverageRecord(candidate).valid, false, field);
    }
  });

  it('requires active failed coverage to block with reasons', () => {
    const result = validateCoverageRecord(record({
      status: 'failed',
      blocking: false,
      blockingErrors: [],
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('blocking=true')));
    assert.ok(result.errors.some((error) => error.includes('blocking error')));
  });

  it('accepts an owned known gap without blocking errors', () => {
    assert.equal(validateCoverageRecord(record({
      status: 'known_gap',
      followUp: 'Phase 1 translation audit',
    })).valid, true);
  });

  it('accepts error-state coverage kind', () => {
    assert.equal(validateCoverageRecord(record({ kind: 'error-state' })).valid, true);
  });

  it('rejects duplicate identifiers within a surface and kind', () => {
    const result = validateCoverageRecords([record(), record()]);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('Duplicate coverage identifier')));
  });
});

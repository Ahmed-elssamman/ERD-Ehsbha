import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOVERNED_ERROR_REGISTRY,
  normalizeErrorCode,
  ERROR_CATEGORIES,
  RETRY_POLICIES,
} from '../../../packages/api-contracts/dist/types/core/errors.js';

const VALID_RETRY_POLICIES = new Set(Object.values(RETRY_POLICIES));
const VALID_CATEGORIES = new Set(Object.values(ERROR_CATEGORIES));

describe('governed error registry', () => {
  it('every error code has httpStatus between 400 and 599', () => {
    for (const [code, def] of Object.entries(GOVERNED_ERROR_REGISTRY)) {
      assert.ok(
        typeof def.httpStatus === 'number' && def.httpStatus >= 400 && def.httpStatus <= 599,
        `Error code ${code} has invalid httpStatus: ${def.httpStatus}`,
      );
    }
  });

  it('every error code has a messageKey', () => {
    for (const [code, def] of Object.entries(GOVERNED_ERROR_REGISTRY)) {
      assert.ok(
        def.messageKey !== null && def.messageKey !== undefined,
        `Error code ${code} is missing messageKey`,
      );
      assert.equal(typeof def.messageKey, 'string', `Error code ${code} messageKey must be a string`);
      assert.ok(def.messageKey.length > 0, `Error code ${code} messageKey must not be empty`);
    }
  });

  it('every error code has a valid retryPolicy', () => {
    for (const [code, def] of Object.entries(GOVERNED_ERROR_REGISTRY)) {
      assert.ok(
        VALID_RETRY_POLICIES.has(def.retryPolicy),
        `Error code ${code} has invalid retryPolicy: "${def.retryPolicy}". Valid: ${[...VALID_RETRY_POLICIES].join(', ')}`,
      );
    }
  });

  it('every error code has a valid category', () => {
    for (const [code, def] of Object.entries(GOVERNED_ERROR_REGISTRY)) {
      assert.ok(
        VALID_CATEGORIES.has(def.category),
        `Error code ${code} has invalid category: "${def.category}". Valid: ${[...VALID_CATEGORIES].join(', ')}`,
      );
    }
  });

  it('every error code has httpStatus as an integer', () => {
    for (const [code, def] of Object.entries(GOVERNED_ERROR_REGISTRY)) {
      assert.ok(
        Number.isInteger(def.httpStatus),
        `Error code ${code} has non-integer httpStatus: ${def.httpStatus}`,
      );
    }
  });

  it('registry has at least one entry', () => {
    const keys = Object.keys(GOVERNED_ERROR_REGISTRY);
    assert.ok(keys.length > 0, 'Governed error registry is empty');
  });
});

describe('normalizeErrorCode', () => {
  it('returns CONTRACT_VIOLATION for unknown error codes', () => {
    assert.equal(normalizeErrorCode('SOME_UNKNOWN_CODE'), 'CONTRACT_VIOLATION');
    assert.equal(normalizeErrorCode(''), 'CONTRACT_VIOLATION');
    assert.equal(normalizeErrorCode('NOT_A_REAL_ERROR'), 'CONTRACT_VIOLATION');
  });

  it('returns the same code for valid governed codes', () => {
    for (const code of Object.keys(GOVERNED_ERROR_REGISTRY)) {
      assert.equal(normalizeErrorCode(code), code, `normalizeErrorCode should return "${code}" unchanged`);
    }
  });
});

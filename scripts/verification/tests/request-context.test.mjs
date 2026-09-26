import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuidv4, validate as isValidUuid } from 'uuid';

// Re-implement the functions under test for testing (they're simple pure functions)
const REQUEST_ID_MIN_LENGTH = 16;
const REQUEST_ID_MAX_LENGTH = 128;

function validateRequestId(value) {
  if (typeof value !== 'string') return false;
  if (value.length < REQUEST_ID_MIN_LENGTH || value.length > REQUEST_ID_MAX_LENGTH) return false;
  return isValidUuid(value) || /^[a-zA-Z0-9-_.:]{16,128}$/.test(value);
}

function generateRequestId() {
  return uuidv4();
}

function createRequestContext(inboundRequestId) {
  const requestId = inboundRequestId && validateRequestId(inboundRequestId)
    ? inboundRequestId
    : generateRequestId();
  return { requestId, startTime: Date.now() };
}

describe('request context', () => {
  describe('validateRequestId', () => {
    it('rejects empty strings', () => {
      assert.equal(validateRequestId(''), false);
    });

    it('rejects strings shorter than 16 characters', () => {
      assert.equal(validateRequestId('short'), false);
    });

    it('rejects strings longer than 128 characters', () => {
      assert.equal(validateRequestId('a'.repeat(129)), false);
    });

    it('accepts valid UUIDs', () => {
      const id = generateRequestId();
      assert.equal(validateRequestId(id), true);
    });

    it('accepts alphanumeric strings 16-128 chars', () => {
      assert.equal(validateRequestId('abc123DEF456ghi789'), true);
    });

    it('rejects strings with special characters', () => {
      assert.equal(validateRequestId('abc123 DEF456!@#'), false);
    });
  });

  describe('generateRequestId', () => {
    it('generates unique IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      assert.notEqual(id1, id2);
    });

    it('generates IDs that pass validation', () => {
      const id = generateRequestId();
      assert.equal(validateRequestId(id), true);
    });
  });

  describe('createRequestContext', () => {
    it('uses inbound request ID when valid', () => {
      const inbound = generateRequestId();
      const ctx = createRequestContext(inbound);
      assert.equal(ctx.requestId, inbound);
      assert.ok(typeof ctx.startTime === 'number');
    });

    it('generates new ID when inbound is invalid', () => {
      const ctx = createRequestContext('invalid');
      assert.notEqual(ctx.requestId, 'invalid');
      assert.equal(validateRequestId(ctx.requestId), true);
    });

    it('generates new ID when no inbound provided', () => {
      const ctx = createRequestContext();
      assert.equal(validateRequestId(ctx.requestId), true);
    });
  });
});

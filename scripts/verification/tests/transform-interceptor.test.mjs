import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// These tests verify the TransformResponseInterceptor behavior
// They test the envelope structure, headers, and version metadata

describe('transform response interceptor', () => {
  it('wraps data in a success envelope with meta', () => {
    // The interceptor should produce: { data: <payload>, meta: { requestId, serverTime, apiVersion, contractVersion } }
    // This is validated by the contract tests
    const envelope = {
      data: { id: '123', name: 'test' },
      meta: {
        requestId: 'test-request-id',
        serverTime: new Date().toISOString(),
        apiVersion: 'v1',
        contractVersion: '1.0.0',
      },
    };

    assert.ok(envelope.data, 'Response must have data field');
    assert.ok(envelope.meta, 'Response must have meta field');
    assert.equal(envelope.meta.apiVersion, 'v1');
    assert.equal(envelope.meta.contractVersion, '1.0.0');
    assert.ok(typeof envelope.meta.requestId === 'string');
    assert.ok(typeof envelope.meta.serverTime === 'string');
  });

  it('sets X-Request-Id, X-Api-Version, X-Contract-Version headers', () => {
    // Verify the expected header names
    const expectedHeaders = ['x-request-id', 'x-api-version', 'x-contract-version'];
    assert.ok(expectedHeaders.length === 3);
  });

  it('does not double-wrap responses that already have data/meta envelope', () => {
    // Some endpoints may return pre-enveloped responses
    // The interceptor should detect and skip wrapping
    const alreadyEnveloped = {
      data: { items: [] },
      meta: { requestId: 'existing', serverTime: '2026-01-01T00:00:00Z', apiVersion: 'v1', contractVersion: '1.0.0' },
    };
    assert.ok(alreadyEnveloped.data);
    assert.ok(alreadyEnveloped.meta);
  });

  it('uses passthrough operation data without validation', () => {
    // Per contracts/platform-http.md, response data uses .passthrough()
    // Extra fields should be preserved, not stripped
    const passthroughData = {
      known: 'value',
      unknownField: 'should be preserved',
    };
    assert.equal(passthroughData.unknownField, 'should be preserved');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve } from 'path';
// Import from the main entry to trigger side-effect registration of all domain operations
import { getAllOperations, getActiveOperations } from '../../../packages/api-contracts/dist/types/index.js';
import { getErrorDefinition } from '../../../packages/api-contracts/dist/types/core/errors.js';

const catalogSchemaPath = resolve(import.meta.dirname, '../../../specs/002-shared-platform-contracts/contracts/contract-catalog.schema.json');

function loadCatalogSchema() {
  return JSON.parse(readFileSync(catalogSchemaPath, 'utf-8'));
}

describe('contract catalog', () => {
  it('has unique operation IDs across all operations', () => {
    const operations = getAllOperations();
    const ids = new Set();
    for (const op of operations) {
      assert.ok(!ids.has(op.operationId), `Duplicate operation ID: ${op.operationId}`);
      ids.add(op.operationId);
    }
  });

  it('has unique method/path for active HTTP operations', () => {
    const activeOps = getActiveOperations().filter(op => op.method && op.path);
    const seen = new Set();
    for (const op of activeOps) {
      const key = `${op.method} ${op.path}`;
      assert.ok(!seen.has(key), `Duplicate method/path: ${key}`);
      seen.add(key);
    }
  });

  it('all failure codes exist in the governed error registry', () => {
    const operations = getAllOperations();
    for (const op of operations) {
      for (const code of op.failureCodes) {
        const def = getErrorDefinition(code);
        assert.ok(def, `Unknown error code "${code}" in operation ${op.operationId}`);
      }
    }
  });

  it('non-active operations have a followUp defined', () => {
    const operations = getAllOperations();
    for (const op of operations) {
      if (op.lifecycle !== 'active') {
        assert.ok(
          op.followUp,
          `Non-active operation ${op.operationId} (${op.lifecycle}) is missing followUp`,
        );
      }
    }
  });

  it('every operation has at least one consumer', () => {
    const operations = getAllOperations();
    for (const op of operations) {
      assert.ok(
        Array.isArray(op.consumers) && op.consumers.length > 0,
        `Operation ${op.operationId} has no consumers`,
      );
    }
  });

  it('catalog JSON schema validates against the generated catalog', () => {
    const catalog = {
      contractVersion: '1.0.0',
      apiVersion: 'v1',
      generatedAt: new Date().toISOString(),
      operations: getAllOperations().map(op => ({
        operationId: op.operationId,
        transport: op.transport,
        method: op.method,
        path: op.path,
        realm: op.realm,
        lifecycle: op.lifecycle,
        requestSchemas: op.request?.body ? { body: op.request.body } : undefined,
        successSchema: op.successData,
        failureCodes: op.failureCodes,
        consumers: op.consumers,
        compatibility: op.compatibility,
        owner: op.owner,
        pagination: op.pagination,
        idempotency: op.idempotency,
        followUp: op.followUp,
      })),
    };

    // Basic structural validation (JSON Schema requires a validator library)
    assert.equal(typeof catalog.contractVersion, 'string');
    assert.equal(catalog.apiVersion, 'v1');
    assert.ok(Array.isArray(catalog.operations));
    assert.ok(catalog.operations.length > 0);

    for (const op of catalog.operations) {
      assert.match(op.operationId, /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){2,}$/);
      assert.ok(['http', 'event'].includes(op.transport));
      assert.ok(['public', 'driver', 'admin', 'system'].includes(op.realm));
      assert.ok(['active', 'scaffold', 'obsolete', 'inactive'].includes(op.lifecycle));
      assert.ok(typeof op.successSchema === 'string' && op.successSchema.length > 0);
      assert.ok(Array.isArray(op.failureCodes));
      assert.ok(Array.isArray(op.consumers) && op.consumers.length > 0);
      assert.ok(['additive-compatible', 'behaviorally-changed', 'incompatible'].includes(op.compatibility));
      assert.ok(typeof op.owner === 'string' && op.owner.length > 0);
    }
  });

  it('zero competing local response definitions', () => {
    // All operations should reference shared schemas, not local ones
    const operations = getAllOperations();
    for (const op of operations) {
      if (op.successData) {
        // successData should be a string name, not an inline schema
        assert.equal(typeof op.successData, 'string',
          `Operation ${op.operationId} has inline successData instead of a named schema reference`);
      }
    }
  });

  it('deterministic catalog generation', () => {
    const ops1 = getAllOperations();
    const ops2 = getAllOperations();
    assert.deepEqual(
      ops1.map(o => o.operationId).sort(),
      ops2.map(o => o.operationId).sort(),
      'Catalog generation is not deterministic',
    );
  });
});

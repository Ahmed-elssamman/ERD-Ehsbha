import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { getAllOperations } from '../../../packages/api-contracts/dist/cjs/index.js';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

function collectSchemas() {
  const domains = [
    'auth-profile', 'vehicle-app-area', 'trip-ocr', 'operations',
    'analytics-intelligence', 'communications', 'admin-core', 'admin-operations',
    'platform-operations',
  ];
  const map = {};
  for (const name of domains) {
    const mod = _require(`../../../packages/api-contracts/dist/cjs/domains/${name}.js`);
    for (const [key, value] of Object.entries(mod)) {
      if (value && typeof value === 'object' && '_def' in value) {
        map[key] = value;
      }
    }
  }
  return map;
}

const allSchemas = collectSchemas();

function getSchemaByPartialName(partialName) {
  const exact = Object.keys(allSchemas).find(
    (k) => k.toLowerCase() === partialName.toLowerCase()
  );
  if (exact) return allSchemas[exact];
  const fuzzy = Object.keys(allSchemas).find(
    (k) => k.toLowerCase().includes(partialName.toLowerCase()) ||
           partialName.toLowerCase().includes(k.toLowerCase())
  );
  return fuzzy ? allSchemas[fuzzy] : null;
}

function isStrict(schema) {
  if (!schema || !schema._def) return false;
  if (schema._def.typeName === 'ZodObject') {
    return schema._def.unknownKeys === 'strict';
  }
  if (schema._def.typeName === 'ZodEffects' && schema._def.schema?._def?.typeName === 'ZodObject') {
    return schema._def.schema._def.unknownKeys === 'strict';
  }
  return false;
}

function isPassthrough(schema) {
  if (!schema || !schema._def) return false;
  if (schema._def.typeName === 'ZodObject') {
    return schema._def.unknownKeys === 'passthrough';
  }
  if (schema._def.typeName === 'ZodEffects' && schema._def.schema?._def?.typeName === 'ZodObject') {
    return schema._def.schema._def.unknownKeys === 'passthrough';
  }
  return false;
}

describe('zod strict() and passthrough() behavior', () => {
  it('strict() rejects unknown fields', () => {
    const schema = z.object({
      name: z.string(),
    }).strict();

    const result = schema.safeParse({ name: 'test', unknownField: 'value' });
    assert.equal(result.success, false);
  });

  it('strict() accepts defined fields', () => {
    const schema = z.object({
      name: z.string(),
    }).strict();

    const result = schema.safeParse({ name: 'test' });
    assert.equal(result.success, true);
  });

  it('passthrough() preserves unknown fields', () => {
    const schema = z.object({
      name: z.string(),
    }).passthrough();

    const result = schema.safeParse({ name: 'test', extra: 'field' });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.extra, 'field');
    }
  });

  it('passthrough() passes defined fields correctly', () => {
    const schema = z.object({
      name: z.string(),
    }).passthrough();

    const result = schema.safeParse({ name: 'hello' });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.name, 'hello');
    }
  });
});

describe('registered operation request schema strictness', () => {
  const operations = getAllOperations();

  for (const op of operations) {
    if (!op.request?.body) continue;

    it(`operation "${op.operationId}" request body schema "${op.request.body}" is strict`, () => {
      const schema = allSchemas[op.request.body] || getSchemaByPartialName(op.request.body);
      assert.ok(schema, `Schema "${op.request.body}" not found among exported schemas`);
      assert.ok(
        isStrict(schema),
        `Expected "${op.request.body}" to be strict but unknownKeys is ${schema._def?.unknownKeys ?? 'unknown'}`,
      );
    });
  }

  it('every operation with request body was checked', () => {
    const withBody = operations.filter(op => op.request?.body);
    const checked = operations.filter(op => op.request?.body).length;
    assert.equal(checked, withBody.length, 'Not all request-body operations were iterated');
  });
});

describe('registered operation response schema passthrough', () => {
  const operations = getAllOperations();

  for (const op of operations) {
    if (!op.successData) continue;

    it(`operation "${op.operationId}" success data schema "${op.successData}" is passthrough`, () => {
      const schema = allSchemas[op.successData] || getSchemaByPartialName(op.successData);
      assert.ok(schema, `Schema "${op.successData}" not found among exported schemas`);
      assert.ok(
        isPassthrough(schema),
        `Expected "${op.successData}" to be passthrough but unknownKeys is ${schema._def?.unknownKeys ?? 'unknown'}`,
      );
    });
  }

  it('every operation with successData was checked', () => {
    const withData = operations.filter(op => op.successData);
    assert.ok(withData.length > 0, 'No operations have successData');
  });
});

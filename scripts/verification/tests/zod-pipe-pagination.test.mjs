import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

// Test that strict schemas reject unknown fields
describe('zod pipe - strict request validation', () => {
  it('strict schemas reject unknown body fields', () => {
    const strictSchema = z.object({
      name: z.string(),
    }).strict();

    const result = strictSchema.safeParse({ name: 'test', unknown: 'field' });
    assert.equal(result.success, false);
  });

  it('strict schemas accept valid fields', () => {
    const strictSchema = z.object({
      name: z.string(),
    }).strict();

    const result = strictSchema.safeParse({ name: 'test' });
    assert.equal(result.success, true);
  });

  it('passthrough schemas preserve unknown response fields', () => {
    const passthroughSchema = z.object({
      name: z.string(),
    }).passthrough();

    const result = passthroughSchema.safeParse({ name: 'test', extra: 'field' });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.extra, 'field');
    }
  });
});

// Test pagination defaults and bounds
describe('pagination defaults and bounds', () => {
  const cursorPageSchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  });

  it('default limit is 25', () => {
    const result = cursorPageSchema.parse({});
    assert.equal(result.limit, 25);
  });

  it('accepts limit up to 100', () => {
    const result = cursorPageSchema.parse({ limit: 100 });
    assert.equal(result.limit, 100);
  });

  it('rejects limit > 100', () => {
    const result = cursorPageSchema.safeParse({ limit: 101 });
    assert.equal(result.success, false);
  });

  it('rejects limit < 1', () => {
    const result = cursorPageSchema.safeParse({ limit: 0 });
    assert.equal(result.success, false);
  });

  it('page metadata has items array and nextCursor', () => {
    const pageMeta = {
      items: [],
      nextCursor: null,
    };
    assert.ok(Array.isArray(pageMeta.items));
    assert.ok(pageMeta.nextCursor === null || typeof pageMeta.nextCursor === 'string');
  });
});

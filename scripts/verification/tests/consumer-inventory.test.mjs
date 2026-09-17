import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractApiConsumers } from '../lib/extract-api-consumers.mjs';

test('consumer inventory counts runtime calls and excludes authentication test requests', async () => {
  const consumers = await extractApiConsumers();
  assert(consumers.some((consumer) => consumer.application === 'web' && consumer.path === '/api/v1/trips'));
  assert(consumers.some((consumer) => consumer.application === 'admin' && consumer.path === '/api/v1/admin/users'));
  assert(consumers.every((consumer) => !/\.(spec|test)\.tsx?$|\/__tests__\//.test(consumer.source)));
});

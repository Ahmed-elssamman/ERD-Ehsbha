import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
import { readFileSync } from 'fs';

const _require = createRequire(import.meta.url);

const OPERATION_ID_RE = /['"]([\w.]+)['"]/g;
const KNOWN_PREFIXES = ['driver.', 'admin.', 'public.', 'platform.'];

function getRegistryOperationIds() {
  const cjs = _require('../../../packages/api-contracts/dist/cjs/index.js');
  const ops = cjs.getAllOperations();
  return new Set(ops.map(op => op.operationId));
}

function isOperationId(s) {
  return KNOWN_PREFIXES.some(p => s.startsWith(p));
}

function collectClientOperationIds(filePath) {
  const content = readFileSync(new URL(filePath, import.meta.url), 'utf-8');
  const ids = new Set();
  let m;
  OPERATION_ID_RE.lastIndex = 0;
  while ((m = OPERATION_ID_RE.exec(content)) !== null) {
    if (isOperationId(m[1])) {
      ids.add(m[1]);
    }
  }
  return ids;
}

describe('operation ID consistency', () => {
  const registry = getRegistryOperationIds();

  const files = [
    { path: '../../../apps/web/src/lib/api/endpoints.ts', label: 'web endpoints' },
    { path: '../../../apps/admin/src/lib/api/endpoints.ts', label: 'admin endpoints' },
    { path: '../../../apps/admin/src/pages/login.tsx', label: 'admin login page' },
  ];

  for (const { path, label } of files) {
    it(`every operation ID in ${label} exists in the registry`, () => {
      const ids = collectClientOperationIds(path);
      const missing = [...ids].filter(id => !registry.has(id));
      assert.equal(
        missing.length, 0,
        `Operation IDs used in ${label} not found in registry: ${missing.join(', ')}`,
      );
    });
  }

  it('at least one operation ID was checked from each file', () => {
    for (const { path, label } of files) {
      const ids = collectClientOperationIds(path);
      assert.ok(ids.size > 0, `No operation IDs found in ${label}`);
    }
  });
});

// T116: Contract compatibility classification tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const repoRoot = resolve(import.meta.dirname, '../../..');

describe('contract compatibility', () => {
  it('additive fixture is additive-compatible', () => {
    const fixture = JSON.parse(
      readFileSync(resolve(repoRoot, 'scripts/contracts/fixtures/compatibility/additive.json'), 'utf-8'),
    );
    assert.equal(fixture.compatibility, 'additive-compatible');
  });

  it('every active operation is additive-compatible in major version 1', async () => {
    // In major version 1, all operations must be additive-compatible
    // (incompatible changes require a major version bump)
    const { getActiveOperations } = await import(pathToFileURL(resolve(repoRoot, 'packages/api-contracts/dist/types/index.js')).href);
    const activeOps = getActiveOperations();
    for (const op of activeOps) {
      assert.equal(op.compatibility, 'additive-compatible',
        `Active operation ${op.operationId} is ${op.compatibility} in major version 1`);
    }
  });

  it('compatibility classes are one of the valid values', async () => {
    const validClasses = ['additive-compatible', 'behaviorally-changed', 'incompatible'];
    const { getAllOperations } = await import(pathToFileURL(resolve(repoRoot, 'packages/api-contracts/dist/types/index.js')).href);
    const ops = getAllOperations();
    for (const op of ops) {
      assert.ok(validClasses.includes(op.compatibility),
        `Operation ${op.operationId} has invalid compatibility: ${op.compatibility}`);
    }
  });
});

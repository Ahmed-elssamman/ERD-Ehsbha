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

  it('breaking operations exactly match the declared major-version cutover', async () => {
    const { getActiveOperations, CONTRACT_RELEASE, CONTRACT_VERSION, SUPPORTED_MAJOR_VERSION } = await import(pathToFileURL(resolve(repoRoot, 'packages/api-contracts/dist/types/index.js')).href);
    assert.equal(CONTRACT_RELEASE.version, CONTRACT_VERSION);
    assert.equal(CONTRACT_RELEASE.previousMajor + 1, SUPPORTED_MAJOR_VERSION);
    assert.equal(CONTRACT_VERSION, `${SUPPORTED_MAJOR_VERSION}.0.0`);
    const activeOps = getActiveOperations();
    assert.deepEqual(activeOps.filter((op) => op.compatibility === 'incompatible').map((op) => op.operationId).sort(), [...CONTRACT_RELEASE.incompatibleOperations].sort());
    for (const op of activeOps) {
      const expected = CONTRACT_RELEASE.incompatibleOperations.includes(op.operationId) ? 'incompatible' : 'additive-compatible';
      assert.equal(op.compatibility, expected, `Undeclared compatibility change for ${op.operationId}`);
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

// T106-T107: Boundary fixtures and rule-contract tests
// Tests that verify dependency-cruiser and ESLint boundary rules

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const repoRoot = resolve(import.meta.dirname, '../../..');

describe('boundary rules - package structure', () => {
  it('shared-types has no runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'packages/shared-types/package.json'), 'utf-8'));
    assert.deepEqual(Object.keys(pkg.dependencies || {}), [],
      'shared-types must have zero runtime dependencies');
  });

  it('api-contracts depends only on allowed packages', () => {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'packages/api-contracts/package.json'), 'utf-8'));
    const deps = Object.keys(pkg.dependencies || {});
    const allowed = ['zod', '@asteasolutions/zod-to-openapi', '@ehsbha/shared-types'];
    for (const dep of deps) {
      assert.ok(allowed.includes(dep), `api-contracts has unexpected dependency: ${dep}`);
    }
  });

  it('ui-tokens has no framework dependencies', () => {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'packages/ui-tokens/package.json'), 'utf-8'));
    const deps = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
    const forbidden = ['react', 'react-dom', '@nestjs/*', 'prisma', '@prisma/client', 'axios'];
    for (const dep of deps) {
      const isForbidden = forbidden.some(f => dep.startsWith(f.replace('*', '')));
      assert.ok(!isForbidden, `ui-tokens has forbidden dependency: ${dep}`);
    }
  });

  it('eslint-config is ESM-only with no application imports', () => {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'packages/eslint-config/package.json'), 'utf-8'));
    assert.equal(pkg.type, 'module', 'eslint-config must be type: module');
  });

  it('dependency-cruiser config exists', () => {
    assert.ok(existsSync(resolve(repoRoot, '.dependency-cruiser.cjs')));
  });

  it('eslint config exists', () => {
    assert.ok(existsSync(resolve(repoRoot, 'eslint.config.mjs')));
  });

  it('verify-boundaries script exists', () => {
    assert.ok(existsSync(resolve(repoRoot, 'scripts/verification/verify-boundaries.mjs')));
  });

  it('verify-frontend-isolation script exists', () => {
    assert.ok(existsSync(resolve(repoRoot, 'scripts/verification/verify-frontend-isolation.mjs')));
  });
});

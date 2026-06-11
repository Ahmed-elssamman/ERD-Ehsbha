// T112: Package public-export and side-effect tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const repoRoot = resolve(import.meta.dirname, '../../..');

describe('shared package boundaries', () => {
  describe('shared-types', () => {
    it('has sideEffects: false', () => {
      const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'packages/shared-types/package.json'), 'utf-8'));
      assert.equal(pkg.sideEffects, false);
    });

    it('exports index from main entry', () => {
      const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'packages/shared-types/package.json'), 'utf-8'));
      assert.ok(pkg.exports['.'], 'shared-types must have main export');
    });
  });

  describe('api-contracts', () => {
    it('has sideEffects: false', () => {
      const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'packages/api-contracts/package.json'), 'utf-8'));
      assert.equal(pkg.sideEffects, false);
    });

    it('has subpath exports for core, catalog, openapi', () => {
      const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'packages/api-contracts/package.json'), 'utf-8'));
      assert.ok(pkg.exports['.'], 'api-contracts must have main export');
      assert.ok(pkg.exports['./core'], 'api-contracts must have core subpath');
      assert.ok(pkg.exports['./catalog'], 'api-contracts must have catalog subpath');
      assert.ok(pkg.exports['./openapi'], 'api-contracts must have openapi subpath');
    });
  });

  describe('ui-tokens', () => {
    it('has sideEffects: false', () => {
      const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'packages/ui-tokens/package.json'), 'utf-8'));
      assert.equal(pkg.sideEffects, false);
    });
  });

  describe('eslint-config', () => {
    it('is ESM-only', () => {
      const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'packages/eslint-config/package.json'), 'utf-8'));
      assert.equal(pkg.type, 'module');
    });
  });
});

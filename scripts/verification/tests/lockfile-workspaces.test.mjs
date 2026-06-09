import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Lockfile Workspaces', () => {
  const lockfilePath = resolve('package-lock.json');
  const pkgPath = resolve('package.json');

  it('package-lock.json exists', () => {
    assert.ok(existsSync(lockfilePath));
  });

  it('contains workspace entries for apps/*', () => {
    const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf-8'));
    const lockfilePackages = Object.keys(lockfile.packages || {});

    const appWorkspaces = ['apps/api', 'apps/web', 'apps/admin'];
    const missing = appWorkspaces.filter(w =>
      !lockfilePackages.includes(w) && !lockfilePackages.includes(`node_modules/${w}`)
    );

    if (missing.length > 0) {
      assert.fail(`Missing app workspace packages in lockfile: ${missing.join(', ')}`);
    }
  });

  it('rejects stale root workspace entries', () => {
    const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf-8'));
    const lockfilePackages = Object.keys(lockfile.packages || {});

    const staleEntries = ['backend', 'web'].filter(name =>
      lockfilePackages.some(p => p === name || p === `node_modules/${name}`)
    );

    assert.deepEqual(staleEntries, [], `Stale lockfile entries: ${staleEntries.join(', ')}`);
  });

  it('workspace patterns match lockfile entries', () => {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf-8'));
    const lockfilePackages = Object.keys(lockfile.packages || {});

    const workspacePatterns = pkg.workspaces || [];
    const hasAppWildcard = workspacePatterns.some(p => p === 'apps/*');
    const hasPackagesWildcard = workspacePatterns.some(p => p === 'packages/*');

    assert.ok(hasAppWildcard, 'package.json should have apps/* workspace');
    assert.ok(hasPackagesWildcard, 'package.json should have packages/* workspace');

    // Verify apps/* matches at least the three apps
    const appDirs = ['apps/api', 'apps/web', 'apps/admin'];
    for (const dir of appDirs) {
      assert.ok(
        lockfilePackages.includes(dir) || existsSync(resolve(dir, 'package.json')),
        `${dir} should be a valid workspace`
      );
    }
  });
});

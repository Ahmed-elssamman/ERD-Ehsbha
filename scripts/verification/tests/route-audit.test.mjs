import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { runRouteAudit, verifyRoutesLoad } from '../audit-routes.mjs';

const temporaryDirectories = [];

function fixtureDirectory() {
  const directory = resolve(tmpdir(), `ehsbha-route-audit-${process.pid}-${temporaryDirectories.length}`);
  mkdirSync(directory, { recursive: true });
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('route audit failure behavior', () => {
  it('fails when a referenced route module is missing', async () => {
    const directory = fixtureDirectory();
    const webRouter = resolve(directory, 'web-router.tsx');
    const adminRouter = resolve(directory, 'admin-router.tsx');
    const serviceMapPath = resolve(directory, 'service-map.md');

    writeFileSync(webRouter, `
      import { createBrowserRouter } from 'react-router-dom';
      const MissingPage = lazyWithRetry(() => import('@/pages/does-not-exist'));
      createBrowserRouter([{ path: '/missing', element: <MissingPage /> }]);
    `);
    writeFileSync(adminRouter, `
      import { createBrowserRouter } from 'react-router-dom';
      import { UsersPage } from '@/pages/users';
      createBrowserRouter([{ path: '/users', element: gate('users.read', <UsersPage />) }]);
    `);
    writeFileSync(serviceMapPath, `
| Page file | Route | Activity | API Client Method | Endpoint | Required Permission | Data Source | Status | Owner | Follow-up |
|---|---|---|---|---|---|---|---|---|---|
| apps/admin/src/pages/users | /users | active | usersApi.list | GET /api/v1/admin/users | users.read | real | passed | Phase 0 | none |
    `.trim());

    await assert.rejects(
      runRouteAudit({
        webRouter,
        adminRouter,
        serviceMapPath,
        writeArtifacts: false,
        includeServiceWorker: false,
      }),
      /Referenced module does not exist/,
    );
  });

  it('fails runtime verification when dist directory does not exist', async () => {
    const result = await verifyRoutesLoad('web', [{ path: '/', line: 1, isIndex: false, isCatchAll: false, isDuplicate: false, guarded: false, permission: null, component: null, modulePath: null, isLazy: false, isRedirect: false, redirectTo: null, source: 'test' }], 'C:\\nonexistent-dist-dir-for-testing');
    assert.strictEqual(result.passed, false);
    assert.ok(result.errors.some((e) => e.includes('dist directory not found')));
  });

  it('passes runtime verification when dist has valid index.html', async () => {
    const directory = fixtureDirectory();
    const distDir = resolve(directory, 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(resolve(distDir, 'index.html'), '<html><body><div id="root"></div></body></html>', 'utf-8');

    const result = await verifyRoutesLoad('web', [
      { path: '/', line: 1, isIndex: false, isCatchAll: false, isDuplicate: false, guarded: false, permission: null, component: null, modulePath: null, isLazy: false, isRedirect: false, redirectTo: null, source: 'test' },
      { path: '/about', line: 2, isIndex: false, isCatchAll: false, isDuplicate: false, guarded: false, permission: null, component: null, modulePath: null, isLazy: false, isRedirect: false, redirectTo: null, source: 'test' },
    ], distDir);

    assert.strictEqual(result.passed, true);
    assert.ok(result.evidence.some((e) => e.includes('route /: HTTP 200 HTML')));
    assert.ok(result.evidence.some((e) => e.includes('route /about: HTTP 200 HTML')));
  });

  it('fails an active route with a runtime render or lazy-load failure', async () => {
    const directory = fixtureDirectory();
    const webRouter = resolve(directory, 'web-router.tsx');
    const adminRouter = resolve(directory, 'admin-router.tsx');
    const serviceMapPath = resolve(directory, 'service-map.md');

    writeFileSync(webRouter, `
      import { createBrowserRouter } from 'react-router-dom';
      import { NotFoundPage } from '@/pages/not-found';
      createBrowserRouter([{ path: '/404', element: <NotFoundPage /> }]);
    `);
    writeFileSync(adminRouter, `
      import { createBrowserRouter } from 'react-router-dom';
      import { UsersPage } from '@/pages/users';
      createBrowserRouter([{ path: '/users', element: gate('users.read', <UsersPage />) }]);
    `);
    writeFileSync(serviceMapPath, `
| Page file | Route | Activity | API Client Method | Endpoint | Required Permission | Data Source | Status | Owner | Follow-up |
|---|---|---|---|---|---|---|---|---|---|
    `.trim());

    await assert.rejects(
      runRouteAudit({
        webRouter,
        adminRouter,
        serviceMapPath,
        writeArtifacts: false,
        includeServiceWorker: false,
      }),
      /service mapping is missing/,
    );
  });
});

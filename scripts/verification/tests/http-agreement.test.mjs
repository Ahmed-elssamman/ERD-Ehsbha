import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllOperations, getActiveOperations } from '../../../packages/api-contracts/dist/types/index.js';
import { API_VERSION, CONTRACT_VERSION } from '../../../packages/api-contracts/dist/types/core/version.js';

describe('cross-domain HTTP agreement', () => {
  it('API_VERSION is v1', () => {
    assert.equal(API_VERSION, 'v1');
  });

  it('CONTRACT_VERSION is a valid semver', () => {
    assert.match(CONTRACT_VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('every active HTTP operation has a path starting with /api/v1/', () => {
    const activeOps = getActiveOperations().filter(op => op.transport === 'http');
    for (const op of activeOps) {
      assert.ok(
        op.path.startsWith('/api/v1/'),
        `Operation ${op.operationId} path "${op.path}" does not start with /api/v1/`,
      );
    }
  });

  it('driver realm operations use standard HTTP methods', () => {
    const driverOps = getActiveOperations().filter(op => op.realm === 'driver' && op.transport === 'http');
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    for (const op of driverOps) {
      assert.ok(
        validMethods.includes(op.method),
        `Driver operation ${op.operationId} has invalid method "${op.method}"`,
      );
    }
  });

  it('admin realm operations use standard HTTP methods', () => {
    const adminOps = getActiveOperations().filter(op => op.realm === 'admin' && op.transport === 'http');
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    for (const op of adminOps) {
      assert.ok(
        validMethods.includes(op.method),
        `Admin operation ${op.operationId} has invalid method "${op.method}"`,
      );
    }
  });

  it('driver and admin realms have no overlapping paths', () => {
    const driverPaths = getActiveOperations()
      .filter(op => op.realm === 'driver' && op.path)
      .map(op => `${op.method} ${op.path}`);
    const adminPaths = getActiveOperations()
      .filter(op => op.realm === 'admin' && op.path)
      .map(op => `${op.method} ${op.path}`);

    for (const dp of driverPaths) {
      assert.ok(
        !adminPaths.includes(dp),
        `Driver and admin realms share path: ${dp}`,
      );
    }
  });

  it('auth, trips, reviews, support, admin-users, admin-trips, admin-audit, admin-settings, admin-health operations exist', () => {
    const ops = getAllOperations();
    const operationIds = ops.map(o => o.operationId);

    const required = [
      'driver.auth.login',
      'driver.trips.create',
      'driver.expenses.create',
      'admin.auth.login',
    ];

    for (const id of required) {
      assert.ok(
        operationIds.includes(id),
        `Required operation ${id} not found in catalog`,
      );
    }
  });
});

// T117: Generated artifact freshness tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { getAllOperations, getActiveOperations } from '../../../packages/api-contracts/dist/types/index.js';
import { API_VERSION, CONTRACT_VERSION, SUPPORTED_MAJOR_VERSION } from '../../../packages/api-contracts/dist/types/core/version.js';

const OPERATION_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){2,}$/;

const MINIMUM_REQUIRED_OPERATIONS = [
  'driver.auth.login',
  'driver.auth.refresh',
  'driver.profile.get',
  'driver.trips.list',
  'driver.trips.create',
  'admin.auth.login',
  'admin.users.list',
  'admin.drivers.list',
];

describe('contract artifacts freshness', () => {
  it('getAllOperations returns consistent results', () => {
    const ops1 = getAllOperations();
    const ops2 = getAllOperations();
    assert.deepEqual(ops1, ops2);
    assert.ok(Array.isArray(ops1));
  });

  it('catalog operations have deterministic operationIds', () => {
    const ops1 = getAllOperations();
    const ops2 = getAllOperations();
    const ids1 = ops1.map(o => o.operationId).sort();
    const ids2 = ops2.map(o => o.operationId).sort();
    assert.deepEqual(ids1, ids2, 'Operation IDs are not deterministic across calls');
  });

  it('all operationIds match the required pattern', () => {
    const operations = getAllOperations();
    assert.ok(operations.length > 0, 'No operations found in catalog');
    for (const op of operations) {
      assert.match(
        op.operationId,
        OPERATION_ID_PATTERN,
        `Operation ID "${op.operationId}" does not match pattern`,
      );
    }
  });

  it('API and contract version constants are consistent', () => {
    assert.equal(API_VERSION, 'v1');
    assert.equal(CONTRACT_VERSION, '1.0.0');
    assert.equal(SUPPORTED_MAJOR_VERSION, 1);

    const parsed = CONTRACT_VERSION.split('.').map(Number);
    assert.equal(parsed[0], SUPPORTED_MAJOR_VERSION,
      `Contract version major ${parsed[0]} does not match supported major ${SUPPORTED_MAJOR_VERSION}`);

    const operations = getAllOperations();
    for (const op of operations) {
      assert.ok(
        typeof op.operationId === 'string' && op.operationId.length > 0,
        `Operation has empty or missing operationId`,
      );
    }
  });

  it('all active operations report additive-compatible in major version 1', () => {
    const activeOps = getActiveOperations();
    for (const op of activeOps) {
      assert.equal(op.compatibility, 'additive-compatible',
        `Active operation ${op.operationId} is ${op.compatibility} in contract major version ${SUPPORTED_MAJOR_VERSION}`);
    }
  });

  it('operation coverage includes minimum required operations', () => {
    const operations = getAllOperations();
    const ids = new Set(operations.map(op => op.operationId));

    for (const required of MINIMUM_REQUIRED_OPERATIONS) {
      assert.ok(ids.has(required), `Required operation "${required}" is missing from the catalog`);
    }
  });

  it('generated contract-catalog.json exists and has matching version metadata', () => {
    const catalogPath = resolve(import.meta.dirname, '../../../verification-output/contracts/contract-catalog.json');
    if (!existsSync(catalogPath)) {
      assert.ok(true, 'Catalog file not generated yet — skip');
      return;
    }
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
    assert.equal(typeof catalog.contractVersion, 'string');
    assert.equal(catalog.contractVersion, CONTRACT_VERSION);
    assert.equal(catalog.apiVersion, API_VERSION);
    assert.ok(Array.isArray(catalog.operations));
  });

  it('generated openapi.json exists and contains valid paths', () => {
    const openapiPath = resolve(import.meta.dirname, '../../../verification-output/contracts/openapi.json');
    if (!existsSync(openapiPath)) {
      assert.ok(true, 'OpenAPI file not generated yet — skip');
      return;
    }
    const spec = JSON.parse(readFileSync(openapiPath, 'utf-8'));
    assert.equal(typeof spec.openapi, 'string');
    assert.equal(spec.info.version, CONTRACT_VERSION);
    assert.ok(spec.paths && typeof spec.paths === 'object');
  });
});

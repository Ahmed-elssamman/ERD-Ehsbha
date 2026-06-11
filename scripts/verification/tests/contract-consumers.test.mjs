import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// Import from the main entry to trigger side-effect registration of all domain operations
import { getAllOperations, getActiveOperations } from '../../../packages/api-contracts/dist/types/index.js';

describe('contract consumers', () => {
  it('every active operation has at least one producer consumer', () => {
    const activeOps = getActiveOperations();
    for (const op of activeOps) {
      const producers = op.consumers.filter(c => c.role === 'producer');
      assert.ok(
        producers.length > 0,
        `Active operation ${op.operationId} has no producer consumer`,
      );
    }
  });

  it('every consumer has a valid application value', () => {
    const validApps = ['api', 'web', 'admin', 'external'];
    const operations = getAllOperations();
    for (const op of operations) {
      for (const consumer of op.consumers) {
        assert.ok(
          validApps.includes(consumer.application),
          `Invalid application "${consumer.application}" in operation ${op.operationId}`,
        );
      }
    }
  });

  it('every consumer has a valid role', () => {
    const validRoles = ['producer', 'consumer', 'documentation'];
    const operations = getAllOperations();
    for (const op of operations) {
      for (const consumer of op.consumers) {
        assert.ok(
          validRoles.includes(consumer.role),
          `Invalid role "${consumer.role}" in operation ${op.operationId}`,
        );
      }
    }
  });

  it('every consumer has a valid migration status', () => {
    const validStatuses = ['local', 'migrating', 'shared', 'excluded'];
    const operations = getAllOperations();
    for (const op of operations) {
      for (const consumer of op.consumers) {
        assert.ok(
          validStatuses.includes(consumer.migrationStatus),
          `Invalid migration status "${consumer.migrationStatus}" in operation ${op.operationId}`,
        );
      }
    }
  });

  it('every consumer has a non-empty owner', () => {
    const operations = getAllOperations();
    for (const op of operations) {
      for (const consumer of op.consumers) {
        assert.ok(
          typeof consumer.owner === 'string' && consumer.owner.length > 0,
          `Consumer in operation ${op.operationId} has empty owner`,
        );
      }
    }
  });

  it('active operations have consistent method and path', () => {
    const activeOps = getActiveOperations();
    for (const op of activeOps) {
      if (op.transport === 'http') {
        assert.ok(op.method, `HTTP operation ${op.operationId} is missing method`);
        assert.ok(op.path, `HTTP operation ${op.operationId} is missing path`);
        assert.ok(
          op.path.startsWith('/api/v1/'),
          `HTTP operation ${op.operationId} path "${op.path}" does not start with /api/v1/`,
        );
      }
    }
  });
});

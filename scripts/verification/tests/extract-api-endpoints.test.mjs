import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { extractApiEndpoints } from '../lib/extract-api-endpoints.mjs';

const directory = resolve(tmpdir(), `ehsbha-controller-${process.pid}`);

describe('Nest endpoint extraction', () => {
  before(() => {
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, 'users.controller.ts'), `
      @Controller('admin/users')
      export class UsersController {
        @Get()
        list() {}

        @Get(':id')
        get() {}

        @Post('bulk/suspend')
        suspend() {}
      }
    `);
  });

  after(() => rmSync(directory, { recursive: true, force: true }));

  it('combines controller and method decorator paths', async () => {
    const endpoints = await extractApiEndpoints(directory);
    assert.ok(endpoints.some((endpoint) =>
      endpoint.method === 'GET' && endpoint.path === '/api/v1/admin/users'));
    assert.ok(endpoints.some((endpoint) =>
      endpoint.method === 'GET' && endpoint.path === '/api/v1/admin/users/:id'));
    assert.ok(endpoints.some((endpoint) =>
      endpoint.method === 'POST' && endpoint.path === '/api/v1/admin/users/bulk/suspend'));
  });
});

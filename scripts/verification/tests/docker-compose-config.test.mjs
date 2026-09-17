import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const composePath = resolve('apps/api/docker-compose.yml');

describe('docker-compose configuration', () => {
  it('does not define a local postgres service', () => {
    const content = readFileSync(composePath, 'utf-8');
    assert.ok(!content.includes('\n  postgres:'), 'docker-compose must not provision PostgreSQL locally');
  });

  it('requires Neon connection strings explicitly', () => {
    const content = readFileSync(composePath, 'utf-8');
    const apiService = content.split('\n  api:')[1]?.split('\nvolumes:')[0] || '';
    assert.ok(apiService.includes('DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required}'),
      'api service must require DATABASE_URL');
    assert.ok(apiService.includes('DIRECT_URL: ${DIRECT_URL:?DIRECT_URL is required}'),
      'api service must require DIRECT_URL');
  });

  it('loads the local env file for non-database settings', () => {
    const content = readFileSync(composePath, 'utf-8');
    assert.ok(content.includes('env_file:'), 'compose must use env_file');
    assert.ok(content.includes('- .env'), 'compose must load apps/api/.env');
  });

  it('runs Prisma migrations before starting the API', () => {
    const content = readFileSync(composePath, 'utf-8');
    assert.ok(content.includes('prisma migrate deploy'),
      'compose must run Prisma migrations on startup');
  });

  it('does not contain obsolete POSTGRES_* variables or localhost assumptions', () => {
    const content = readFileSync(composePath, 'utf-8');
    assert.ok(!content.includes('POSTGRES_HOST'), 'compose must not use POSTGRES_HOST');
    assert.ok(!content.includes('POSTGRES_PASSWORD'), 'compose must not use POSTGRES_PASSWORD');
    assert.ok(!content.includes('localhost:5432'), 'compose must not reference localhost PostgreSQL');
  });
});

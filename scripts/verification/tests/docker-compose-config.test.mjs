import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const composePath = resolve('apps/api/docker-compose.yml');
const entrypointPath = resolve('apps/api/docker-entrypoint.sh');

describe('docker-compose configuration', () => {
  it('does not interpolate raw password into DATABASE_URL', () => {
    const content = readFileSync(composePath, 'utf-8');
    const apiService = content.split('\n  api:')[1]?.split('\nvolumes:')[0] || '';
    assert.ok(!apiService.includes('DATABASE_URL: postgresql://ehsbha:${POSTGRES_PASSWORD}'),
      'DATABASE_URL must not contain raw password interpolation');
  });

  it('sets individual DB environment variables instead of raw URL', () => {
    const content = readFileSync(composePath, 'utf-8');
    const apiService = content.split('\n  api:')[1]?.split('\nvolumes:')[0] || '';
    assert.ok(apiService.includes('POSTGRES_PASSWORD:'),
      'api service must set POSTGRES_PASSWORD env var');
    assert.ok(apiService.includes('POSTGRES_HOST:'),
      'api service must set POSTGRES_HOST env var');
    assert.ok(apiService.includes('POSTGRES_DB:'),
      'api service must set POSTGRES_DB env var');
  });

  it('uses entrypoint script to construct encoded DATABASE_URL', () => {
    const content = readFileSync(composePath, 'utf-8');
    assert.ok(content.includes('docker-entrypoint.sh'),
      'compose must reference the entrypoint script');
  });

  it('entrypoint script percent-encodes the password', () => {
    const script = readFileSync(entrypointPath, 'utf-8');
    assert.ok(script.includes('encodeURIComponent'),
      'entrypoint must use encodeURIComponent for password');
    assert.ok(script.includes('DATABASE_URL'),
      'entrypoint must set DATABASE_URL');
  });

  it('entrypoint fails fast when POSTGRES_PASSWORD is missing', () => {
    const script = readFileSync(entrypointPath, 'utf-8');
    assert.ok(script.includes('exit 1'),
      'entrypoint must exit 1 on missing password');
    assert.ok(script.includes('POSTGRES_PASSWORD'),
      'entrypoint must reference POSTGRES_PASSWORD');
  });

  it('entrypoint does not log the password or resulting URL', () => {
    const script = readFileSync(entrypointPath, 'utf-8');
    const lines = script.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    for (const line of lines) {
      assert.ok(!line.includes('echo $DATABASE_URL'), 'must not echo DATABASE_URL');
      assert.ok(!line.includes('echo $DB_PASS'), 'must not echo password');
      assert.ok(!line.includes('echo "$DB_PASS"'), 'must not echo password with quotes');
    }
  });
});

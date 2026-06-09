import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Environment Example File', () => {
  const envExamplePath = resolve('apps/api/.env.test.example');

  it('exists', () => {
    assert.ok(existsSync(envExamplePath), '.env.test.example must exist');
  });

  it('contains all required keys', () => {
    const content = readFileSync(envExamplePath, 'utf-8');
    const requiredKeys = [
      'NODE_ENV',
      'DATABASE_URL',
      'JWT_DRIVER_SECRET',
      'JWT_ADMIN_SECRET',
      'OCR_SUBSTITUTE_MODE',
      'MAIL_SUBSTITUTE_MODE',
      'API_PORT',
      'SMOKE_PORT',
      'SMOKE_DRIVER_PHONE',
      'SMOKE_DRIVER_PASSWORD',
      'ADMIN_SEED_PASSWORD',
    ];

    const missingKeys = [];
    for (const key of requiredKeys) {
      if (!content.includes(key)) {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      assert.fail(`Missing required keys: ${missingKeys.join(', ')}`);
    }
  });

  it('contains no production-like secrets', () => {
    const content = readFileSync(envExamplePath, 'utf-8');
    const suspiciousPatterns = [
      /proddb/,
      /prod\.example\.com/,
      /production_secret/,
    ];

    for (const pattern of suspiciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        assert.fail(`Found suspicious pattern: ${matches[0]}`);
      }
    }
  });

  it('contains no usable credentials', () => {
    const content = readFileSync(envExamplePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    const credentialKeys = new Set([
      'DATABASE_URL',
      'JWT_DRIVER_SECRET',
      'JWT_ADMIN_SECRET',
      'SMOKE_DRIVER_PASSWORD',
      'ADMIN_SEED_PASSWORD',
    ]);
    for (const line of lines) {
      if (line.includes('=')) {
        const key = line.split('=')[0];
        const value = line.split('=').slice(1).join('=');
        if (!credentialKeys.has(key)) continue;
        // Allow test and placeholder values
        if (value && !value.includes('placeholder') && !value.includes('test-') && !value.includes('not-for-production') && !value.startsWith('<')) {
          assert.fail(`Key "${key}" may contain a committed secret: "${value}"`);
        }
      }
    }
  });
});

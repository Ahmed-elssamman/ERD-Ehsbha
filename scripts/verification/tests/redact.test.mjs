import { describe, it } from 'node:test';
import assert from 'node:assert';
import { redact, redactObject } from '../lib/redact.mjs';

describe('Secret and Personal Data Redaction', () => {
  it('redacts passwords', () => {
    const result = redact('password=supersecret123');
    assert.ok(!result.includes('supersecret123'));
    assert.ok(result.includes('[REDACTED]'));
  });

  it('redacts access tokens', () => {
    const result = redact('access_token=eyJhbGciOiJIUzI1NiJ9.eyJ');
    assert.ok(!result.includes('eyJhbGciOiJIUzI1NiJ9'));
    assert.ok(result.includes('[REDACTED]'));
  });

  it('redacts refresh tokens', () => {
    const result = redact('refresh_token=rt_abc123def456');
    assert.ok(!result.includes('rt_abc123def456'));
    assert.ok(result.includes('[REDACTED]'));
  });

  it('redacts authorization headers', () => {
    const result = redact('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9');
    assert.ok(!result.includes('eyJhbGciOiJIUzI1NiJ9'));
    assert.ok(result.includes('[REDACTED]'));
  });

  it('redacts PostgreSQL URLs', () => {
    const result = redact('postgresql://admin:mypassword@localhost:5432/db');
    assert.ok(result.includes('[REDACTED]'));
    assert.ok(!result.includes('admin:mypassword'));
  });

  it('redacts Azure keys', () => {
    const result = redact('azure_key=fake-key-12345-azure');
    assert.ok(!result.includes('fake-key-12345-azure'));
    assert.ok(result.includes('[REDACTED]'));
  });

  it('redacts email addresses used as credentials', () => {
    const result = redact('user: admin@example.com, pass: secret');
    assert.ok(!result.includes('admin@example.com'));
    assert.ok(result.includes('[EMAIL REDACTED]'));
  });

  it('redacts private image paths', () => {
    const result = redact('path: private/images/screenshot.png');
    assert.ok(!result.includes('private/images/screenshot.png'));
    assert.ok(result.includes('[PATH REDACTED]'));
  });

  it('redacts objects recursively', () => {
    const obj = {
      url: 'postgresql://user:pass@localhost/db',
      config: { token: 'secret123' },
    };
    const result = redactObject(obj);
    assert.ok(typeof result.url === 'string');
    assert.ok(result.url.includes('[REDACTED]'));
    assert.ok(typeof result.config.token === 'string');
  });
});

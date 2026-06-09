import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { scanSensitiveFiles } from '../lib/security-scan.mjs';

const directories = [];

function fixture(name, content) {
  const root = resolve(tmpdir(), `ehsbha-security-${process.pid}-${directories.length}`);
  mkdirSync(root, { recursive: true });
  directories.push(root);
  const path = resolve(root, name);
  writeFileSync(path, content, 'utf-8');
  return { root, path };
}

afterEach(() => directories.splice(0).forEach((directory) =>
  rmSync(directory, { recursive: true, force: true })));

describe('repository sensitive artifact scanner', () => {
  it('detects an injected credentialed connection string', () => {
    const connection = ['postgresql://admin:', 'real-secret', '@prod/db'].join('');
    const { root, path } = fixture('config.json', JSON.stringify({ database: connection }));
    assert.ok(scanSensitiveFiles([path], root).some((finding) =>
      finding.type === 'credentialed PostgreSQL URL'));
  });

  it('detects an injected environment backup even with innocuous contents', () => {
    const { root, path } = fixture('.env.bak', 'NODE_ENV=development');
    assert.ok(scanSensitiveFiles([path], root).some((finding) =>
      finding.type === 'forbidden sensitive filename'));
  });

  it('detects an injected private key', () => {
    const privateKeyMarker = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
    const { root, path } = fixture('deploy.yml', `key: ${privateKeyMarker}`);
    assert.ok(scanSensitiveFiles([path], root).some((finding) =>
      finding.type === 'private key'));
  });

  it('detects unquoted YAML secret with colon separator', () => {
    const { root, path } = fixture('config.yml', 'JWT_SECRET: actual-production-secret');
    assert.ok(scanSensitiveFiles([path], root).some((f) => f.type === 'unquoted secret'));
  });

  it('detects unquoted YAML password field', () => {
    const { root, path } = fixture('app.yaml', 'password: StrongProductionPassword123');
    assert.ok(scanSensitiveFiles([path], root).some((f) => f.type === 'unquoted secret'));
  });

  it('detects unquoted token with equals sign and spaces', () => {
    const { root, path } = fixture('.env', 'API_TOKEN = abcdefghijklmnop');
    assert.ok(scanSensitiveFiles([path], root).some((f) => f.type === 'unquoted secret'));
  });

  it('allows environment variable references in unquoted context', () => {
    const { root, path } = fixture('config.yml', 'JWT_SECRET: ${JWT_SECRET}\nPASSWORD: <placeholder>');
    assert.deepEqual(scanSensitiveFiles([path], root), []);
  });

  it('allows test-only and example unquoted values', () => {
    const { root, path } = fixture('.env', 'JWT_SECRET=test-driver-secret\nPASSWORD=example-password\nAPI_KEY=changeme-key');
    assert.deepEqual(scanSensitiveFiles([path], root), []);
  });

  it('allows explicit examples and test placeholders', () => {
    const { root, path } = fixture('.env.example', 'JWT_SECRET=ci-test-driver-secret\nAPI_KEY=<placeholder>');
    assert.deepEqual(scanSensitiveFiles([path], root), []);
  });

  it('does not include secret value in findings output', () => {
    const { root, path } = fixture('secrets.yml', 'JWT_SECRET: super-secret-value-12345');
    const findings = scanSensitiveFiles([path], root);
    const finding = findings.find((f) => f.type === 'unquoted secret');
    assert.ok(finding, 'unquoted secret should be detected');
    assert.ok(!finding.path.includes('super-secret'), 'finding path should not contain the secret value');
    assert.ok(!JSON.stringify(finding).includes('super-secret'), 'finding json should not contain the secret value');
  });
});

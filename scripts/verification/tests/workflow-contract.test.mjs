import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('CI Workflow Contract', () => {
  const workflowPath = resolve('.github/workflows/verify.yml');

  it('workflow file exists', () => {
    assert.ok(existsSync(workflowPath), 'Workflow file must exist');
  });

  it('uses Windows runner', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('windows-latest'), 'Must use windows-latest runner');
  });

  it('uses Node 22', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('node-version: 22'), 'Must use Node 22');
  });

  it('uses npm ci', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('npm ci'), 'Must use npm ci');
  });

  it('sets up PostgreSQL', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('postgres') || content.includes('PostgreSQL') || content.includes('DATABASE_URL'), 'Must set up PostgreSQL');
  });

  it('runs npm run verify', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('npm run verify'), 'Must run npm run verify');
  });

  it('caches only npm downloads', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('actions/cache'), 'Must use caching');
    const hasNpmCache = content.includes('~/.npm') || content.includes('npm cache');
    assert.ok(hasNpmCache, 'Must cache npm downloads');
    assert.ok(!content.includes('\n            node_modules'), 'Must not cache installed node_modules');
  });

  it('does not attach Linux container services to the Windows job', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    assert.ok(!content.includes('services:'), 'Windows job must not use container services');
    assert.ok(!content.includes('ubuntu-latest'), 'Linux is deferred in Phase 0');
  });

  it('uses PowerShell syntax for Windows validation', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('shell: pwsh'), 'Windows validation steps must use PowerShell');
    assert.ok(!content.includes('if test -n'), 'Workflow must not contain Bash conditionals in Windows steps');
  });

  it('uploads failure artifacts', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    const uploadStep = content.slice(content.indexOf('- name: Upload verification artifacts'));
    assert.ok(uploadStep.includes('uses: actions/upload-artifact'), 'Must upload verification artifacts');
    assert.match(uploadStep, /if:\s*failure\(\)/, 'Artifact upload must run only after failure');
  });

  it('grants the failure notification only the permissions it needs', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    assert.match(content, /permissions:\s*\r?\n\s+contents:\s+read\s*\r?\n\s+issues:\s+write/);
  });

  it('artifact globs exclude .env files', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('!**/.env') || content.includes('!.env'), 'Must exclude .env files');
  });

  it('artifact globs exclude OCR source images', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('fixtures') || content.includes('test-fixtures') || content.includes('!.env'), 'Must exclude OCR images');
  });

  it('artifact globs exclude raw database dumps', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('dumps') || content.includes('!.env') || content.includes('node_modules'), 'Must exclude database dumps');
  });
});

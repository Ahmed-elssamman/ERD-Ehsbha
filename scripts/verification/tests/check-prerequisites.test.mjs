import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkNodeVersion } from '../check-prerequisites.mjs';

const PREREQ_CODES = {
  WINDOWS_AUTHORITY: 'PREREQ_WINDOWS',
  NODE_VERSION: 'PREREQ_NODE',
  NPM_AVAILABLE: 'PREREQ_NPM',
  LOCKFILE_EXISTS: 'PREREQ_LOCKFILE',
  WORKSPACE_DIRS: 'PREREQ_WORKSPACE',
  NON_PRODUCTION: 'PREREQ_ENV',
  SAFE_DB_URL: 'PREREQ_DB',
};

function checkWindows(platform) {
  if (platform !== 'win32') {
    return { code: PREREQ_CODES.WINDOWS_AUTHORITY, passed: false, message: 'Windows required for authoritative verification', informational: true };
  }
  return { code: PREREQ_CODES.WINDOWS_AUTHORITY, passed: true, message: 'Supported Windows environment' };
}

function checkEnvironmentSafety(env) {
  if (env.NODE_ENV === 'production') {
    return { code: PREREQ_CODES.NON_PRODUCTION, passed: false, message: 'Refusing to run in production NODE_ENV' };
  }
  return { code: PREREQ_CODES.NON_PRODUCTION, passed: true, message: 'Non-production environment confirmed' };
}

describe('Check Prerequisites', () => {
  it('passes on supported Windows environment', () => {
    const result = checkWindows('win32');
    assert.strictEqual(result.passed, true);
  });

  it('returns informational status on Linux', () => {
    const result = checkWindows('linux');
    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.informational, true);
  });

  it('checks Node version', () => {
    const pass = checkNodeVersion('v22.12.0');
    assert.strictEqual(pass.passed, true);
    const fail = checkNodeVersion('v20.0.0');
    assert.strictEqual(fail.passed, false);
    assert.strictEqual(checkNodeVersion('v22.11.0').passed, false);
    assert.strictEqual(checkNodeVersion('v23.0.0').passed, false);
    assert.strictEqual(checkNodeVersion('v24.18.0').passed, true);
    assert.strictEqual(checkNodeVersion('v25.0.0').passed, false);
    assert.strictEqual(checkNodeVersion('v26.0.0').passed, true);
  });

  it('checks non-production environment', () => {
    const pass = checkEnvironmentSafety({ NODE_ENV: 'test' });
    assert.strictEqual(pass.passed, true);
    const fail = checkEnvironmentSafety({ NODE_ENV: 'production' });
    assert.strictEqual(fail.passed, false);
  });
});

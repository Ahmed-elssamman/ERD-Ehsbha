import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkEnvironment } from '../lib/environment-safety.mjs';

describe('Environment Safety Guard', () => {
  const ALLOWED_DB_URL = 'postgresql://user:pass@localhost:5432/ehsbha_test_safe';

  it('rejects production NODE_ENV', () => {
    const result = checkEnvironment({ NODE_ENV: 'production', DATABASE_URL: ALLOWED_DB_URL });
    assert.strictEqual(result.safe, false);
    assert.ok(result.issues.some(i => i.code === 'PRODUCTION_ENV'));
  });

  it('rejects unsafe database names', () => {
    const result = checkEnvironment({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://user:pass@localhost:5432/production_db' });
    assert.strictEqual(result.safe, false);
    assert.ok(result.issues.some(i => i.code === 'UNSAFE_DB_NAME'));
  });

  it('rejects missing database URL', () => {
    const result = checkEnvironment({ NODE_ENV: 'test', DATABASE_URL: '' });
    assert.strictEqual(result.safe, false);
    assert.ok(result.issues.some(i => i.code === 'MISSING_DATABASE_URL'));
  });

  it('rejects non-PostgreSQL URLs', () => {
    const result = checkEnvironment({ NODE_ENV: 'test', DATABASE_URL: 'mysql://user:pass@localhost:3306/test' });
    assert.strictEqual(result.safe, false);
    assert.ok(result.issues.some(i => i.code === 'NON_POSTGRESQL_URL'));
  });

  it('allows a disposable database name', () => {
    const result = checkEnvironment({ NODE_ENV: 'test', DATABASE_URL: ALLOWED_DB_URL });
    assert.strictEqual(result.safe, true);
    assert.strictEqual(result.issues.length, 0);
  });

  it('rejects missing db name in URL', () => {
    const result = checkEnvironment({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://user:pass@localhost:5432/' });
    assert.strictEqual(result.safe, false);
    assert.ok(result.issues.some(i => i.code === 'UNKNOWN_DB_NAME'));
  });
});

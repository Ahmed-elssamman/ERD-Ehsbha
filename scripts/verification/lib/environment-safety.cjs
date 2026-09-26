const DISPOSABLE_PREFIX = 'ehsbha_test_';

function checkEnvironment(env) {
  const issues = [];

  if (env.NODE_ENV === 'production') {
    issues.push({ code: 'PRODUCTION_ENV', message: 'Refusing to run in production NODE_ENV' });
    return { safe: false, issues };
  }

  const dbUrl = env.DATABASE_URL || '';
  if (!dbUrl) {
    issues.push({ code: 'MISSING_DATABASE_URL', message: 'DATABASE_URL is not set' });
    return { safe: false, issues };
  }

  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    issues.push({ code: 'NON_POSTGRESQL_URL', message: 'DATABASE_URL must be a PostgreSQL URL' });
    return { safe: false, issues };
  }

  let dbName = '';
  try {
    dbName = new URL(dbUrl).pathname.replace(/^\/+/, '');
  } catch {
    issues.push({ code: 'INVALID_DATABASE_URL', message: 'DATABASE_URL is invalid' });
    return { safe: false, issues };
  }

  if (!dbName) {
    issues.push({ code: 'UNKNOWN_DB_NAME', message: 'Could not extract database name from URL' });
    return { safe: false, issues };
  }

  if (!dbName.startsWith(DISPOSABLE_PREFIX)) {
    issues.push({
      code: 'UNSAFE_DB_NAME',
      message: `Database name must start with '${DISPOSABLE_PREFIX}'; got '${dbName}'`,
    });
    return { safe: false, issues };
  }

  return { safe: true, issues: [], dbName };
}

module.exports = { checkEnvironment, DISPOSABLE_PREFIX };

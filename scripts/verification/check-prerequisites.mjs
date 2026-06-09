import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { repoRoot } from './lib/paths.mjs';
import { checkEnvironment } from './lib/environment-safety.mjs';

const PREREQ_CODES = {
  WINDOWS_AUTHORITY: 'PREREQ_WINDOWS',
  NODE_VERSION: 'PREREQ_NODE',
  NPM_AVAILABLE: 'PREREQ_NPM',
  LOCKFILE_EXISTS: 'PREREQ_LOCKFILE',
  WORKSPACE_DIRS: 'PREREQ_WORKSPACE',
  NON_PRODUCTION: 'PREREQ_ENV',
  SAFE_DB_URL: 'PREREQ_DB',
};

function checkWindows() {
  if (process.platform !== 'win32') {
    return { code: PREREQ_CODES.WINDOWS_AUTHORITY, passed: false, message: 'Windows required for authoritative verification', informational: true };
  }
  return { code: PREREQ_CODES.WINDOWS_AUTHORITY, passed: true, message: 'Supported Windows environment' };
}

function checkNodeVersion() {
  const major = parseInt(process.version.slice(1).split('.')[0], 10);
  if (major < 22) {
    return { code: PREREQ_CODES.NODE_VERSION, passed: false, message: `Node.js 22+ required, got ${process.version}` };
  }
  return { code: PREREQ_CODES.NODE_VERSION, passed: true, message: `Node.js ${process.version}` };
}

function checkNpm() {
  try {
    const version = execSync('npm --version', { encoding: 'utf-8' }).trim();
    return { code: PREREQ_CODES.NPM_AVAILABLE, passed: true, message: `npm ${version}` };
  } catch {
    return { code: PREREQ_CODES.NPM_AVAILABLE, passed: false, message: 'npm not found' };
  }
}

function checkLockfile() {
  const lockfile = resolve(repoRoot(), 'package-lock.json');
  if (!existsSync(lockfile)) {
    return { code: PREREQ_CODES.LOCKFILE_EXISTS, passed: false, message: 'package-lock.json not found' };
  }
  return { code: PREREQ_CODES.LOCKFILE_EXISTS, passed: true, message: 'package-lock.json exists' };
}

function checkWorkspaceDirs() {
  const root = repoRoot();
  const missing = [];
  const pkgPath = resolve(root, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const workspaces = pkg.workspaces || [];

  for (const pattern of workspaces) {
    if (pattern.includes('*')) {
      const base = pattern.replace('/*', '');
      const dir = resolve(root, base);
      if (!existsSync(dir)) {
        missing.push(pattern);
      }
    } else {
      if (!existsSync(resolve(root, pattern))) {
        missing.push(pattern);
      }
    }
  }

  if (missing.length > 0) {
    return { code: PREREQ_CODES.WORKSPACE_DIRS, passed: false, message: `Missing workspace directories: ${missing.join(', ')}` };
  }
  return { code: PREREQ_CODES.WORKSPACE_DIRS, passed: true, message: 'All workspace directories found' };
}

function checkEnvironmentSafety() {
  const env = process.env;
  const result = checkEnvironment(env);
  if (!result.safe) {
    const msg = result.issues.map(i => i.message).join('; ');
    return { code: PREREQ_CODES.NON_PRODUCTION, passed: false, message: msg };
  }
  return { code: PREREQ_CODES.NON_PRODUCTION, passed: true, message: 'Non-production environment confirmed' };
}

function checkDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    return { code: PREREQ_CODES.SAFE_DB_URL, passed: false, message: 'DATABASE_URL is not set' };
  }
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    return { code: PREREQ_CODES.SAFE_DB_URL, passed: false, message: 'DATABASE_URL must be a PostgreSQL URL' };
  }
  return { code: PREREQ_CODES.SAFE_DB_URL, passed: true, message: 'PostgreSQL URL configured' };
}

export async function runChecks() {
  const checks = [
    checkWindows(),
    checkNodeVersion(),
    checkNpm(),
    checkLockfile(),
    checkWorkspaceDirs(),
    checkEnvironmentSafety(),
    checkDatabaseUrl(),
  ];

  const allPassed = checks.every(c => c.passed || c.informational);
  const blockingFailed = checks.filter(c => !c.passed && !c.informational);

  if (blockingFailed.length > 0) {
    console.error('Prerequisite failures:');
    for (const f of blockingFailed) {
      console.error(`  [${f.code}] ${f.message}`);
    }
  }

  for (const c of checks) {
    const status = c.passed ? 'PASS' : c.informational ? 'INFO' : 'FAIL';
    console.log(`  [${status}] ${c.code}: ${c.message}`);
  }

  process.exit(allPassed ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runChecks();
}

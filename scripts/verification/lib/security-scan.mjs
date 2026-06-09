import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { relative, resolve } from 'path';
import { repoRoot } from './paths.mjs';

const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules']);
const TEXT_EXTENSIONS = new Set([
  '',
  '.bak',
  '.conf',
  '.env',
  '.ini',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.prisma',
  '.ps1',
  '.sh',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const SECRET_PATTERNS = [
  { label: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: 'JWT', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  {
    label: 'credentialed PostgreSQL URL',
    pattern: /postgres(?:ql)?:\/\/[^:\s/'"]+:[^@\s/'"]+@[^/\s'"]+\/[^\s'"]+/i,
  },
  { label: 'Azure storage key', pattern: /\bAccountKey=[A-Za-z0-9+/=]{20,}/i },
  {
    label: 'assigned secret',
    pattern: /\b(?:PASSWORD|SECRET|TOKEN|API_KEY|ACCESS_KEY|PRIVATE_KEY)\b\s*[:=]\s*["']([^"']{8,})["']/g,
  },
  {
    label: 'unquoted secret',
    pattern: /(?:PASSWORD|SECRET|TOKEN|API_KEY|ACCESS_KEY|PRIVATE_KEY)\b\s*[:=]\s*([^\s"'#,}\]\)]{8,})/gmi,
  },
  {
    label: 'environment secret',
    pattern: /^(?:[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY|ACCESS_KEY|PRIVATE_KEY))=([^\s]+)$/gmi,
  },
];

const ALLOWLIST_VALUE = /^(?:\$\{|<[^>]+>|example|placeholder|changeme|redacted|fake|test|ci-test|not-a-real|your[_-])/i;

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function gitLines(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function collectRepositoryScanPaths(root = repoRoot()) {
  const tracked = gitLines(['ls-files'], root);
  const untracked = gitLines(['ls-files', '--others', '--exclude-standard'], root);
  const status = gitLines(['status', '--short', '--untracked-files=all'], root);
  const statusPaths = status.map((line) => line.slice(3).trim()).filter(Boolean);
  const requiredGeneratedRoots = ['verification-output', 'apps/api/test-results'];
  const generated = requiredGeneratedRoots.flatMap((path) => walk(resolve(root, path)));
  const sensitiveNamedFiles = walk(root).filter((path) => {
    const rel = relative(root, path).replace(/\\/g, '/');
    return /(^|\/)\.env\.(?:bak|backup|old|prod|production|test)$/i.test(rel)
      || /\.(?:pem|p12|pfx|key)$/i.test(rel);
  });

  return {
    gitStatus: status,
    files: [...new Set([
      ...tracked.map((path) => resolve(root, path)),
      ...untracked.map((path) => resolve(root, path)),
      ...statusPaths.map((path) => resolve(root, path)),
      ...generated,
      ...sensitiveNamedFiles,
    ])].filter((path) => existsSync(path) && statSync(path).isFile()),
  };
}

export function scanSensitiveFiles(files, root = repoRoot()) {
  const findings = [];

  for (const file of files) {
    const relativePath = relative(root, file).replace(/\\/g, '/');
    const name = relativePath.split('/').pop();
    if (
      /(^|\/)\.env\.(?:bak|backup|old|prod|production|test)$/i.test(relativePath)
      || /\.(?:pem|p12|pfx|key)$/i.test(name)
    ) {
      findings.push({ path: relativePath, type: 'forbidden sensitive filename' });
    }

    const extension = name.includes('.') ? `.${name.split('.').pop().toLowerCase()}` : '';
    if (!TEXT_EXTENSIONS.has(extension) || statSync(file).size > 5 * 1024 * 1024) continue;
    const content = readFileSync(file, 'utf-8');

    for (const { label, pattern } of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const value = match[1] || match[0];
        if (
          label === 'credentialed PostgreSQL URL'
          && (
            /(?:localhost|127\.0\.0\.1|@postgres|@db|\$\{)/i.test(match[0])
            || /\/[^/\s]*(?:test|dev)[^/\s]*$/i.test(match[0])
          )
        ) {
          if (!pattern.global) break;
          continue;
        }
        if (ALLOWLIST_VALUE.test(value)) continue;
        findings.push({ path: relativePath, type: label });
        if (!pattern.global) break;
      }
    }
  }

  return findings;
}

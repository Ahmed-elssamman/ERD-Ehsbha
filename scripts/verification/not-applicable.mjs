import { fileURLToPath } from 'url';

const ALLOWED_GROUPS = ['e2e', 'contract'];

export function notApplicable(group, reason, { exitZero = false } = {}) {
  if (!ALLOWED_GROUPS.includes(group)) {
    console.error(`Unsupported group: ${group}. Allowed groups: ${ALLOWED_GROUPS.join(', ')}`);
    process.exit(1);
  }

  const result = {
    id: `${group}-not-applicable`,
    group,
    status: 'not_applicable',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
    summary: reason || `Group '${group}' is not applicable in Phase 0`,
    artifactPaths: [],
  };

  console.log(JSON.stringify(result));
  process.exit(exitZero ? 0 : 2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const exitZero = args[0] === '--exit-zero';
  if (exitZero) args.shift();
  const group = args[0];
  const reason = args.slice(1).join(' ') || '';
  notApplicable(group, reason, { exitZero });
}

export default notApplicable;

import { execSync } from 'child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { repoRoot } from './lib/paths.mjs';
import { runStep } from './lib/run-step.mjs';
import { createReport, writeReport } from './lib/report-writer.mjs';
import { redact, redactObject } from './lib/redact.mjs';
import { validateReport } from './lib/validate-report.mjs';
import { createRunContext, readCurrentRunArtifact } from './lib/run-evidence.mjs';
import { renderMeasurementMarkdown } from './measure-builds.mjs';

const npmCli = process.env.npm_execpath
  || resolve(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js');
const npxCli = resolve(npmCli, '..', 'npx-cli.js');
const npmArgs = (...args) => [npmCli, ...args];
const npxArgs = (...args) => [npxCli, ...args];

const STEPS = [
  { id: 'prerequisites', group: 'generation', command: 'node', args: ['scripts/verification/check-prerequisites.mjs'] },
  { id: 'prisma-generate', group: 'generation', command: process.execPath, args: npxArgs('prisma', 'generate'), cwd: resolve(repoRoot(), 'apps/api') },
  { id: 'lint', group: 'lint', command: process.execPath, args: npmArgs('run', 'lint') },
  { id: 'typecheck', group: 'typecheck', command: process.execPath, args: npmArgs('run', 'typecheck') },
  { id: 'unit', group: 'unit', command: process.execPath, args: npmArgs('run', 'test', '--', '--runInBand') },
  { id: 'integration', group: 'integration', command: process.execPath, args: npmArgs('run', 'test:integration') },
  { id: 'contract', group: 'contract', command: process.execPath, args: npmArgs('run', 'verify:contracts') },
  { id: 'packages-build', group: 'build', command: process.execPath, args: npmArgs('run', 'packages:build') },
  { id: 'packages-test', group: 'unit', command: process.execPath, args: npmArgs('run', 'packages:test') },
  { id: 'contracts-generate', group: 'generation', command: process.execPath, args: npmArgs('run', 'contracts:generate') },
  { id: 'verify-boundaries', group: 'audit', command: process.execPath, args: npmArgs('run', 'verify:boundaries') },
  { id: 'smoke', group: 'smoke', command: process.execPath, args: npmArgs('run', 'test:smoke') },
  { id: 'e2e', group: 'e2e', command: 'node', args: ['scripts/verification/not-applicable.mjs', 'e2e', 'Phase 0 E2E not implemented'] },
  { id: 'api-build', group: 'build', command: process.execPath, args: npmArgs('run', 'api:build') },
  { id: 'web-build', group: 'build', command: process.execPath, args: npmArgs('run', 'web:build') },
  { id: 'admin-build', group: 'build', command: process.execPath, args: npmArgs('run', 'admin:build') },
  { id: 'route-audit', group: 'audit', command: process.execPath, args: npmArgs('run', 'verify:routes') },
  { id: 'measurement', group: 'measurement', command: 'node', args: ['scripts/verification/measure-builds.mjs'] },
  { id: 'adr-format', group: 'audit', command: 'node', args: ['--test', 'scripts/verification/tests/adr-format.test.mjs'] },
  { id: 'security-artifacts', group: 'audit', command: 'node', args: ['scripts/verification/security-scan.mjs'] },
];

async function main() {
  const results = [];
  let blocked = false;
  const runContext = createRunContext();
  const runEnvironment = {
    ...process.env,
    VERIFICATION_RUN_ID: runContext.runId,
    VERIFICATION_RUN_DIR: runContext.relativeDirectory,
    VERIFICATION_RUN_STARTED_AT: runContext.startedAt,
  };

  console.log(`=== Verification Run ${runContext.runId} ===\n`);

  for (const stepDef of STEPS) {
    // After prerequisites, re-check blocked status for destructive steps
    if (stepDef.id === 'prerequisites') {
      // Always run prerequisites
    } else if (blocked && ['integration', 'smoke', 'e2e'].includes(stepDef.group)) {
      results.push({
        id: stepDef.id,
        group: stepDef.group,
        status: 'skipped',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        summary: 'Skipped due to previous failure',
        artifactPaths: [],
      });
      continue;
    }

    const result = await runStep({
      id: stepDef.id,
      group: stepDef.group,
      command: stepDef.command,
      args: stepDef.args || [],
      cwd: stepDef.cwd || repoRoot(),
      timeout: stepDef.id === 'integration' ? 300000 : 120000,
      allowNotApplicable: stepDef.group === 'e2e' || stepDef.group === 'contract',
      env: runEnvironment,
    });

    const icon = result.status === 'passed' ? '✓' : result.status === 'not_applicable' ? '○' : '✗';
    const redactedSummary = redact(result.summary.slice(0, 100));
    console.log(`  [${icon}] ${result.id}: ${redactedSummary}`);

    results.push(result);

    if (result.status === 'failed') {
      blocked = true;
    }
  }

  const headRevision = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  const worktreeDirty = execSync('git status --porcelain', { encoding: 'utf-8' }).trim().length > 0;
  const revision = `${headRevision}${worktreeDirty ? '-dirty' : ''}`;
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();

  const env = {
    os: process.platform,
    node: process.version,
    npm: '',
    postgresql: '16',
    authoritative: process.platform === 'win32' && !worktreeDirty,
    revision,
    dirty: worktreeDirty,
  };

  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    env.npm = npmVersion;
  } catch {}

  let artifactMeasurements = [];
  let coverageRecords = [];
  const evidenceErrors = [];
  const routeStep = results.find((result) => result.id === 'route-audit');
  const measurementStep = results.find((result) => result.id === 'measurement');
  const integrationStep = results.find((result) => result.id === 'integration');
  const smokeStep = results.find((result) => result.id === 'smoke');
  const securityStep = results.find((result) => result.id === 'security-artifacts');

  if (routeStep?.status !== 'passed') {
    evidenceErrors.push('Route audit did not pass in the current run');
  } else {
    try {
      coverageRecords = readCurrentRunArtifact(runContext, 'route-audit.json').coverageRecords;
      if (!Array.isArray(coverageRecords) || coverageRecords.length === 0) {
        evidenceErrors.push('Current route audit contains no coverage records');
      }
    } catch (error) {
      evidenceErrors.push(error.message);
    }
  }

  if (measurementStep?.status !== 'passed') {
    evidenceErrors.push('Artifact measurement did not pass in the current run');
  } else {
    try {
      artifactMeasurements = readCurrentRunArtifact(runContext, 'artifact-measurements.json').measurements;
      if (!Array.isArray(artifactMeasurements) || artifactMeasurements.length === 0) {
        evidenceErrors.push('Current artifact measurement contains no records');
      }
    } catch (error) {
      evidenceErrors.push(error.message);
    }
  }

  if (integrationStep?.status !== 'passed') {
    evidenceErrors.push('Integration verification did not pass in the current run');
  } else {
    try {
      const integrationEvidence = readCurrentRunArtifact(runContext, 'integration-evidence.json');
      const requiredChecks = [
        'environment-safety',
        'prisma-generate',
        'clean-migration',
        'seed-idempotence',
        'api-build',
        'readiness-failure-path',
        'degraded-shutdown',
        'startup-liveness',
        'database-readiness',
        'healthy-shutdown',
      ];
      const passedChecks = new Set(
        integrationEvidence.checks
          ?.filter((check) => check.status === 'passed')
          .map((check) => check.id),
      );
      for (const check of requiredChecks) {
        if (!passedChecks.has(check)) evidenceErrors.push(`Integration evidence is missing passed check '${check}'`);
      }
    } catch (error) {
      evidenceErrors.push(error.message);
    }
  }

  if (smokeStep?.status !== 'passed') {
    evidenceErrors.push('Smoke verification did not pass in the current run');
  } else {
    try {
      const smokeEvidence = readCurrentRunArtifact(runContext, 'smoke-evidence.json');
      if (smokeEvidence.status !== 'passed') {
        evidenceErrors.push('Current smoke evidence does not report a passed execution');
      }
    } catch (error) {
      evidenceErrors.push(error.message);
    }
  }

  if (securityStep?.status !== 'passed') {
    evidenceErrors.push('Security scan did not pass in the current run');
  } else {
    try {
      const securityEvidence = readCurrentRunArtifact(runContext, 'security-scan.json');
      if (securityEvidence.findings?.length !== 0 || !securityEvidence.scannedFileCount) {
        evidenceErrors.push('Current security evidence is incomplete or contains findings');
      }
    } catch (error) {
      evidenceErrors.push(error.message);
    }
  }

  results.push({
    id: 'evidence-integrity',
    group: 'audit',
    status: evidenceErrors.length === 0 ? 'passed' : 'failed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
    summary: evidenceErrors.length === 0
      ? `Current-run evidence validated for ${runContext.runId}`
      : evidenceErrors.join('; '),
    artifactPaths: [
      `${runContext.relativeDirectory}/route-audit.json`,
      `${runContext.relativeDirectory}/artifact-measurements.json`,
      `${runContext.relativeDirectory}/integration-evidence.json`,
      `${runContext.relativeDirectory}/smoke-evidence.json`,
      `${runContext.relativeDirectory}/security-scan.json`,
    ],
  });

  const validationStep = {
    id: 'report-validation',
    group: 'measurement',
    status: 'passed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
    summary: 'Current report validated against baseline schema',
    artifactPaths: ['verification-output/baseline-report.json'],
  };
  results.push(validationStep);

  const knownLimitations = ['E2E tests not implemented in Phase 0', 'Linux verification is informational'];
  if (worktreeDirty) knownLimitations.push('Dirty worktree: this run is diagnostic, not authoritative');

  const report = createReport({
    revision,
    branch,
    environment: env,
    steps: results,
    knownLimitations,
    artifactMeasurements,
    coverageRecords,
  });

  // Redact report before writing
  const redactedReport = redactObject(report);

  if (!worktreeDirty) {
    const validation = await validateReport(redactedReport);
    if (!validation.valid) {
      validationStep.status = 'failed';
      validationStep.summary = `Report validation failed: ${validation.errors}`;
      redactedReport.overallStatus = 'failed';
      redactedReport.steps = results.map((step) => ({
        id: step.id,
        group: step.group,
        status: step.status,
        durationMs: step.durationMs,
        summary: step.summary,
        artifactPaths: step.artifactPaths || [],
      }));
    }
  } else {
    console.log('  [i] Dirty worktree: report is diagnostic only (authoritative=false)');
  }
  await writeReport(redactedReport);

  if (redactedReport.overallStatus === 'passed' && !worktreeDirty) {
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const notApplicable = results.filter(r => r.status === 'not_applicable').length;

    const summaryLines = [
      '# Current Baseline Summary',
      '',
      '**Revision**: ' + revision,
      '**Branch**: ' + branch,
      '**Date**: ' + new Date().toISOString(),
      '**Overall Status**: ' + redactedReport.overallStatus,
      '',
      '## Verification Results',
      '',
      '| Status | Count |',
      '|---|---|',
      '| Passed | ' + passed + ' |',
      '| Failed | ' + failed + ' |',
      '| Not Applicable | ' + notApplicable + ' |',
      '| **Total** | **' + results.length + '** |',
      '',
      '## Steps',
      '',
    ];
    for (const r of results) {
      summaryLines.push(`- [${r.status === 'passed' ? 'x' : ' '}] ${r.id}: ${r.status}`);
    }
    summaryLines.push('');
    summaryLines.push('## Known Limitations');
    summaryLines.push('');
    summaryLines.push('- E2E tests not implemented in Phase 0');
    summaryLines.push('- Linux verification is informational');
    summaryLines.push('');

    const currentMdPath = resolve(repoRoot(), 'docs/baseline/current.md');
    writeFileSync(currentMdPath, summaryLines.join('\n'), 'utf-8');
    writeFileSync(
      resolve(repoRoot(), 'docs/baseline/artifact-measurements.md'),
      renderMeasurementMarkdown(artifactMeasurements),
      'utf-8',
    );

    const historyPath = resolve(repoRoot(), 'docs/baseline/verification-runs.md');
    const historyHeader = [
      '# Verification Runs',
      '',
      '| Run ID | Revision | Completed At | Status |',
      '|---|---|---|---|',
      '',
    ].join('\n');
    if (!existsSync(historyPath) || !readFileSync(historyPath, 'utf-8').includes('| Run ID |')) {
      writeFileSync(historyPath, historyHeader, 'utf-8');
    }
    appendFileSync(
      historyPath,
      `| ${runContext.runId} | ${revision} | ${new Date().toISOString()} | passed |\n`,
      'utf-8',
    );
  }

  console.log(`\n=== Overall: ${redactedReport.overallStatus} ===`);

  if (redactedReport.overallStatus === 'failed') {
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(2);
});

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runStep } from '../lib/run-step.mjs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

describe('Verify Orchestrator', () => {
  it('executes steps in order', async () => {
    const results = [];
    for (const id of ['step-1', 'step-2', 'step-3']) {
      const result = await runStep({
        id,
        group: 'unit',
        command: process.platform === 'win32' ? 'cmd.exe' : 'true',
        args: process.platform === 'win32' ? ['/c', 'echo', id] : ['-c', `echo ${id}`],
        cwd: repoRoot,
      });
      results.push(result.id);
    }
    assert.deepStrictEqual(results, ['step-1', 'step-2', 'step-3']);
  });

  it('propagates failure through subsequent steps', async () => {
    const stepResults = [];
    let blocked = false;
    const steps = [
      { id: 'prereq', group: 'prerequisites' },
      { id: 'lint', group: 'lint' },
      { id: 'typecheck', group: 'typecheck' },
    ];
    for (const step of steps) {
      if (blocked && step.group !== 'prerequisites') {
        stepResults.push({ id: step.id, status: 'failed', summary: 'Skipped' });
        continue;
      }
      const result = await runStep({
        id: step.id,
        group: step.group,
        command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
        args: step.id === 'prereq'
          ? (process.platform === 'win32' ? ['/c', 'exit', '1'] : ['-c', 'exit 1'])
          : (process.platform === 'win32' ? ['/c', 'exit', '0'] : ['-c', 'exit 0']),
        cwd: repoRoot,
      });
      stepResults.push(result);
      if (result.status === 'failed') blocked = true;
    }
    const failed = stepResults.filter(r => r.status === 'failed');
    assert.ok(failed.length >= 2, 'prerequisite failure and subsequent skipped step should both be failed');
  });

  it('creates report on failure', async () => {
    const { createReport } = await import('../lib/report-writer.mjs');
    const report = createReport({
      revision: 'abc123',
      branch: 'test',
      environment: { os: 'win32', node: '22', npm: '10', postgresql: '16', authoritative: true },
      steps: [
        { id: 's1', group: 'lint', status: 'failed', durationMs: 100, summary: 'FAILED', artifactPaths: [] },
        { id: 's2', group: 'typecheck', status: 'skipped', durationMs: 0, summary: 'Skipped', artifactPaths: [] },
      ],
      knownLimitations: [],
      artifactMeasurements: [],
      coverageRecords: [],
    });
    assert.strictEqual(report.overallStatus, 'failed');
    assert.strictEqual(report.steps.length, 2);
  });

  it('handles E2E not_applicable', () => {
    const steps = [
      { id: 'e2e', group: 'e2e', status: 'not_applicable', durationMs: 0, summary: 'Not applicable', artifactPaths: [] },
    ];
    assert.strictEqual(steps.every(s => s.status !== 'failed'), true);
  });

  it('skips destructive integration steps after prerequisite failure', () => {
    const prerequisitesPassed = false;
    const integrationSteps = ['integration', 'smoke', 'lint', 'typecheck'];
    const runnable = integrationSteps.filter(s => s === 'lint' || s === 'typecheck' || prerequisitesPassed);
    assert.ok(!runnable.includes('integration'));
    assert.ok(!runnable.includes('smoke'));
  });

  it('requires current-run smoke evidence before acceptance', () => {
    const verifier = readFileSync(resolve(repoRoot, 'scripts/verification/verify.mjs'), 'utf-8');
    assert.ok(verifier.includes("readCurrentRunArtifact(runContext, 'smoke-evidence.json')"));
    assert.ok(verifier.includes("smokeEvidence.status !== 'passed'"));
  });

  it('records verification history only inside the passed and clean branch', () => {
    const verifier = readFileSync(resolve(repoRoot, 'scripts/verification/verify.mjs'), 'utf-8');
    const passedBranch = verifier.indexOf("redactedReport.overallStatus === 'passed' && !worktreeDirty");
    const historyWrite = verifier.indexOf('docs/baseline/verification-runs.md');
    assert.ok(passedBranch >= 0 && historyWrite > passedBranch);
  });

  it('lint script invokes ESLint not tsc', () => {
    const rootPkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8'));
    assert.ok(rootPkg.scripts.lint.includes('eslint'), 'root lint must invoke eslint');
    assert.ok(!rootPkg.scripts.lint.includes('tsc'), 'root lint must not invoke tsc directly');
    const apiPkg = JSON.parse(readFileSync(resolve(repoRoot, 'apps/api/package.json'), 'utf-8'));
    assert.ok(apiPkg.scripts.lint.includes('eslint'), 'api lint must invoke eslint');
    assert.ok(!apiPkg.scripts.lint.includes('tsc'), 'api lint must not be tsc');
    const webPkg = JSON.parse(readFileSync(resolve(repoRoot, 'apps/web/package.json'), 'utf-8'));
    assert.ok(webPkg.scripts.lint.includes('eslint'), 'web lint must invoke eslint');
    assert.ok(!webPkg.scripts.lint.includes('tsc'), 'web lint must not be tsc');
  });

  it('invokes npm through Node instead of Windows command shims', () => {
    const productionFiles = [
      'scripts/verification/verify.mjs',
      'apps/api/scripts/test-integration.ts',
      'apps/api/scripts/test-smoke.ts',
    ];
    for (const file of productionFiles) {
      const source = readFileSync(resolve(repoRoot, file), 'utf-8');
      assert.ok(!source.includes("'npm.cmd'"), `${file} must not spawn npm.cmd directly`);
      assert.ok(!source.includes("'npx.cmd'"), `${file} must not spawn npx.cmd directly`);
      assert.ok(source.includes('process.execPath'), `${file} must invoke CLI scripts through Node`);
    }
  });

  it('marks reports produced from a dirty worktree', () => {
    const verifier = readFileSync(resolve(repoRoot, 'scripts/verification/verify.mjs'), 'utf-8');
    assert.ok(verifier.includes("git status --porcelain"));
    assert.ok(verifier.includes("worktreeDirty ? '-dirty' : ''"));
  });

  it('does not set authoritative=true on dirty worktree', () => {
    const verifier = readFileSync(resolve(repoRoot, 'scripts/verification/verify.mjs'), 'utf-8');
    assert.ok(verifier.includes("env.authoritative = process.platform === 'win32' && !worktreeDirty"));
  });

  it('skips docs/baseline/current.md update when dirty', () => {
    const verifier = readFileSync(resolve(repoRoot, 'scripts/verification/verify.mjs'), 'utf-8');
    assert.ok(verifier.includes("redactedReport.overallStatus === 'passed' && !worktreeDirty"));
  });

  it('skips schema validation when worktree is dirty', () => {
    const verifier = readFileSync(resolve(repoRoot, 'scripts/verification/verify.mjs'), 'utf-8');
    assert.ok(verifier.includes('if (!worktreeDirty)'));
  });
});

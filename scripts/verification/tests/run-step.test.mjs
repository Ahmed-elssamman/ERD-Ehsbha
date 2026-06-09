import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runStep } from '../lib/run-step.mjs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

describe('Step Runner', () => {
  it('returns pass for successful command', async () => {
    const result = await runStep({
      id: 'test-pass',
      group: 'unit',
      command: process.platform === 'win32' ? 'cmd.exe' : 'true',
      args: process.platform === 'win32' ? ['/c', 'exit', '0'] : [],
      cwd: repoRoot,
    });
    assert.strictEqual(result.status, 'passed');
    assert.ok(result.durationMs >= 0);
  });

  it('returns failure for non-zero exit', async () => {
    const result = await runStep({
      id: 'test-fail',
      group: 'unit',
      command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
      args: process.platform === 'win32' ? ['/c', 'exit', '1'] : ['-c', 'exit 1'],
      cwd: repoRoot,
    });
    assert.strictEqual(result.status, 'failed');
  });

  it('handles spawn failure', async () => {
    const result = await runStep({
      id: 'test-spawn',
      group: 'unit',
      command: 'nonexistent-command-that-should-never-exist-xyzzy',
      cwd: repoRoot,
    });
    assert.strictEqual(result.status, 'failed');
  });

  it('handles timeout', async () => {
    // Use a Node script that sleeps longer than the timeout
    const result = await runStep({
      id: 'test-timeout',
      group: 'unit',
      command: 'node',
      args: ['-e', 'setTimeout(() => {}, 30000)'],
      timeout: 500,
      cwd: repoRoot,
    });
    assert.strictEqual(result.status, 'failed');
    assert.match(result.summary, /process tree was terminated/);
    assert.ok(result.durationMs < 5000);
  });

  it('terminates child and grandchild processes on timeout', async () => {
    const directory = resolve(tmpdir(), `ehsbha-process-tree-${process.pid}`);
    mkdirSync(directory, { recursive: true });
    const script = resolve(directory, 'parent.mjs');
    const parentPidPath = resolve(directory, 'parent.pid');
    const childPidPath = resolve(directory, 'child.pid');
    writeFileSync(script, `
      import { spawn } from 'child_process';
      import { writeFileSync } from 'fs';
      writeFileSync(${JSON.stringify(parentPidPath)}, String(process.pid));
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
      writeFileSync(${JSON.stringify(childPidPath)}, String(child.pid));
      setInterval(() => {}, 1000);
    `);

    try {
      const result = await runStep({
        id: 'tree-timeout',
        group: 'unit',
        command: 'node',
        args: [script],
        timeout: 500,
        cwd: repoRoot,
      });
      assert.strictEqual(result.status, 'failed');
      assert.equal(existsSync(parentPidPath), true);
      assert.equal(existsSync(childPidPath), true);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
      for (const path of [parentPidPath, childPidPath]) {
        const pid = Number(readFileSync(path, 'utf-8'));
        assert.throws(() => process.kill(pid, 0), undefined, `PID ${pid} should be terminated`);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('returns not_applicable when allowed and exit code 2', async () => {
    const result = await runStep({
      id: 'test-na',
      group: 'e2e',
      command: 'node',
      args: ['-e', 'process.exit(2)'],
      allowNotApplicable: true,
      cwd: repoRoot,
    });
    assert.strictEqual(result.status, 'not_applicable');
  });

  it('records duration', async () => {
    const result = await runStep({
      id: 'test-duration',
      group: 'unit',
      command: process.platform === 'win32' ? 'cmd.exe' : 'true',
      args: process.platform === 'win32' ? ['/c', 'exit', '0'] : [],
      cwd: repoRoot,
    });
    assert.ok(result.durationMs >= 0);
    assert.ok(result.startedAt);
    assert.ok(result.completedAt);
  });

  it('produces bounded sanitized summaries', async () => {
    const result = await runStep({
      id: 'test-summary',
      group: 'unit',
      command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
      args: process.platform === 'win32' ? ['/c', 'echo', 'hello'] : ['-c', 'echo hello'],
      cwd: repoRoot,
    });
    assert.ok(result.summary.length <= 1010);
  });
});

import { spawn, spawnSync } from 'child_process';

export function terminateProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {}
  }
}

export async function runStep({
  id,
  group,
  command,
  args,
  timeout = 30000,
  allowNotApplicable = false,
  cwd,
  env,
}) {
  const start = Date.now();
  const result = {
    id,
    group,
    status: 'failed',
    startedAt: new Date(start).toISOString(),
    durationMs: 0,
    summary: '',
    artifactPaths: [],
  };
  let child;
  let timer;

  try {
    child = spawn(command, args || [], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      detached: process.platform !== 'win32',
      windowsHide: true,
      env: env || process.env,
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (data) => stdout.push(data));
    child.stderr.on('data', (data) => stderr.push(data));

    let timedOut = false;
    timer = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
    }, timeout);

    const code = await new Promise((resolve, reject) => {
      child.once('close', resolve);
      child.once('error', reject);
    });
    clearTimeout(timer);

    result.durationMs = Date.now() - start;
    result.completedAt = new Date().toISOString();
    const output = Buffer.concat([...stdout, ...stderr]).toString('utf-8').trim();

    if (timedOut) {
      result.status = 'failed';
      result.summary = `Command timed out after ${timeout}ms and its process tree was terminated`;
    } else if (code === 0) {
      result.status = 'passed';
      result.summary = sanitizeSummary(output);
    } else if (code === 2 && allowNotApplicable) {
      result.status = 'not_applicable';
      result.summary = sanitizeSummary(output);
    } else {
      result.status = 'failed';
      result.summary = sanitizeSummary(output) || `Command exited with code ${code}`;
    }
  } catch (error) {
    if (timer) clearTimeout(timer);
    terminateProcessTree(child);
    result.durationMs = Date.now() - start;
    result.completedAt = new Date().toISOString();
    result.status = 'failed';
    result.summary = error.code === 'ENOENT'
      ? `Command not found: ${command}`
      : sanitizeSummary(error.message || String(error));
  }

  return result;
}

function sanitizeSummary(text) {
  if (!text) return '';
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 10);
  const summary = lines.join('\n');
  return summary.length > 1000 ? `${summary.slice(0, 1000)}...` : summary;
}

export default runStep;

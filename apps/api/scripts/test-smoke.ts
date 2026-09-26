import { execFileSync, spawn, spawnSync, type ChildProcess } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const apiRoot = resolve(__dirname, '..');
const repositoryRoot = resolve(apiRoot, '../..');
const npmCli = process.env.npm_execpath
  || resolve(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js');
const npxCli = resolve(npmCli, '..', 'npx-cli.js');
const { checkEnvironment } = require('../../../scripts/verification/lib/environment-safety.cjs') as {
  checkEnvironment: (environment: Record<string, string | undefined>) => { safe: boolean; issues: Array<{ code: string; message: string }> };
};

function stop(child: ChildProcess): Promise<void> {
  return new Promise((resolvePromise) => {
    if (!child.pid || child.exitCode !== null) return resolvePromise();
    const timer = setTimeout(() => {
      if (process.platform === 'win32') {
        spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      } else {
        child.kill('SIGKILL');
      }
    }, 3000);
    child.once('close', () => {
      clearTimeout(timer);
      resolvePromise();
    });
    child.kill('SIGTERM');
  });
}

async function waitForHealth(url: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`Smoke API did not become healthy at ${url}`);
}

function writeEvidence(status: 'passed' | 'failed', detail: string) {
  const outputDirectory = resolve(repositoryRoot, process.env.VERIFICATION_RUN_DIR || 'verification-output');
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(resolve(outputDirectory, 'smoke-evidence.json'), JSON.stringify({
    runId: process.env.VERIFICATION_RUN_ID || 'standalone',
    generatedAt: new Date().toISOString(),
    status,
    detail: detail.slice(0, 8_000),
  }, null, 2));
}

async function main() {
  const safety = checkEnvironment(process.env);
  if (!safety.safe) throw new Error(safety.issues.map((issue) => issue.message).join('; '));
  const port = Number(process.env.SMOKE_PORT || 4002);
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const env = {
    ...process.env,
    PORT: String(port),
    API_PORT: String(port),
    SMOKE_BASE_URL: baseUrl,
    SMOKE_DRIVER_PHONE: process.env.SMOKE_DRIVER_PHONE || '+201000000001',
    SMOKE_DRIVER_PASSWORD: process.env.SMOKE_DRIVER_PASSWORD,
  };

  let server: ChildProcess | null = null;
  let smokeOutput = '';
  try {
    execFileSync(process.execPath, [npmCli, 'run', 'build'], { cwd: apiRoot, env, stdio: 'pipe', windowsHide: true });
    server = spawn('node', ['dist/src/main.js'], { cwd: apiRoot, env, stdio: 'ignore', windowsHide: true });
    await waitForHealth(`${baseUrl}/health`);
    smokeOutput = execFileSync(process.execPath, [npxCli, 'ts-node', 'scripts/smoke.ts'], {
      cwd: apiRoot,
      env,
      stdio: 'pipe',
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 120_000,
    });
    await stop(server);
    server = null;
    writeEvidence('passed', `Managed API startup, smoke checks, and shutdown completed\n${smokeOutput}`);
  } catch (error) {
    const processError = error as Error & { stdout?: string | Buffer; stderr?: string | Buffer };
    const stdout = processError.stdout?.toString() || smokeOutput;
    const stderr = processError.stderr?.toString() || '';
    writeEvidence(
      'failed',
      [processError.message || String(error), stdout, stderr].filter(Boolean).join('\n'),
    );
    throw error;
  } finally {
    if (server) await stop(server);
  }
}

main().catch((error) => {
  console.error(`Managed smoke verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

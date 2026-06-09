import { execFileSync, spawn, spawnSync, type ChildProcess } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

const apiRoot = resolve(__dirname, '..');
const repositoryRoot = resolve(apiRoot, '../..');
const npmCli = process.env.npm_execpath
  || resolve(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js');
const npxCli = resolve(npmCli, '..', 'npx-cli.js');
const { checkEnvironment } = require('../../../scripts/verification/lib/environment-safety.cjs') as {
  checkEnvironment: (environment: Record<string, string | undefined>) => {
    safe: boolean;
    issues: Array<{ code: string; message: string }>;
    dbName?: string;
  };
};

interface EvidenceCheck {
  id: string;
  status: 'passed' | 'failed';
  detail: string;
}

const checks: EvidenceCheck[] = [];

function record(id: string, detail: string) {
  checks.push({ id, status: 'passed', detail });
  console.log(`[passed] ${id}: ${detail}`);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv, timeout = 120_000) {
  execFileSync(command, args, {
    cwd: apiRoot,
    env,
    stdio: 'pipe',
    timeout,
    windowsHide: true,
  });
}

function stopProcessTree(child: ChildProcess): Promise<void> {
  return new Promise((resolvePromise) => {
    if (!child.pid || child.exitCode !== null) {
      resolvePromise();
      return;
    }
    const timer = setTimeout(() => {
      if (process.platform === 'win32') {
        spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
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

function startApi(env: NodeJS.ProcessEnv, port: number) {
  return spawn('node', ['dist/src/main.js'], {
    cwd: apiRoot,
    env: { ...env, PORT: String(port), API_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

async function fetchUntil(url: string, predicate: (response: Response) => boolean, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus: number | null = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      lastStatus = response.status;
      if (predicate(response)) return response;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`Timed out waiting for ${url}; last status ${lastStatus ?? 'unreachable'}`);
}

function writeEvidence(overallStatus: 'passed' | 'failed', error?: unknown) {
  const outputDirectory = resolve(
    repositoryRoot,
    process.env.VERIFICATION_RUN_DIR || 'verification-output',
  );
  mkdirSync(outputDirectory, { recursive: true });
  const artifact = {
    runId: process.env.VERIFICATION_RUN_ID || 'standalone',
    generatedAt: new Date().toISOString(),
    overallStatus,
    checks,
    error: error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED_DATABASE_URL]') : null,
  };
  writeFileSync(resolve(outputDirectory, 'integration-evidence.json'), JSON.stringify(artifact, null, 2), 'utf-8');
}

async function seedCounts(databaseUrl: string) {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const [
      users,
      admins,
      trips,
      goals,
      communityPosts,
      reviews,
      roles,
      permissions,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.adminUser.count(),
      prisma.trip.count(),
      prisma.goal.count(),
      prisma.communityPost.count(),
      prisma.platformReview.count(),
      prisma.adminRole.count(),
      prisma.adminPermission.count(),
    ]);
    return { users, admins, trips, goals, communityPosts, reviews, roles, permissions };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || '';
  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'test',
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
  };
  const safety = checkEnvironment(env);
  if (!safety.safe) {
    throw new Error(safety.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; '));
  }
  record('environment-safety', `Disposable database '${safety.dbName}' accepted`);

  let healthyServer: ChildProcess | null = null;
  let degradedServer: ChildProcess | null = null;

  try {
    run(process.execPath, [npxCli, 'prisma', 'generate'], env);
    record('prisma-generate', 'Prisma client generated from current schema');

    run(process.execPath, [npxCli, 'prisma', 'migrate', 'reset', '--force'], env);
    run(process.execPath, [npxCli, 'prisma', 'migrate', 'deploy'], env);
    record('clean-migration', 'Disposable database reset and all migrations deployed');

    run(process.execPath, [npxCli, 'ts-node', 'prisma/seed.ts'], env);
    run(process.execPath, [npxCli, 'ts-node', 'prisma/seed-admin.ts'], env);
    const firstSeedCounts = await seedCounts(databaseUrl);
    run(process.execPath, [npxCli, 'ts-node', 'prisma/seed.ts'], env);
    run(process.execPath, [npxCli, 'ts-node', 'prisma/seed-admin.ts'], env);
    const secondSeedCounts = await seedCounts(databaseUrl);
    if (JSON.stringify(firstSeedCounts) !== JSON.stringify(secondSeedCounts)) {
      throw new Error(`Seed state changed on second run: ${JSON.stringify({ firstSeedCounts, secondSeedCounts })}`);
    }
    record('seed-idempotence', `Second seed preserved table counts: ${JSON.stringify(secondSeedCounts)}`);

    run(process.execPath, [npmCli, 'run', 'build'], env);
    record('api-build', 'Current API production build completed');

    const basePort = Number(process.env.API_PORT || 4001);
    const invalidUrl = new URL(databaseUrl);
    invalidUrl.port = '1';
    invalidUrl.pathname = '/ehsbha_test_unreachable';
    const degradedEnv = {
      ...env,
      DATABASE_URL: invalidUrl.toString(),
      DIRECT_URL: invalidUrl.toString(),
    };
    degradedServer = startApi(degradedEnv, basePort + 1);
    await fetchUntil(`http://127.0.0.1:${basePort + 1}/api/v1/health`, (response) => response.ok);
    const degradedReady = await fetchUntil(
      `http://127.0.0.1:${basePort + 1}/api/v1/ready`,
      (response) => !response.ok,
    );
    record('readiness-failure-path', `Unreachable test database produced HTTP ${degradedReady.status}`);
    await stopProcessTree(degradedServer);
    degradedServer = null;
    record('degraded-shutdown', 'Degraded API process exited');

    healthyServer = startApi(env, basePort);
    const healthResponse = await fetchUntil(
      `http://127.0.0.1:${basePort}/api/v1/health`,
      (response) => response.ok,
    );
    record('startup-liveness', `Health endpoint returned HTTP ${healthResponse.status}`);

    const readinessResponse = await fetchUntil(
      `http://127.0.0.1:${basePort}/api/v1/ready`,
      (response) => response.ok,
    );
    const readinessBody = await readinessResponse.json() as {
      status?: string;
      data?: { status?: string };
    };
    if ((readinessBody.data?.status ?? readinessBody.status) !== 'ready') {
      throw new Error(`Readiness payload did not report ready`);
    }
    record('database-readiness', 'Readiness endpoint confirmed database connectivity');

    await stopProcessTree(healthyServer);
    healthyServer = null;
    record('healthy-shutdown', 'Healthy API process exited');
    writeEvidence('passed');
  } catch (error) {
    checks.push({
      id: 'integration-run',
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
    });
    writeEvidence('failed', error);
    throw error;
  } finally {
    if (degradedServer) await stopProcessTree(degradedServer);
    if (healthyServer) await stopProcessTree(healthyServer);
  }
}

main().catch((error) => {
  console.error(`Integration verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

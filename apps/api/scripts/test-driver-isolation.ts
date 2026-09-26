import { PrismaClient } from '@prisma/client';
import { verifyDriverIsolation } from './verify-driver-isolation';
import { verifyAuthSecurity } from './verify-auth-security';
import { verifyOcrImports } from './verify-ocr-imports';

interface EnvironmentSafety {
  safe: boolean;
  issues: Array<{ code: string; message: string }>;
}

const { checkEnvironment } = require('../../../scripts/verification/lib/environment-safety.cjs') as {
  checkEnvironment: (environment: NodeJS.ProcessEnv) => EnvironmentSafety;
};

async function main(): Promise<void> {
  const safety = checkEnvironment(process.env);
  if (!safety.safe) throw new Error(safety.issues.map((issue) => issue.code).join(', '));
  const database = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? '' } } });
  try {
    await verifyDriverIsolation(database);
    await verifyAuthSecurity(database);
    await verifyOcrImports(database);
    process.stdout.write('OCR confirmation: atomic trips/aggregates/history, concurrent replay, rollback, partial failures, edits, deletion and cross-batch acknowledgement passed.\n');
    process.stdout.write('OCR imports: persisted uploads, owner isolation, duplicate evidence, worker fencing, bounded retries, cancellation and retention passed.\n');
    process.stdout.write('Authentication security: account status, session revocation, rotation and reset concurrency passed.\n');
    process.stdout.write('Driver isolation: ownership, scoped replay, conflicts, batch, sync, constraints, and aggregates passed.\n');
  } finally {
    await database.$disconnect();
  }
}

main().catch((error: Error) => {
  process.stderr.write(`Driver isolation verification failed: ${error.stack ?? error.name}\n`);
  process.exitCode = 1;
});

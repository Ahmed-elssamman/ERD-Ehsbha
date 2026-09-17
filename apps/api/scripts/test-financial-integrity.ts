import { PrismaClient } from '@prisma/client';
import { verifyAggregateIntegrity } from './verify-aggregate-integrity';

interface EnvironmentSafety { checkEnvironment(environment: NodeJS.ProcessEnv): { safe: boolean }; }
const { checkEnvironment } = require('../../../scripts/verification/lib/environment-safety.cjs') as EnvironmentSafety;

async function main(): Promise<void> {
  if (!checkEnvironment(process.env).safe) throw new Error('A disposable ehsbha_test_ database is required');
  const database = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? '' } } });
  try { await verifyAggregateIntegrity(database); process.stdout.write('Financial integrity: repeated rebuilds and period reconciliation passed.\n'); }
  finally { await database.$disconnect(); }
}
void main().catch((error: Error) => { process.stderr.write(`${error.stack ?? error.name}\n`); process.exitCode = 1; });

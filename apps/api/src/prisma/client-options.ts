import type { Prisma } from '@prisma/client';
import { resolvePrismaRuntimeUrl } from './database-url';
import { createNeonPrismaAdapter } from './neon-adapter';

/** Neon needs its WebSocket adapter; ordinary PostgreSQL uses the native client. */
export function createPrismaClientOptions(
  connectionString = resolvePrismaRuntimeUrl(),
): Prisma.PrismaClientOptions {
  const hostname = new URL(connectionString).hostname;
  if (hostname.endsWith('.neon.tech')) {
    return { adapter: createNeonPrismaAdapter(connectionString) };
  }
  return { datasources: { db: { url: connectionString } } };
}

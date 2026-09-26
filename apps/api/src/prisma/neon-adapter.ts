import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import { resolvePrismaRuntimeUrl } from './database-url';

neonConfig.webSocketConstructor = ws;

export function createNeonPrismaAdapter(connectionString = resolvePrismaRuntimeUrl()) {
  return new PrismaNeon({ connectionString });
}

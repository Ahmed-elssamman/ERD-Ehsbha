import type { IdempotencyRecord } from '@prisma/client';

export interface IdempotencyScope {
  realm: 'driver' | 'admin' | 'system';
  actorId: string;
  operationId: string;
  key: string;
}

export interface ReplayResponse {
  status: number;
  body: unknown;
}

export type ClaimResult =
  | { kind: 'claimed'; record: IdempotencyRecord }
  | { kind: 'existing'; record: IdempotencyRecord };

export type BeginResult =
  | { kind: 'execute'; recordId: string; requestHash: string }
  | { kind: 'replay'; response: ReplayResponse };

import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SyncMutationKind, WorkSessionMutation, NotificationMutation, ReportMutation } from '@ehsbha/shared-types';
import { canonicalJson } from '../../modules/idempotency/idempotency.service';

export function mutationFingerprint(kind: SyncMutationKind | WorkSessionMutation | NotificationMutation | ReportMutation, payload: object): string {
  return createHash('sha256').update(canonicalJson({ kind, payload })).digest('hex');
}

/** Caller holds the driver write lock and commits this receipt with domain writes. */
export async function findMutationReceipt(tx: Prisma.TransactionClient, driverId: string, clientMutationId: string, requestHash: string) {
  const receipt = await tx.driverMutationReceipt.findUnique({ where: { driverId_clientMutationId: { driverId, clientMutationId } } });
  if (receipt && receipt.requestHash !== requestHash) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
  return receipt;
}

export function saveMutationReceipt(tx: Prisma.TransactionClient, driverId: string, clientMutationId: string, requestHash: string, recordId: string) {
  return tx.driverMutationReceipt.create({ data: { driverId, clientMutationId, requestHash, recordId } });
}

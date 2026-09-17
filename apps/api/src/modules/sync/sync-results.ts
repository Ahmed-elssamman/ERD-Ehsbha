import { Prisma, type DriverMutationReceipt } from '@prisma/client';
import { SyncMutationKind, SyncMutationStatus } from '@ehsbha/shared-types';
import { syncTripSchema, syncExpenseSchema, syncSessionSchema, type SyncAppliedResult } from '@ehsbha/api-contracts';
import { fuelResponse } from '../fuel/fuel-response.mapper';
import { tripSnapshot } from '../trips/trip-history';

function timestamps(row: { createdAt: Date; updatedAt: Date }) {
  return { createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

/** A receipt acknowledges the original write; data is the current owner-scoped record. */
export async function syncAppliedResult(tx: Prisma.TransactionClient, kind: SyncMutationKind, receipt: DriverMutationReceipt, replayed: boolean): Promise<SyncAppliedResult> {
  const result = { clientMutationId: receipt.clientMutationId, status: SyncMutationStatus.Applied,
    recordId: receipt.recordId, appliedAt: receipt.createdAt.toISOString(), replayed } as const;
  const where = { driverId: receipt.driverId, id: receipt.recordId };
  switch (kind) {
    case SyncMutationKind.TripCreate: {
      const row = await tx.trip.findFirst({ where });
      return { ...result, kind, data: row ? syncTripSchema.strip().parse({ ...row, ...tripSnapshot(row), ...timestamps(row) }) : null };
    }
    case SyncMutationKind.FuelCreate: {
      const row = await tx.fuelLog.findFirst({ where });
      return { ...result, kind, data: row ? fuelResponse(row) : null };
    }
    case SyncMutationKind.ExpenseCreate: {
      const row = await tx.expense.findFirst({ where });
      return { ...result, kind, data: row ? syncExpenseSchema.strip().parse({ ...row, ...timestamps(row), dateTime: row.dateTime.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null }) : null };
    }
    case SyncMutationKind.SessionStart:
    case SyncMutationKind.SessionEnd: {
      const row = await tx.session.findFirst({ where });
      return { ...result, kind, data: row ? syncSessionSchema.strip().parse({ ...row, ...timestamps(row), startedAt: row.startedAt.toISOString(), endedAt: row.endedAt?.toISOString() ?? null, deletedAt: row.deletedAt?.toISOString() ?? null }) : null };
    }
  }
}

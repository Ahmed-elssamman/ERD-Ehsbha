import { Prisma, type Expense } from '@prisma/client';
import { ExpenseChange } from '@ehsbha/shared-types';
import { expenseSnapshotSchema } from '@ehsbha/api-contracts';

function snapshot(row: Expense) {
  return expenseSnapshotSchema.parse({ vehicleId: row.vehicleId, category: row.category, amountPiastres: row.amountPiastres,
    dateTime: row.dateTime.toISOString(), linkedTripId: row.linkedTripId, isRecurring: row.isRecurring,
    recurrenceRule: row.recurrenceRule, deletedAt: row.deletedAt?.toISOString() ?? null, version: row.version });
}

/** Append only. Free-text notes are excluded from retained financial snapshots. */
export async function recordExpenseChange(tx: Prisma.TransactionClient, after: Expense, action: ExpenseChange, before: Expense | null = null): Promise<void> {
  await tx.expenseRevision.create({ data: { driverId: after.driverId, expenseId: after.id, action,
    before: before ? snapshot(before) : Prisma.DbNull, after: snapshot(after) } });
}

import { Prisma, type Session } from '@prisma/client';
import { WorkSessionChange } from '@ehsbha/shared-types';
import { workSessionSnapshotSchema } from '@ehsbha/api-contracts';

export function sessionSnapshot(row: Session) {
  return workSessionSnapshotSchema.parse({ driverAppId: row.driverAppId, startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null, activeMinutes: row.activeMinutes, version: row.version,
    deletedAt: row.deletedAt?.toISOString() ?? null });
}
export async function recordSessionChange(tx: Prisma.TransactionClient, after: Session, action: WorkSessionChange, before: Session | null = null): Promise<void> {
  await tx.sessionRevision.create({ data: { driverId: after.driverId, sessionId: after.id, action,
    before: before ? sessionSnapshot(before) : Prisma.DbNull, after: sessionSnapshot(after) } });
}

import { BadRequestException } from '@nestjs/common';
import { Prisma, type MaintenanceRecord } from '@prisma/client';
import { z } from 'zod';
import { MaintenanceChange } from '@ehsbha/shared-types';
import { maintenanceSnapshotSchema } from '@ehsbha/api-contracts';

const cursorSchema = z.object({ scope: z.string().length(64), version: z.number().int().positive() }).strict();
export function maintenanceHistoryPosition(cursor: string, scope: string): number | null {
  if (!cursor) return null;
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    if (parsed.scope !== scope) throw new Error('Cursor scope differs');
    return parsed.version;
  } catch { throw new BadRequestException({ code: 'INVALID_CURSOR' }); }
}
export function nextMaintenanceHistoryCursor(version: number, scope: string): string {
  return Buffer.from(JSON.stringify({ scope, version })).toString('base64url');
}
function snapshot(row: MaintenanceRecord) {
  return maintenanceSnapshotSchema.parse({ vehicleId: row.vehicleId, maintenanceItemId: row.maintenanceItemId,
    performedAt: row.performedAt.toISOString(), odometerMeters: Number(row.odometerMeters), costPiastres: row.costPiastres,
    linkedExpenseId: row.linkedExpenseId, deletedAt: row.deletedAt?.toISOString() ?? null, version: row.version });
}
/** Version order follows writes under the driver lock, independently of transaction start time. */
export async function recordMaintenanceChange(tx: Prisma.TransactionClient, after: MaintenanceRecord, action: MaintenanceChange, before: MaintenanceRecord | null = null): Promise<void> {
  await tx.maintenanceRevision.create({ data: { driverId: after.driverId, recordId: after.id, version: after.version, action,
    before: before ? snapshot(before) : Prisma.DbNull, after: snapshot(after) } });
}

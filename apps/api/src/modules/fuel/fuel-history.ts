import { Prisma, type FuelLog } from '@prisma/client';
import { FuelChange } from '@ehsbha/shared-types';
import { fuelSnapshotSchema } from '@ehsbha/api-contracts';

export function fuelSnapshot(row: FuelLog) {
  return fuelSnapshotSchema.parse({ vehicleId: row.vehicleId, dateTime: row.dateTime.toISOString(), fuelKind: row.fuelKind,
    quantity: row.quantity?.toNumber() ?? null, pricePerUnitPiastres: row.pricePerUnitPiastres, totalPiastres: row.totalPiastres,
    odometerMeters: row.odometerMeters === null ? null : Number(row.odometerMeters), isFullTank: row.isFullTank,
    fillCoverage: row.fillCoverage, linkedExpenseId: row.linkedExpenseId, deletedAt: row.deletedAt?.toISOString() ?? null, version: row.version });
}
export async function recordFuelChange(tx: Prisma.TransactionClient, after: FuelLog, action: FuelChange, before: FuelLog | null = null): Promise<void> {
  await tx.fuelRevision.create({ data: { driverId: after.driverId, recordId: after.id, version: after.version, action,
    before: before ? fuelSnapshot(before) : Prisma.DbNull, after: fuelSnapshot(after), createdAt: new Date() } });
}

import { Prisma, type Trip } from '@prisma/client';
import { TripChange, TripChangeActor } from '@ehsbha/shared-types';
import { tripSnapshotSchema } from '@ehsbha/api-contracts';

export function tripSnapshot(row: Trip) {
  return tripSnapshotSchema.parse({ vehicleId: row.vehicleId, driverAppId: row.driverAppId, areaId: row.areaId,
    startedAt: row.startedAt.toISOString(), endedAt: row.endedAt.toISOString(), grossPiastres: row.grossPiastres,
    earningsPiastres: row.earningsPiastres === null ? null : Number(row.earningsPiastres), receivedPiastres: row.receivedPiastres,
    commissionPiastres: row.commissionPiastres, tipPiastres: row.tipPiastres, tollPiastres: row.tollPiastres, parkingPiastres: row.parkingPiastres,
    totalKmMeters: row.totalKmMeters, paidKmMeters: row.paidKmMeters, emptyKmMeters: row.emptyKmMeters,
    waitingFeePiastres: row.waitingFeePiastres, paymentMethod: row.paymentMethod, deletedAt: row.deletedAt?.toISOString() ?? null,
    version: row.version, source: row.source });
}
export async function recordTripChange(tx: Prisma.TransactionClient, after: Trip, action: TripChange, before: Trip | null = null, actor = TripChangeActor.Driver): Promise<void> {
  await tx.tripRevision.create({ data: { driverId: after.driverId, recordId: after.id, version: after.version, action, actor,
    before: before ? tripSnapshot(before) : Prisma.DbNull, after: tripSnapshot(after), createdAt: new Date() } });
}

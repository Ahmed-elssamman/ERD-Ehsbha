import { Prisma, VehicleOdometerSource } from '@prisma/client';

/** Reconcile dated active readings under the driver's lock, never a permanent numeric MAX. */
export async function reconcileVehicleOdometer(tx: Prisma.TransactionClient, driverId: string, vehicleId: string, now = new Date()): Promise<void> {
  const vehicle = await tx.vehicle.findFirstOrThrow({ where: { driverId, id: vehicleId } });
  const latest = await tx.fuelLog.findFirst({
    where: { driverId, vehicleId, deletedAt: null, odometerMeters: { not: null }, dateTime: { lte: now } },
    orderBy: [{ dateTime: 'desc' }, { id: 'desc' }], select: { id: true, dateTime: true, odometerMeters: true },
  });
  let value = vehicle.odometerBaselineMeters ?? 0n;
  let source = vehicle.odometerBaselineSource;
  let sourceId: string | null = null;
  let asOf = vehicle.odometerBaselineAt;
  if (latest && (!asOf || latest.dateTime >= asOf) && latest.odometerMeters !== null) {
    const disagreement = await tx.fuelLog.findFirst({ where: { driverId, vehicleId, deletedAt: null,
      dateTime: latest.dateTime, odometerMeters: { not: latest.odometerMeters } }, select: { id: true } });
    const baselineDisagrees = asOf?.getTime() === latest.dateTime.getTime() && vehicle.odometerBaselineMeters !== latest.odometerMeters;
    value = latest.odometerMeters;
    source = disagreement || baselineDisagrees ? VehicleOdometerSource.AMBIGUOUS : VehicleOdometerSource.FUEL;
    sourceId = source === VehicleOdometerSource.FUEL ? latest.id : null;
    asOf = latest.dateTime;
  }
  if (value !== vehicle.odometerMeters || source !== vehicle.odometerSource || sourceId !== vehicle.odometerSourceId
    || asOf?.getTime() !== vehicle.odometerAsOf?.getTime()) {
    await tx.vehicle.update({ where: { id: vehicleId }, data: { odometerMeters: value, odometerSource: source,
      odometerSourceId: sourceId, odometerAsOf: asOf, odometerVersion: { increment: 1 } } });
  }
}

import { VehicleOdometerSource, type Vehicle } from '@prisma/client';
import { driverVehicleSchema } from '@ehsbha/api-contracts';

/** Prisma Decimal serializes to a string; the public vehicle contract uses numbers. */
export function vehicleResponse(vehicle: Vehicle) {
  return driverVehicleSchema.parse({
    ...vehicle,
    baselineKmPerLiter: vehicle.baselineKmPerLiter.toNumber(),
    odometerMeters: vehicle.odometerSource === VehicleOdometerSource.UNKNOWN || vehicle.odometerSource === VehicleOdometerSource.AMBIGUOUS ? null : Number(vehicle.odometerMeters),
    odometerAsOf: vehicle.odometerAsOf?.toISOString() ?? null,
  });
}

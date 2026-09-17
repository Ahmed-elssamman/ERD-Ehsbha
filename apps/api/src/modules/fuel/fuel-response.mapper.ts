import type { FuelLog } from '@prisma/client';
import { fuelQuantityUnit } from '@ehsbha/shared-types';
import { driverFuelEntrySchema } from '@ehsbha/api-contracts';
import { fuelSnapshot } from './fuel-history';

export function fuelResponse(row: FuelLog) {
  const snapshot = fuelSnapshot(row);
  return driverFuelEntrySchema.parse({ ...snapshot, id: row.id, quantityUnit: fuelQuantityUnit(snapshot.fuelKind),
    notes: row.notes, clientMutationId: row.clientMutationId, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
}

import { toDatetimeLocalValue } from '@/lib/time';
import type { FuelEntry, Vehicle } from '@/lib/api/endpoints';
import type { FuelFormInput } from './fuel.control';
import { z } from 'zod';
import { CreateFuelSchema, driverFuelEntrySchema, driverVehicleSchema } from '@ehsbha/api-contracts';
import { FuelFillCoverage, LocalTimeOccurrence } from '@ehsbha/shared-types';
import { parseDraftJson, type RecordDraft } from '@/lib/record-drafts/record-draft.model';

export const fuelDraftContextSchema = z.object({ record: driverFuelEntrySchema.nullable(), vehicle: driverVehicleSchema }).strict();
export const fuelDraftFieldsSchema = z.object({
  dateTime: z.string().max(100), dateOccurrence: z.nativeEnum(LocalTimeOccurrence), recordedDateTime: z.string().nullable(),
  fuelKind: z.string().max(100), totalEgp: z.string().max(100), quantity: z.string().max(100),
  unitPriceEgp: z.string().max(100), odometerKm: z.string().max(100), isFullTank: z.boolean(),
  fillCoverage: z.nativeEnum(FuelFillCoverage), notes: z.string().max(500),
}).strict();
export const fuelDraftBodySchema = CreateFuelSchema.extend({ dateTime: z.string().datetime({ offset: true }) });
export function validateFuelDraft(draft: RecordDraft) {
  parseDraftJson(draft.context, fuelDraftContextSchema);
  if (draft.fields !== null) parseDraftJson(draft.fields, fuelDraftFieldsSchema);
  if (draft.pending) parseDraftJson(draft.pending.body, fuelDraftBodySchema);
}

export function fuelDraftDefaults(record: FuelEntry | null, vehicle: Vehicle): FuelFormInput {
  return {
      dateTime: toDatetimeLocalValue(record ? new Date(record.dateTime) : new Date()), dateOccurrence: LocalTimeOccurrence.Unspecified,
      recordedDateTime: record?.dateTime ?? null, fuelKind: record ? record.fuelKind ?? '' : vehicle.fuelType,
      totalEgp: record ? String(record.totalPiastres / 100) : '', quantity: record?.quantity == null ? '' : String(record.quantity),
      unitPriceEgp: record?.pricePerUnitPiastres == null ? '' : String(record.pricePerUnitPiastres / 100),
      odometerKm: record?.odometerMeters == null ? '' : String(record.odometerMeters / 1000),
      isFullTank: record?.isFullTank ?? false, fillCoverage: record?.fillCoverage ?? FuelFillCoverage.Unconfirmed, notes: record?.notes ?? '',
    };
}

import { toDatetimeLocalValue } from '@/lib/time';
import type { MaintenanceRecord, Vehicle } from '@/lib/api/endpoints';
import type { MaintenanceFormInput } from './maintenance.control';
import { z } from 'zod';
import { CreateMaintenanceRecordSchema, maintenanceRecordSchema, driverVehicleSchema } from '@ehsbha/api-contracts';
import { LocalTimeOccurrence } from '@ehsbha/shared-types';
import { parseDraftJson, type RecordDraft } from '@/lib/record-drafts/record-draft.model';

export const maintenanceDraftContextSchema = z.object({ record: maintenanceRecordSchema.nullable(), vehicle: driverVehicleSchema }).strict();
export const maintenanceDraftFieldsSchema = z.object({
  maintenanceItemId: z.string().max(200), performedAt: z.string().max(100), dateOccurrence: z.nativeEnum(LocalTimeOccurrence),
  recordedDateTime: z.string().nullable(), odometerKm: z.union([z.string().max(100), z.number()]),
  costEgp: z.union([z.string().max(100), z.number()]), notes: z.string().max(500),
}).strict();
export const maintenanceDraftBodySchema = CreateMaintenanceRecordSchema.extend({ performedAt: z.string().datetime({ offset: true }) });
export function validateMaintenanceDraft(draft: RecordDraft) {
  parseDraftJson(draft.context, maintenanceDraftContextSchema);
  if (draft.fields !== null) parseDraftJson(draft.fields, maintenanceDraftFieldsSchema);
  if (draft.pending) parseDraftJson(draft.pending.body, maintenanceDraftBodySchema);
}

export function maintenanceDraftDefaults(record: MaintenanceRecord | null, vehicle: Vehicle): MaintenanceFormInput {
  return {
      maintenanceItemId: record?.maintenanceItemId ?? '', performedAt: toDatetimeLocalValue(record ? new Date(record.performedAt) : new Date()),
      dateOccurrence: LocalTimeOccurrence.Unspecified, recordedDateTime: record?.performedAt ?? null,
      odometerKm: record ? record.odometerMeters / 1000 : vehicle.odometerMeters !== null && (vehicle.odometerSource === 'MANUAL' || vehicle.odometerSource === 'FUEL') ? vehicle.odometerMeters / 1000 : '', costEgp: record ? record.costPiastres / 100 : '', notes: record?.notes ?? '',
    };
}

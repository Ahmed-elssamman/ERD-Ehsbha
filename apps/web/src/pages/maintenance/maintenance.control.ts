import { z } from 'zod';
import { isAxiosError } from 'axios';
import { MaintenanceView, LocalTimeOccurrence, resolveLocalDateTime } from '@ehsbha/shared-types';
import { readApiError } from '@/lib/api/client';

export const MAINTENANCE_VIEWS = Object.values(MaintenanceView);
export const MAINTENANCE_INVALIDATIONS = ['maintenance', 'fuel', 'expenses', 'analytics', 'decisions', 'score', 'goals'];
export const MAINTENANCE_DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
export const MAINTENANCE_STATUS_STYLES: Record<string, string> = {
  GREEN: 'bg-success/15 text-success', AMBER: 'bg-warning/15 text-warning', RED: 'bg-destructive/15 text-destructive',
  OVERDUE: 'bg-destructive text-destructive-foreground', UNKNOWN: 'bg-muted text-muted-foreground',
};
export enum MaintenanceDialogMode { Create, Edit }
export const maintenanceFormSchema = z.object({
  maintenanceItemId: z.string().min(1), performedAt: z.string().min(1), dateOccurrence: z.nativeEnum(LocalTimeOccurrence),
  recordedDateTime: z.string().nullable(),
  odometerKm: z.union([z.number(), z.string().trim().min(1)]).pipe(z.coerce.number().min(0).max(Number.MAX_SAFE_INTEGER / 1000)
    .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001, 'distance-precision')),
  costEgp: z.union([z.number(), z.string().trim().min(1)]).pipe(z.coerce.number().min(0).max(21_474_836.47)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'amount-precision')),
  notes: z.string().max(500),
}).superRefine((value, context) => {
  if (!resolveLocalDateTime(value.performedAt, value.dateOccurrence, value.recordedDateTime)) context.addIssue({ code: 'custom', path: ['performedAt'], message: 'time-invalid' });
});
export type MaintenanceFormInput = z.input<typeof maintenanceFormSchema>;
export function maintenanceErrorKey(error: Error): string {
  const code = readApiError(error).code;
  if (code === 'MAINTENANCE_VERSION_CONFLICT' || code === 'MAINTENANCE_LINK_CONFLICT') return `errors.${code}`;
  if (code === 'IDEMPOTENCY_KEY_REUSED') return 'maintenance.retryChanged';
  if (code === 'NOT_FOUND') return 'maintenance.referenceChanged';
  if (code === 'VALIDATION_ERROR') return 'maintenance.invalidRecord';
  return 'maintenance.saveFailed';
}
export function maintenanceSaveUnconfirmed(error: Error): boolean {
  if (readApiError(error).code === 'IDEMPOTENCY_IN_PROGRESS') return true;
  return !isAxiosError(error) || !error.response || error.response.status >= 500;
}

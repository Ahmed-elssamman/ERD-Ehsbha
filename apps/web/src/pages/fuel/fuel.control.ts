import { z } from 'zod';
import { isAxiosError } from 'axios';
import { FuelFillCoverage, FuelKind, FuelView, LocalTimeOccurrence, resolveLocalDateTime } from '@ehsbha/shared-types';
import { readApiError } from '@/lib/api/client';

export const FUEL_KINDS = Object.values(FuelKind);
export const FUEL_VIEWS = Object.values(FuelView);
export const FUEL_COVERAGES = Object.values(FuelFillCoverage);
export const FUEL_INVALIDATIONS = ['fuel', 'vehicles', 'expenses', 'maintenance', 'analytics', 'decisions', 'score', 'goals'];
export const FUEL_DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
export enum FuelNumericField { Total = 'totalEgp', Quantity = 'quantity', Price = 'unitPriceEgp', Odometer = 'odometerKm' }
export const FUEL_NUMERIC_FIELDS = [
  { name: FuelNumericField.Total, label: 'fuel.field.total', step: '0.01', maximum: 21_474_836.47, required: true },
  { name: FuelNumericField.Quantity, label: 'fuel.field.quantity', step: '0.001', maximum: 9999.999, required: false },
  { name: FuelNumericField.Price, label: 'fuel.field.unitPrice', step: '0.01', maximum: 21_474_836.47, required: false },
  { name: FuelNumericField.Odometer, label: 'fuel.field.odometer', step: '0.001', maximum: Number.MAX_SAFE_INTEGER / 1000, required: false },
] satisfies Array<{ name: FuelNumericField; label: string; step: string; maximum: number; required: boolean }>;

function numeric(value: string, maximum: number, places: number, required = false, positive = false): boolean {
  if (value.trim() === '') return !required;
  const number = Number(value);
  return Number.isFinite(number) && (positive ? number > 0 : number >= 0) && number <= maximum
    && Math.abs(number * 10 ** places - Math.round(number * 10 ** places)) < 0.000001;
}
export const fuelFormSchema = z.object({
  dateTime: z.string().min(1), dateOccurrence: z.nativeEnum(LocalTimeOccurrence), recordedDateTime: z.string().nullable(),
  fuelKind: z.string().refine((value) => value === '' || FUEL_KINDS.some((kind) => kind === value)),
  totalEgp: z.string().refine((value) => numeric(value, 21_474_836.47, 2, true)),
  quantity: z.string().refine((value) => numeric(value, 9999.999, 3, false, true)),
  unitPriceEgp: z.string().refine((value) => numeric(value, 21_474_836.47, 2)),
  odometerKm: z.string().refine((value) => numeric(value, Number.MAX_SAFE_INTEGER / 1000, 3)),
  isFullTank: z.boolean(), fillCoverage: z.nativeEnum(FuelFillCoverage), notes: z.string().max(500),
}).superRefine((value, context) => {
  if (!resolveLocalDateTime(value.dateTime, value.dateOccurrence, value.recordedDateTime)) context.addIssue({ code: 'custom', path: ['dateTime'], message: 'time-invalid' });
});
export interface FuelFormInput {
  dateTime: string; dateOccurrence: LocalTimeOccurrence; recordedDateTime: string | null; fuelKind: string;
  totalEgp: string; quantity: string; unitPriceEgp: string; odometerKm: string; isFullTank: boolean; fillCoverage: FuelFillCoverage; notes: string;
}
export function optionalFuelNumber(value: string): number | null { return value.trim() === '' ? null : Number(value); }
export function selectedFuelKind(value: string): FuelKind | null {
  const parsed = z.nativeEnum(FuelKind).safeParse(value);
  return parsed.success ? parsed.data : null;
}
export function fuelErrorKey(error: Error): string {
  const code = readApiError(error).code;
  if (code === 'FUEL_VERSION_CONFLICT' || code === 'FUEL_LINK_CONFLICT') return `errors.${code}`;
  if (code === 'IDEMPOTENCY_KEY_REUSED') return 'fuel.retryChanged';
  if (code === 'NOT_FOUND' || code === 'FUEL_NOT_FOUND' || code === 'VEHICLE_NOT_FOUND') return 'fuel.referenceChanged';
  if (code === 'VALIDATION_ERROR') return 'fuel.invalidRecord';
  return 'fuel.saveFailed';
}
export function fuelSaveUnconfirmed(error: Error): boolean {
  if (readApiError(error).code === 'IDEMPOTENCY_IN_PROGRESS') return true;
  return !isAxiosError(error) || !error.response || error.response.status >= 500;
}

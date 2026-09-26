import { z } from 'zod';
import { isAxiosError } from 'axios';
import { CreateExpenseSchema } from '@ehsbha/api-contracts';
import { ExpenseCategory, ExpenseView, LocalTimeOccurrence, resolveLocalDateTime } from '@ehsbha/shared-types';
import { readApiError } from '@/lib/api/client';

export const EXPENSE_CATEGORIES = Object.values(ExpenseCategory);
export const EXPENSE_VIEWS = [ExpenseView.Active, ExpenseView.Deleted];
export const EXPENSE_INVALIDATIONS = ['expenses', 'fuel', 'maintenance', 'analytics', 'decisions', 'score', 'goals', 'trips'];
export const EXPENSE_DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };

export const expenseFormSchema = z.object({
  category: CreateExpenseSchema.shape.category,
  amountEgp: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(0.01).max(21_474_836.47)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'amount-precision')),
  dateTime: z.string().min(1),
  dateOccurrence: z.nativeEnum(LocalTimeOccurrence),
  recordedDateTime: z.string().nullable().default(null),
  vehicleId: z.string().optional(),
  isRecurring: z.boolean(),
  notes: z.string().max(500).optional(),
}).superRefine((value, context) => {
  if (!resolveLocalDateTime(value.dateTime, value.dateOccurrence, value.recordedDateTime)) {
    context.addIssue({ code: 'custom', path: ['dateTime'], message: 'time-invalid' });
  }
});

export type ExpenseFormInput = z.input<typeof expenseFormSchema>;

export { recordMonthRange as expenseMonthRange } from '@/lib/record-month-range';

export function expenseErrorKey(error: Error): string {
  const code = readApiError(error).code;
  if (code === 'EXPENSE_VERSION_CONFLICT') return 'errors.EXPENSE_VERSION_CONFLICT';
  if (code === 'MAINTENANCE_LINK_CONFLICT' || code === 'FUEL_LINK_CONFLICT') return `errors.${code}`;
  if (code === 'EXPENSE_LINK_CONFLICT') return 'errors.EXPENSE_LINK_CONFLICT';
  if (code === 'IDEMPOTENCY_KEY_REUSED') return 'expenses.retryChanged';
  if (code === 'EXPENSE_NOT_FOUND' || code === 'TRIP_NOT_FOUND' || code === 'VEHICLE_NOT_FOUND' || code === 'NOT_FOUND') return 'expenses.referenceChanged';
  return 'expenses.saveFailed';
}

export function expenseSaveUnconfirmed(error: Error): boolean {
  if (readApiError(error).code === 'IDEMPOTENCY_IN_PROGRESS') return true;
  if (!isAxiosError(error)) return true;
  return !error.response || error.response.status >= 500;
}

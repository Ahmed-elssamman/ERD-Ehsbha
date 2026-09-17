import { toDatetimeLocalValue } from '@/lib/time';
import type { Expense } from '@/lib/api/endpoints';
import type { ExpenseFormInput } from './expenses.control';
import { z } from 'zod';
import { CreateExpenseSchema, driverExpenseSchema } from '@ehsbha/api-contracts';
import { ExpenseCategory, LocalTimeOccurrence } from '@ehsbha/shared-types';
import { parseDraftJson, type RecordDraft } from '@/lib/record-drafts/record-draft.model';

export const expenseDraftContextSchema = driverExpenseSchema.nullable();
export const expenseDraftFieldsSchema = z.object({
  category: z.nativeEnum(ExpenseCategory), amountEgp: z.union([z.string().max(100), z.number()]),
  dateTime: z.string().max(100), dateOccurrence: z.nativeEnum(LocalTimeOccurrence), recordedDateTime: z.string().nullable().optional(),
  vehicleId: z.string().max(200).optional(), isRecurring: z.boolean(), notes: z.string().max(500).optional(),
}).strict();
export const expenseDraftBodySchema = CreateExpenseSchema.extend({ dateTime: z.string().datetime({ offset: true }) });
export function validateExpenseDraft(draft: RecordDraft) {
  parseDraftJson(draft.context, expenseDraftContextSchema);
  if (draft.fields !== null) parseDraftJson(draft.fields, expenseDraftFieldsSchema);
  if (draft.pending) parseDraftJson(draft.pending.body, expenseDraftBodySchema);
}

export function expenseDraftDefaults(expense: Expense | null): ExpenseFormInput {
  return {
      category: expense?.category ?? ExpenseCategory.Food, amountEgp: expense ? String(expense.amountPiastres / 100) : '',
      dateTime: toDatetimeLocalValue(expense ? new Date(expense.dateTime) : new Date()), dateOccurrence: LocalTimeOccurrence.Unspecified,
      recordedDateTime: expense?.dateTime ?? null, vehicleId: expense?.vehicleId ?? '',
      isRecurring: expense?.isRecurring ?? false, notes: expense?.notes ?? '',
    };
}

import { describe, it, expect } from 'vitest';
import { ExpenseCategory } from '@ehsbha/shared-types';
import { CreateExpenseSchema, UpdateExpenseSchema, ExpenseVersionSchema, ListExpensesSchema, ExpenseSummaryQuerySchema, ExpenseLinkableTripsQuerySchema, expenseHistorySchema } from './expense-records';

describe('expense financial boundaries', () => {
  const expense = { category: ExpenseCategory.Toll, amountPiastres: 1250, dateTime: '2026-09-30T21:00:00Z' };
  it('requires an explicit positive version for every edit, delete and restore', () => {
    expect(UpdateExpenseSchema.safeParse({ amountPiastres: 1300 }).success).toBe(false);
    expect(UpdateExpenseSchema.safeParse({ expectedVersion: 1, amountPiastres: 1300 }).success).toBe(true);
    expect(ExpenseVersionSchema.parse({ expectedVersion: '2' }).expectedVersion).toBe(2);
    expect(ExpenseVersionSchema.safeParse({ expectedVersion: 0 }).success).toBe(false);
  });
  it('rejects fractional, zero and database-overflow amounts', () => {
    for (const amountPiastres of [0, -1, 12.5, 2147483648]) expect(CreateExpenseSchema.safeParse({ ...expense, amountPiastres }).success).toBe(false);
    expect(CreateExpenseSchema.safeParse(expense).success).toBe(true);
  });
  it('bounds cursors and page sizes while rejecting reversed list ranges', () => {
    expect(ListExpensesSchema.parse({}).limit).toBe(25);
    expect(ListExpensesSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(ListExpensesSchema.safeParse({ cursor: 'a'.repeat(2049) }).success).toBe(false);
    expect(ListExpensesSchema.safeParse({ from: '2026-10-02', to: '2026-10-01' }).success).toBe(false);
  });
  it('requires real date labels for full totals and fee searches', () => {
    expect(ExpenseSummaryQuerySchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(false);
    expect(ExpenseSummaryQuerySchema.safeParse({ from: expense.dateTime, to: '2026-10-01' }).success).toBe(false);
    expect(ExpenseLinkableTripsQuerySchema.safeParse({ date: '2026-10-01', category: ExpenseCategory.Phone, amountPiastres: 1250 }).success).toBe(false);
    expect(ExpenseLinkableTripsQuerySchema.safeParse({ date: '2026-10-01', category: ExpenseCategory.Parking, amountPiastres: 1250 }).success).toBe(true);
  });
  it('excludes notes and other free text from retained financial snapshots', () => {
    const after = { ...expense, vehicleId: null, linkedTripId: null, deletedAt: null, isRecurring: false, recurrenceRule: null, version: 1 };
    const history = { items: [{ id: 'revision', expenseId: 'expense', action: 'CREATED', before: null, after, createdAt: expense.dateTime }], nextCursor: null };
    expect(expenseHistorySchema.safeParse(history).success).toBe(true);
    expect(expenseHistorySchema.safeParse({ ...history, items: [{ ...history.items[0], after: { ...after, notes: 'Private text' } }] }).success).toBe(false);
  });
});

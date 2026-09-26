import { describe, expect, it } from 'vitest';
import { LocalTimeOccurrence } from '@ehsbha/shared-types';
import { expenseFormSchema, expenseMonthRange } from './expenses.control';

describe('Cairo expense time validation', () => {
  const draft = { category: 'PHONE', amountEgp: '20', dateTime: '2026-10-29T23:30', dateOccurrence: LocalTimeOccurrence.Unspecified, isRecurring: false };
  it('requires the occurrence of a repeated hour before saving a cost', () => {
    expect(expenseFormSchema.safeParse(draft).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...draft, dateOccurrence: LocalTimeOccurrence.Later }).success).toBe(true);
  });
  it('does not shift a cost entered in the skipped spring hour', () => {
    expect(expenseFormSchema.safeParse({ ...draft, dateTime: '2026-04-24T00:30' }).success).toBe(false);
  });
  it('preserves the original repeated-hour occurrence when only another field changes', () => {
    expect(expenseFormSchema.safeParse({ ...draft, recordedDateTime: '2026-10-29T21:30:00.123Z' }).success).toBe(true);
  });
  it('uses complete Cairo month boundaries across daylight-saving changes', () => {
    expect(expenseMonthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31', since: '2026-09-30T21:00:00.000Z', until: '2026-10-31T21:59:59.999Z' });
    expect(expenseMonthRange('2028-02')?.to).toBe('2028-02-29');
    expect(expenseMonthRange('2026-13')).toBe(null);
  });
  it('does not silently round sub-piastre amounts', () => {
    expect(expenseFormSchema.safeParse({ ...draft, dateOccurrence: LocalTimeOccurrence.Later, amountEgp: '12.345' }).success).toBe(false);
  });
});

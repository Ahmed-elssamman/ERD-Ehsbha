import { addDays, diffMinutes, isoYearWeek, startOfUtcDay } from './date';

describe('date utils', () => {
  it('startOfUtcDay zeroes the time portion', () => {
    const d = new Date('2026-05-16T14:32:55Z');
    const s = startOfUtcDay(d);
    expect(s.toISOString()).toBe('2026-05-16T00:00:00.000Z');
  });

  it('isoYearWeek computes ISO week correctly', () => {
    expect(isoYearWeek(new Date('2026-01-01T12:00:00Z'))).toEqual({ isoYear: 2026, isoWeek: 1 });
    expect(isoYearWeek(new Date('2026-12-31T12:00:00Z'))).toEqual({ isoYear: 2026, isoWeek: 53 });
    expect(isoYearWeek(new Date('2025-12-29T12:00:00Z'))).toEqual({ isoYear: 2026, isoWeek: 1 });
  });

  it('diffMinutes is non-negative and rounded', () => {
    expect(diffMinutes(new Date('2026-05-16T10:00:00Z'), new Date('2026-05-16T11:30:30Z'))).toBe(91);
    expect(diffMinutes(new Date('2026-05-16T12:00:00Z'), new Date('2026-05-16T10:00:00Z'))).toBe(0);
  });

  it('addDays adds days across month boundaries', () => {
    expect(addDays(new Date('2026-05-30T12:00:00Z'), 3).toISOString()).toBe('2026-06-02T12:00:00.000Z');
  });
});

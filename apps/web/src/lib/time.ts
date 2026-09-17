import { businessDate, businessDateKey, formatLocalDateTime } from '@ehsbha/shared-types';

/** Cairo wall time; independent of the device timezone. */
export function toDatetimeLocalValue(d: Date): string {
  return formatLocalDateTime(d.toISOString()) ?? '';
}

/** Convert a Date to a value suitable for <input type="date"> (local). */
export function toDateInputValue(d: Date): string {
  return businessDateKey(d);
}

/** ISO week of year (Mon-start, ISO-8601). */
export function isoYearWeek(d: Date): { isoYear: number; isoWeek: number } {
  const date = businessDate(d);
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoYear: date.getUTCFullYear(), isoWeek };
}

export function durationMinutes(startedAt: string, endedAt: string): number {
  return Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000));
}

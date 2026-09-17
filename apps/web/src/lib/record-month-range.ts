import { businessDay, isCalendarDate } from '@ehsbha/shared-types';

export function recordMonthRange(month: string) {
  const from = `${month}-01`;
  if (!isCalendarDate(from)) return null;
  const next = new Date(`${from}T00:00:00.000Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(0);
  const to = next.toISOString().slice(0, 10);
  return { from, to, since: businessDay(from).start.toISOString(), until: new Date(businessDay(to).end.getTime() - 1).toISOString() };
}

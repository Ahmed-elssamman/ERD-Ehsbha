import { addCalendarDays, businessDateKey, businessDay } from '@ehsbha/shared-types';

export enum TripDatePreset { Today = 'today', Last7 = 'last7', Last30 = 'last30', ThisMonth = 'thisMonth', All = 'all' }
export const TRIP_DATE_PRESETS = [TripDatePreset.Today, TripDatePreset.Last7, TripDatePreset.Last30, TripDatePreset.ThisMonth, TripDatePreset.All];

export function parsePreset(value: string | null): TripDatePreset {
  return TRIP_DATE_PRESETS.find((preset) => preset === value) ?? TripDatePreset.Last7;
}

export function rangeFor(preset: TripDatePreset, now = new Date()): { from?: string; to?: string } {
  if (preset === TripDatePreset.All) return {};
  const today = businessDateKey(now);
  let first = today;
  if (preset === TripDatePreset.Last7) first = addCalendarDays(today, -6);
  if (preset === TripDatePreset.Last30) first = addCalendarDays(today, -29);
  if (preset === TripDatePreset.ThisMonth) first = `${today.slice(0, 7)}-01`;
  return { from: businessDay(first).start.toISOString(), to: new Date(businessDay(today).end.getTime() - 1).toISOString() };
}

export const TRIP_BATCH_SELECTION_LIMIT = 200;

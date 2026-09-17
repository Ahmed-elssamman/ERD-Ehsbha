import { DigestFrequency, businessDateKey, businessHour, DRIVER_TIME_ZONE } from '@ehsbha/shared-types';
import type { NotificationPreferences } from '@ehsbha/api-contracts';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  version: 0, digestEnabled: true, digestFrequency: DigestFrequency.Daily,
  deliveryMinute: 510, quietEnabled: true, quietStartMinute: 1380, quietEndMinute: 420,
};
export const DIGEST_FREQUENCY_DAYS: Record<DigestFrequency, number> = {
  [DigestFrequency.Daily]: 1, [DigestFrequency.EveryThreeDays]: 3, [DigestFrequency.Weekly]: 7,
};
export const NOTIFICATION_SCAN_SIZE = 100;
export const DIGEST_TRIP_LIMIT = 10_000;
export const DIGEST_MIN_HOUR_TRIPS = 3;
export const DIGEST_MIN_AREA_TRIPS = 5;
export const DIGEST_MIN_AREA_METERS = 20_000;
export const DIGEST_AREA_RATIO = 0.8;
export function digestEventKey(now: Date): string { return `daily-digest:${businessDateKey(now)}`; }
export function digestIsDue(preferences: NotificationPreferences, lastDate: Date | null, now: Date): boolean {
  if (!preferences.digestEnabled) return false;
  const minutePart = Number(new Intl.DateTimeFormat('en', { timeZone: DRIVER_TIME_ZONE, minute: 'numeric' }).format(now));
  const minute = businessHour(now) * 60 + minutePart;
  if (minute < preferences.deliveryMinute) return false;
  if (preferences.quietEnabled) {
    const start = preferences.quietStartMinute, end = preferences.quietEndMinute;
    if (start === end || (start < end ? minute >= start && minute < end : minute >= start || minute < end)) return false;
  }
  if (lastDate === null) return true;
  const today = Date.parse(`${businessDateKey(now)}T00:00:00Z`);
  return today - lastDate.getTime() >= DIGEST_FREQUENCY_DAYS[preferences.digestFrequency] * 86_400_000;
}

import { DRIVER_TIME_ZONE } from './zoned-time'

/** Calendar-label arithmetic only; a Cairo working day need not last 24 hours. */
export const CALENDAR_DAY_MS = 86_400_000
export const BUSINESS_DAY_CACHE_SIZE = 512
export const BUSINESS_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: DRIVER_TIME_ZONE, calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit',
}
export const BUSINESS_HOUR_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: DRIVER_TIME_ZONE, hour: '2-digit', hourCycle: 'h23', numberingSystem: 'latn',
}

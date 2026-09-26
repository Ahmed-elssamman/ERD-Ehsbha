import { validateCalendarDate } from './time'
import { BUSINESS_DATE_FORMAT, BUSINESS_HOUR_FORMAT, BUSINESS_DAY_CACHE_SIZE, CALENDAR_DAY_MS } from './business-date.control'

const dateFormatter = new Intl.DateTimeFormat('en-GB', BUSINESS_DATE_FORMAT)
const hourFormatter = new Intl.DateTimeFormat('en-GB', BUSINESS_HOUR_FORMAT)
const dayStarts = new Map<string, number>()

export interface BusinessDay { date: string; start: Date; end: Date }

/** A Gregorian Cairo date label, independent of the machine's local timezone. */
export function businessDateKey(instant: Date): string {
  const parts = dateFormatter.formatToParts(instant)
  const values = new Map(parts.map((part) => [part.type, part.value]))
  return `${values.get('year')?.padStart(4, '0')}-${values.get('month')}-${values.get('day')}`
}

/** PostgreSQL DATE representation: UTC midnight encodes a date label, not an instant. */
export function calendarDateValue(value: string): Date {
  return new Date(`${validateCalendarDate(value)}T00:00:00.000Z`)
}

export function businessDate(instant: Date): Date { return calendarDateValue(businessDateKey(instant)) }
export function businessHour(instant: Date): number { return Number(hourFormatter.format(instant)) }

export function addCalendarDays(date: string, days: number): string {
  if (!Number.isInteger(days)) throw new RangeError('Calendar day offset must be an integer')
  return new Date(calendarDateValue(date).getTime() + days * CALENDAR_DAY_MS).toISOString().slice(0, 10)
}

/** First instant belonging to this date, including a skipped or repeated midnight. */
function dayStart(date: string): number {
  const cached = dayStarts.get(date)
  if (cached != null) return cached
  const label = calendarDateValue(date).getTime()
  let lower = label - 2 * CALENDAR_DAY_MS
  let upper = label + 2 * CALENDAR_DAY_MS
  // Cairo dates stay ordered when the wall clock repeats an hour.
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2)
    if (businessDateKey(new Date(middle)) < date) lower = middle + 1
    else upper = middle
  }
  if (businessDateKey(new Date(lower)) !== date) throw new RangeError('Business date does not exist')
  if (dayStarts.size >= BUSINESS_DAY_CACHE_SIZE) dayStarts.clear()
  dayStarts.set(date, lower)
  return lower
}

export function businessDay(date: string): BusinessDay {
  validateCalendarDate(date)
  return { date, start: new Date(dayStart(date)), end: new Date(dayStart(addCalendarDays(date, 1))) }
}

export function businessDayForDate(date: Date): BusinessDay { return businessDay(date.toISOString().slice(0, 10)) }

/** Calendar labels touched by [start, end); an exact midnight end is excluded. */
export function businessDatesBetween(start: Date, end: Date): Date[] {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return []
  const last = businessDateKey(new Date(end.getTime() - 1))
  const dates: Date[] = []
  for (let date = businessDateKey(start); date <= last; date = addCalendarDays(date, 1)) dates.push(calendarDateValue(date))
  return dates
}

import { isCalendarDate } from './time'
import { LOCAL_DATE_TIME_FORMAT } from './zoned-time.control'

export const DRIVER_TIME_ZONE = 'Africa/Cairo'
export enum LocalTimeOccurrence { Unspecified = '', Earlier = 'earlier', Later = 'later' }
const cairoFormatter = new Intl.DateTimeFormat('en-GB', { ...LOCAL_DATE_TIME_FORMAT, timeZone: DRIVER_TIME_ZONE })

/** Returns every matching instant; DST gaps yield none and overlaps yield two. */
export function localDateTimeInstants(value: string, timeZone = DRIVER_TIME_ZONE): string[] {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match || !isCalendarDate(match[1])) return []
  const hour = Number(match[2])
  const minute = Number(match[3])
  const second = Number(match[4] ?? 0)
  if (hour > 23 || minute > 59 || second > 59) return []
  const wall = `${match[1]}T${match[2]}:${match[3]}:${String(second).padStart(2, '0')}`
  const wallMillis = Date.parse(`${wall}Z`)
  const offsets = new Set<number>()
  try {
    for (const shift of [-86400000, 0, 86400000]) {
      const instant = wallMillis + shift
      const local = formatLocalDateTime(new Date(instant).toISOString(), timeZone)
      if (!local) return []
      offsets.add(Date.parse(`${local}Z`) - instant)
    }
    return [...offsets]
      .map((offset) => new Date(wallMillis - offset).toISOString())
      .filter((instant) => formatLocalDateTime(instant, timeZone) === wall)
      .sort()
  } catch {
    return []
  }
}

export function localDateTimeToUtc(value: string, timeZone = DRIVER_TIME_ZONE): string | null {
  const matches = localDateTimeInstants(value, timeZone)
  return matches.length === 1 ? matches[0] : null
}

/** Preserve an unchanged recorded instant; require a choice for a new repeated clock time. */
export function resolveLocalDateTime(value: string, occurrence = LocalTimeOccurrence.Unspecified, original: string | null = null): string | null {
  const matches = localDateTimeInstants(value)
  if (!matches.length) return null
  if (occurrence === LocalTimeOccurrence.Earlier) return matches[0]
  if (occurrence === LocalTimeOccurrence.Later) return matches[matches.length - 1]
  if (original) {
    const date = new Date(original)
    if (Number.isFinite(date.getTime()) && matches.some((instant) => formatLocalDateTime(instant) === formatLocalDateTime(original))) return date.toISOString()
  }
  return matches.length === 1 ? matches[0] : null
}

/** A wall-clock value without an offset; intended for explicit timezone-labelled inputs. */
export function formatLocalDateTime(instant: string, timeZone = DRIVER_TIME_ZONE): string | null {
  const date = new Date(instant)
  if (!Number.isFinite(date.getTime())) return null
  try {
    const formatter = timeZone === DRIVER_TIME_ZONE ? cairoFormatter
      : new Intl.DateTimeFormat('en-GB', { ...LOCAL_DATE_TIME_FORMAT, timeZone })
    const parts = formatter.formatToParts(date)
    const values = new Map(parts.map((part) => [part.type, part.value]))
    return `${values.get('year')}-${values.get('month')}-${values.get('day')}T${values.get('hour')}:${values.get('minute')}:${values.get('second')}`
  } catch {
    return null
  }
}

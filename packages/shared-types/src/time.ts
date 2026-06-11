const IANA_TIMEZONE_REGEX = /^[A-Za-z_]+(?:\/[A-Za-z_]+)*(?:\/[A-Za-z_]+)?$/
const UTC_INSTANT_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/
const CALENDAR_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function isIanaTimezone(value: string): boolean {
  if (!value || value.length > 64) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function validateIanaTimezone(value: string): string {
  if (!isIanaTimezone(value)) {
    throw new Error(`Invalid IANA timezone: "${value}"`)
  }
  return value
}

export function isUtcInstant(value: string): boolean {
  if (!UTC_INSTANT_REGEX.test(value)) return false
  const parsed = new Date(value)
  return !isNaN(parsed.getTime())
}

export function validateUtcInstant(value: string): string {
  if (!isUtcInstant(value)) {
    throw new Error(`Invalid UTC instant: "${value}". Must be ISO-8601 with offset or Z`)
  }
  return value
}

export function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_REGEX.test(value)) return false
  const parsed = new Date(value + 'T00:00:00Z')
  if (isNaN(parsed.getTime())) return false
  const [y, m, d] = value.split('-').map(Number)
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() + 1 === m && parsed.getUTCDate() === d
}

export function validateCalendarDate(value: string): string {
  if (!isCalendarDate(value)) {
    throw new Error(`Invalid calendar date: "${value}". Must be YYYY-MM-DD`)
  }
  return value
}

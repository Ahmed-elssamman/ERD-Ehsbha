import { describe, expect, it } from 'vitest'
import { addCalendarDays, businessDateKey, businessDay, businessDatesBetween, businessHour } from './business-date'

describe('Cairo business calendar', () => {
  it('assigns a late UTC trip to the next Cairo date in winter and summer', () => {
    expect(businessDateKey(new Date('2026-01-14T22:30:00Z'))).toBe('2026-01-15')
    expect(businessDateKey(new Date('2026-07-14T21:30:00Z'))).toBe('2026-07-15')
    expect(businessHour(new Date('2026-07-14T21:30:00Z'))).toBe(0)
  })
  it.each([
    ['2026-01-15', '2026-01-14T22:00:00.000Z', '2026-01-15T22:00:00.000Z', 24],
    ['2026-04-24', '2026-04-23T22:00:00.000Z', '2026-04-24T21:00:00.000Z', 23],
    ['2026-10-29', '2026-10-28T21:00:00.000Z', '2026-10-29T22:00:00.000Z', 25],
  ])('uses actual timezone boundaries for %s', (date, start, end, hours) => {
    const day = businessDay(String(date))
    expect(day.start.toISOString()).toBe(start)
    expect(day.end.toISOString()).toBe(end)
    expect((day.end.getTime() - day.start.getTime()) / 3_600_000).toBe(hours)
    expect(businessDateKey(new Date(day.start.getTime() - 1))).toBe(addCalendarDays(String(date), -1))
    expect(businessDateKey(new Date(day.end.getTime() - 1))).toBe(date)
  })
  it('counts the repeated autumn hour in one date and excludes an exact midnight end', () => {
    expect(businessDatesBetween(new Date('2026-10-29T20:30Z'), new Date('2026-10-29T22:00Z')).map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-10-29'])
    expect(businessDatesBetween(new Date('2026-10-29T20:30Z'), new Date('2026-10-29T22:01Z')).map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-10-29', '2026-10-30'])
  })
  it('keeps calendar arithmetic independent of DST and rejects invalid dates', () => {
    expect(addCalendarDays('2026-04-24', 1)).toBe('2026-04-25')
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(() => businessDay('2026-02-30')).toThrow()
    expect(() => addCalendarDays('2026-01-01', 0.5)).toThrow()
  })
  it('does not expose mutable cached Date instances', () => {
    businessDay('2026-07-15').start.setUTCFullYear(2000)
    expect(businessDay('2026-07-15').start.toISOString()).toBe('2026-07-14T21:00:00.000Z')
  })
})

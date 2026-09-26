import { describe, expect, it } from 'vitest'
import { formatLocalDateTime, localDateTimeInstants, localDateTimeToUtc, resolveLocalDateTime, LocalTimeOccurrence } from './zoned-time'

describe('Egyptian local times', () => {
  it('requires an explicit occurrence for a new ambiguous time', () => {
    expect(resolveLocalDateTime('2026-10-29T23:30')).toBeNull()
    expect(resolveLocalDateTime('2026-10-29T23:30', LocalTimeOccurrence.Earlier)).toBe('2026-10-29T20:30:00.000Z')
    expect(resolveLocalDateTime('2026-10-29T23:30', LocalTimeOccurrence.Later)).toBe('2026-10-29T21:30:00.000Z')
  })
  it('preserves the recorded occurrence and milliseconds on an unchanged edit', () => {
    const original = '2026-10-29T21:30:05.123Z'
    expect(resolveLocalDateTime('2026-10-29T23:30:05', LocalTimeOccurrence.Unspecified, original)).toBe(original)
    expect(resolveLocalDateTime('2026-10-29T23:31:05', LocalTimeOccurrence.Unspecified, original)).toBeNull()
    expect(resolveLocalDateTime('2026-10-29T23:30:05', LocalTimeOccurrence.Earlier, original)).toBe('2026-10-29T20:30:05.000Z')
  })
  it('rejects nonexistent spring times even with an occurrence or original', () => {
    expect(resolveLocalDateTime('2026-04-24T00:30', LocalTimeOccurrence.Later, '2026-04-23T22:30:00.000Z')).toBeNull()
  })
  it('uses the historical winter offset', () => {
    expect(localDateTimeToUtc('2026-01-15T08:30')).toBe('2026-01-15T06:30:00.000Z')
  })
  it('uses the summer offset instead of treating the clock as UTC', () => {
    expect(localDateTimeToUtc('2026-05-18T22:46')).toBe('2026-05-18T19:46:00.000Z')
  })
  it('does not shift a nonexistent spring clock into another hour', () => {
    expect(localDateTimeInstants('2026-04-24T00:30')).toEqual([])
  })
  it('exposes both instants at the autumn clock overlap', () => {
    expect(localDateTimeInstants('2026-10-29T23:30')).toEqual([
      '2026-10-29T20:30:00.000Z', '2026-10-29T21:30:00.000Z',
    ])
    expect(localDateTimeToUtc('2026-10-29T23:30')).toBeNull()
  })
  it.each(['2026-02-30T12:30', '2026-01-15T24:00', '2026-01-15', 'invalid'])('rejects invalid calendar or clock input: %s', (value) => {
    expect(localDateTimeToUtc(value)).toBeNull()
  })
  it('formats Cairo time independently of the browser timezone', () => {
    expect(formatLocalDateTime('2026-05-18T19:46:00.000Z')).toBe('2026-05-18T22:46:00')
  })
})

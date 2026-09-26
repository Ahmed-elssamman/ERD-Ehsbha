import { describe, it, expect } from 'vitest'
import { analyticsSummarySchema, DateSchema, WindowSchema } from './analytics-intelligence'

describe('analytics-intelligence contracts', () => {
  it('accepts a date label and rejects timestamps or nonexistent calendar dates', () => {
    expect(DateSchema.parse({ date: '2026-10-01' })).toEqual({ date: '2026-10-01' })
    expect(DateSchema.safeParse({ date: '2026-09-30T21:30:00Z' }).success).toBe(false)
    expect(DateSchema.safeParse({ date: '2026-02-30' }).success).toBe(false)
    expect(DateSchema.safeParse({}).success).toBe(true)
  })
  it('bounds calendar windows and rejects zero or negative lengths', () => {
    expect(WindowSchema.parse({ window: '3650d' }).window).toBe('3650d')
    for (const window of ['0d', '-1d', '3651d', '10000000000d']) expect(WindowSchema.safeParse({ window }).success).toBe(false)
  })
  it('validates analytics summary', () => {
    const result = analyticsSummarySchema.safeParse({ totalTrips: 100, totalDistanceMeters: 500000, totalAmountPiastres: 2500000, periodStart: '2026-06-01', periodEnd: '2026-06-30' })
    expect(result.success).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { analyticsSummarySchema, forecastSchema, recommendationSchema } from './analytics-intelligence'

describe('analytics-intelligence contracts', () => {
  it('validates analytics summary', () => {
    const result = analyticsSummarySchema.safeParse({ totalTrips: 100, totalDistanceMeters: 500000, totalAmountPiastres: 2500000, periodStart: '2026-06-01', periodEnd: '2026-06-30' })
    expect(result.success).toBe(true)
  })
})

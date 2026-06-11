import { describe, it, expect } from 'vitest'
import { tripSchema, createTripSchema, ocrRequestSchema, ocrResultSchema } from './trip-ocr'

describe('trip-ocr contracts', () => {
  it('validates a trip', () => {
    const result = tripSchema.safeParse({ id: 't1', driverId: 'd1', distanceMeters: 5000, amountPiastres: 25000, startedAt: '2026-06-11T10:00:00Z', status: 'completed' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid trip units', () => {
    const result = tripSchema.safeParse({ id: 't1', driverId: 'd1', distanceMeters: 5.5, amountPiastres: 250.5, startedAt: '2026-06-11T10:00:00Z', status: 'completed' })
    expect(result.success).toBe(false)
  })

  it('validates OCR request', () => {
    const result = ocrRequestSchema.safeParse({ imageUrl: 'https://example.com/rec.jpg' })
    expect(result.success).toBe(true)
  })
})

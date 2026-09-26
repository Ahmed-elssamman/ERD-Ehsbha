import { describe, it, expect } from 'vitest'
import { tripSchema, ocrRequestSchema, CreateTripSchema } from './trip-ocr'

describe('trip-ocr contracts', () => {
  it('accepts take-home income without inventing missing fare or commission', () => {
    const trip = { vehicleId: 'vehicle', driverAppId: 'app', earningsPiastres: 8500, tipPiastres: 500,
      totalKmMeters: 10000, paidKmMeters: 8000, startedAt: '2026-09-16T08:00:00Z', endedAt: '2026-09-16T08:30:00Z' }
    expect(CreateTripSchema.parse(trip)).toMatchObject({ grossPiastres: null, commissionPiastres: null, earningsPiastres: 8500 })
    expect(CreateTripSchema.safeParse({ ...trip, earningsPiastres: null }).success).toBe(false)
    expect(CreateTripSchema.safeParse({ ...trip, tipPiastres: 8501 }).success).toBe(false)
    expect(CreateTripSchema.safeParse({ ...trip, grossPiastres: 10000, commissionPiastres: 1000 }).success).toBe(false)
  })
  it('bounds a recorded trip interval without truncating its dates', () => {
    const trip = { vehicleId: 'vehicle', driverAppId: 'app', grossPiastres: 10000, commissionPiastres: 0, totalKmMeters: 10000,
      paidKmMeters: 8000, startedAt: '2026-09-01T08:00:00Z', endedAt: '2026-09-08T08:00:00Z' }
    expect(CreateTripSchema.safeParse(trip).success).toBe(true)
    expect(CreateTripSchema.safeParse({ ...trip, endedAt: '2026-09-08T08:00:00.001Z' }).success).toBe(false)
    expect(CreateTripSchema.safeParse({ ...trip, endedAt: trip.startedAt }).success).toBe(false)
  })
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

import { describe, expect, it } from 'vitest'
import { ocrConfirmationRequestSchema } from './ocr-confirmation'

const item = { candidateId: 'a'.repeat(64), trip: {
  vehicleId: 'vehicle', driverAppId: 'app', startedAt: '2026-09-16T10:00:00Z', endedAt: '2026-09-16T10:30:00Z',
  grossPiastres: 10000, receivedPiastres: 8000, commissionPiastres: 2000, totalKmMeters: 10000, paidKmMeters: 8000,
} }
describe('OCR confirmation contracts', () => {
  it('accepts consistent integer values and defaults only optional extras', () => {
    expect(ocrConfirmationRequestSchema.parse({ items: [item] }).items[0].trip.tipPiastres).toBe(0)
  })
  it('rejects conflicting financial facts and oversized database integers', () => {
    for (const trip of [{ ...item.trip, commissionPiastres: 1000 }, { ...item.trip, grossPiastres: 3_000_000_000 }, { ...item.trip, waitingFeePiastres: 11000 }]) {
      expect(ocrConfirmationRequestSchema.safeParse({ items: [{ ...item, trip }] }).success).toBe(false)
    }
  })
  it('requires explicit commission and rejects foreign fields and duplicate candidates', () => {
    const { commissionPiastres: _commission, ...trip } = item.trip
    expect(ocrConfirmationRequestSchema.safeParse({ items: [{ ...item, trip }] }).success).toBe(false)
    expect(ocrConfirmationRequestSchema.safeParse({ items: [item, item] }).success).toBe(false)
    expect(ocrConfirmationRequestSchema.safeParse({ items: [item], driverId: 'other' }).success).toBe(false)
    expect(ocrConfirmationRequestSchema.safeParse({ items: [{ ...item, trip: { ...item.trip, clientMutationId: 'replacement' } }] }).success).toBe(false)
  })
  it('rejects impossible dates, reversed times, distances and oversized batches', () => {
    for (const trip of [{ ...item.trip, startedAt: 'not-a-date' }, { ...item.trip, endedAt: item.trip.startedAt }, { ...item.trip, paidKmMeters: 12000 }]) {
      expect(ocrConfirmationRequestSchema.safeParse({ items: [{ ...item, trip }] }).success).toBe(false)
    }
    expect(ocrConfirmationRequestSchema.safeParse({ items: Array.from({ length: 21 }, () => item) }).success).toBe(false)
  })
})

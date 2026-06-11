import { describe, it, expect } from 'vitest'
import { expenseSchema, fuelEntrySchema, maintenanceSchema, odometerEntrySchema, sessionSchema, goalSchema } from './operations'

describe('operations contracts', () => {
  it('validates expense', () => {
    const result = expenseSchema.safeParse({ id: 'e1', tripId: 't1', amountPiastres: 5000, category: 'fuel', incurredAt: '2026-06-11T10:00:00Z' })
    expect(result.success).toBe(true)
  })

  it('validates fuel entry', () => {
    const result = fuelEntrySchema.safeParse({ id: 'f1', vehicleId: 'v1', liters: 40.5, amountPiastres: 20000, filledAt: '2026-06-11T10:00:00Z' })
    expect(result.success).toBe(true)
  })

  it('validates goal', () => {
    const result = goalSchema.safeParse({ id: 'g1', driverId: 'd1', targetAmountPiastres: 100000, periodStart: '2026-06-01', periodEnd: '2026-06-30', status: 'active' })
    expect(result.success).toBe(true)
  })
})

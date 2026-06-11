import { describe, it, expect } from 'vitest'
import { adminUserSchema, adminDriverSchema, adminTripSchema, adminVehicleSchema } from './admin-core'

describe('admin-core contracts', () => {
  it('validates admin driver view', () => {
    const result = adminDriverSchema.safeParse({ id: 'd1', name: 'Ahmed', phone: '+201234567890', status: 'active', totalTrips: 50, totalAmountPiastres: 250000, registeredAt: '2025-01-01T00:00:00Z' })
    expect(result.success).toBe(true)
  })
})

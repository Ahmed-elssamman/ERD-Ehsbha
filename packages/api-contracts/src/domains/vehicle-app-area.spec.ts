import { describe, it, expect } from 'vitest'
import { vehicleSchema, createVehicleSchema, appSourceSchema, areaSchema } from './vehicle-app-area'

describe('vehicle-app-area contracts', () => {
  it('validates a vehicle', () => {
    const result = vehicleSchema.safeParse({ id: 'v1', plate: 'ABC123', model: 'Toyota', year: 2020 })
    expect(result.success).toBe(true)
  })

  it('validates create vehicle request', () => {
    const result = createVehicleSchema.safeParse({ plate: 'ABC123', model: 'Toyota', year: 2020 })
    expect(result.success).toBe(true)
  })

  it('validates area', () => {
    const result = areaSchema.safeParse({ id: 'a1', nameEn: 'Cairo', nameAr: 'القاهرة' })
    expect(result.success).toBe(true)
  })
})

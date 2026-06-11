import { describe, it, expect } from 'vitest'
import { driverLoginSchema, driverRefreshSchema, passwordResetSchema, driverProfileSchema, adminLoginSchema } from './auth-profile'

describe('auth-profile contracts', () => {
  describe('driverLoginSchema', () => {
    it('validates a valid driver login', () => {
      const result = driverLoginSchema.safeParse({ phone: '+201234567890', password: 'secret123' })
      expect(result.success).toBe(true)
    })

    it('rejects missing fields', () => {
      expect(driverLoginSchema.safeParse({}).success).toBe(false)
    })
  })

  describe('driverProfileSchema', () => {
    it('validates a valid profile response', () => {
      const result = driverProfileSchema.safeParse({ id: 'driver-1', name: 'Ahmed', phone: '+201234567890', locale: 'ar' })
      expect(result.success).toBe(true)
    })
  })

  describe('adminLoginSchema', () => {
    it('validates admin login', () => {
      const result = adminLoginSchema.safeParse({ email: 'admin@ehsbha.com', password: 'admin-pass' })
      expect(result.success).toBe(true)
    })
  })
})

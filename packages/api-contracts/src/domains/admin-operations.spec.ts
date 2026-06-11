import { describe, it, expect } from 'vitest'
import { moderationActionSchema, auditRecordSchema, roleSchema, adminSettingsSchema } from './admin-operations'

describe('admin-operations contracts', () => {
  it('validates audit record', () => {
    const result = auditRecordSchema.safeParse({ id: 'a1', adminId: 'admin-1', action: 'driver.suspended', targetId: 'd1', timestamp: '2026-06-11T12:00:00Z' })
    expect(result.success).toBe(true)
  })
})

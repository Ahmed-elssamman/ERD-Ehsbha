import { describe, it, expect } from 'vitest'
import { communityPostSchema, reviewSchema, supportTicketSchema, notificationSchema } from './communications'

describe('communications contracts', () => {
  it('validates notification', () => {
    const result = notificationSchema.safeParse({ id: 'n1', driverId: 'd1', title: 'New Trip', body: 'You have a new trip request', type: 'trip', createdAt: '2026-06-11T10:00:00Z' })
    expect(result.success).toBe(true)
  })
})

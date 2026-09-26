import { describe, expect, it } from 'vitest'
import { SyncEntityKind, SyncPullMode } from '@ehsbha/shared-types'
import { PullSchema, syncPageSchema, syncPullResponseSchema, syncRecommendationSchema } from './sync-pull'

describe('sync reconciliation contracts', () => {
  it('bounds pages and rejects legacy query fields', () => {
    expect(PullSchema.parse({}).limit).toBe(25)
    expect(PullSchema.parse({ limit: 100 }).limit).toBe(100)
    for (const value of [{ limit: 101 }, { limit: 0 }, { cursor: '' }, { cursor: 'x'.repeat(4097) }, { since: '2026-09-16' }]) {
      expect(PullSchema.safeParse(value).success).toBe(false)
    }
  })
  it('requires typed records and an explicit cycle completion token', () => {
    const response = { mode: SyncPullMode.Reconcile, cycleId: '559915ea-057c-482f-a2f8-27c336773d18',
      startedAt: '2026-09-17T00:00:00Z', expiresAt: '2026-09-18T00:00:00Z',
      page: { kind: SyncEntityKind.Areas, items: [] }, nextCursor: null }
    expect(syncPullResponseSchema.safeParse(response).success).toBe(true)
    expect(syncPullResponseSchema.safeParse({ cursor: '2026-09-17', entities: {} }).success).toBe(false)
    expect(syncPageSchema.safeParse({ kind: SyncEntityKind.Trips, items: [{ id: 'trip' }] }).success).toBe(false)
    expect(syncPageSchema.safeParse({ kind: SyncEntityKind.Areas, items: Array.from({ length: 101 }, () => ({ id: 'a', name: 'Area', color: null, createdAt: '2026-09-17T00:00:00Z' })) }).success).toBe(false)
  })
  it('preserves structured recommendation payloads and expiry', () => {
    const item = { id: 'r', type: 'break', title: 'Title', body: 'Body', surface: 'home', score: 0.5,
      generatedAt: '2026-09-17T00:00:00Z', expiresAt: '2026-09-18T00:00:00Z', dismissedAt: null,
      payload: { count: 3, facts: [{ id: 'trip', value: null }], enabled: true } }
    expect(syncRecommendationSchema.parse(item).payload).toEqual(item.payload)
    expect(syncRecommendationSchema.safeParse({ ...item, payload: { invalid: new Date() } }).success).toBe(false)
  })
})

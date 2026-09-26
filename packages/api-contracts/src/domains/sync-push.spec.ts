import { describe, expect, it } from 'vitest'
import { SyncMutationKind, SyncMutationStatus } from '@ehsbha/shared-types'
import { PushSchema, syncMutationResultSchema } from './sync-push'
import { EndSessionSchema } from './operations'

const expense = { clientMutationId: 'test-expense-create', kind: SyncMutationKind.ExpenseCreate,
  payload: { category: 'OTHER', amountPiastres: 100, dateTime: '2026-09-17T09:00:00Z' } }

describe('typed sync push', () => {
  it('validates all payloads before execution and prevents ambiguous identities', () => {
    expect(PushSchema.safeParse({ mutations: [expense] }).success).toBe(true)
    for (const mutations of [[], [expense, expense], [{ ...expense, payload: { ...expense.payload, clientMutationId: 'nested-key' } }],
      [{ ...expense, payload: { ...expense.payload, amountPiastres: -1 } }], [{ ...expense, kind: 'unregistered.operation' }],
      Array.from({ length: 51 }, (_, index) => ({ ...expense, clientMutationId: `test-expense-${index}` }))]) {
      expect(PushSchema.safeParse({ mutations }).success).toBe(false)
    }
  })
  it('rejects invalid trip chronology and a client-controlled origin', () => {
    const trip = { clientMutationId: 'test-trip-create', kind: SyncMutationKind.TripCreate,
      payload: { vehicleId: 'vehicle', driverAppId: 'app', startedAt: '2026-09-17T10:00:00Z', endedAt: '2026-09-17T09:00:00Z', earningsPiastres: 100, totalKmMeters: 10, paidKmMeters: 10 } }
    expect(PushSchema.safeParse({ mutations: [trip] }).success).toBe(false)
    expect(PushSchema.safeParse({ mutations: [{ ...trip, payload: { ...trip.payload, endedAt: '2026-09-17T11:00:00Z', source: 'MANUAL' } }] }).success).toBe(false)
  })
  it('requires a stable identity for ordinary session-end retries', () => {
    expect(EndSessionSchema.safeParse({}).success).toBe(false)
    expect(EndSessionSchema.safeParse({ clientMutationId: 'test-session-end', expectedVersion: 1 }).success).toBe(true)
  })
  it('allows an applied receipt for a subsequently removed record', () => {
    expect(syncMutationResultSchema.safeParse({ clientMutationId: expense.clientMutationId, kind: expense.kind,
      status: SyncMutationStatus.Applied, recordId: 'removed', appliedAt: '2026-09-17T09:00:00Z', replayed: true, data: null }).success).toBe(true)
    expect(syncMutationResultSchema.safeParse({ clientMutationId: expense.clientMutationId, kind: expense.kind,
      status: SyncMutationStatus.Applied, error: { code: 'CONFLICT', messageKey: 'errors.conflict' } }).success).toBe(false)
    expect(syncMutationResultSchema.safeParse({ clientMutationId: expense.clientMutationId, kind: expense.kind,
      status: SyncMutationStatus.InternalError, error: { code: 'PRIVATE_DATABASE_DETAIL', messageKey: 'internal' } }).success).toBe(false)
  })
})

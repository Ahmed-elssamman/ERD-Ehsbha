import { describe, expect, it } from 'vitest'
import { StartSessionSchema, EndSessionSchema, openSessionSchema, CreateWorkSessionSchema, CorrectWorkSessionSchema, ListSessionsSchema } from './work-sessions'

describe('work-session contracts', () => {
  it('represents an empty open-session result explicitly', () => {
    expect(openSessionSchema.safeParse({ session: null }).success).toBe(true)
    expect(openSessionSchema.safeParse({ ok: true }).success).toBe(false)
  })
  it('allows overall work without inventing a platform and requires durable identities', () => {
    expect(StartSessionSchema.parse({ clientMutationId: 'test-start' }).driverAppId).toBeUndefined()
    expect(StartSessionSchema.safeParse({ driverAppId: 'app' }).success).toBe(false)
    expect(EndSessionSchema.safeParse({ clientMutationId: 'test-end' }).success).toBe(false)
    expect(EndSessionSchema.safeParse({ clientMutationId: 'test-end', expectedVersion: 1 }).success).toBe(true)
  })
  it('rejects inverted, excessive, or unreviewed corrections', () => {
    const body = { clientMutationId: 'test-create', startedAt: '2026-09-14T08:00:00Z', endedAt: '2026-09-14T10:00:00Z' }
    expect(CreateWorkSessionSchema.safeParse(body).success).toBe(true)
    expect(CreateWorkSessionSchema.safeParse({ ...body, endedAt: body.startedAt }).success).toBe(false)
    expect(CreateWorkSessionSchema.safeParse({ ...body, endedAt: '2026-09-22T08:00:00Z' }).success).toBe(false)
    expect(CorrectWorkSessionSchema.safeParse(body).success).toBe(false)
    expect(CorrectWorkSessionSchema.safeParse({ ...body, expectedVersion: 2 }).success).toBe(true)
  })
  it('bounds paging and rejects invalid date ranges', () => {
    expect(ListSessionsSchema.parse({}).limit).toBe(25)
    expect(ListSessionsSchema.safeParse({ limit: 101 }).success).toBe(false)
    expect(ListSessionsSchema.safeParse({ from: '2026-09-16', to: '2026-09-15' }).success).toBe(false)
  })
})

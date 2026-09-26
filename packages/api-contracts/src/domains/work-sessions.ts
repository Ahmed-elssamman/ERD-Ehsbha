import { z } from 'zod'
import { WorkSessionChange, WorkSessionView } from '@ehsbha/shared-types'
import { registerOperation } from '../catalog/registry'
import type { PaginationDescriptor } from '../catalog/types'
import { MAX_RECORDED_WORK_INTERVAL_MS } from './trip-details'

const instant = z.string().datetime({ offset: true })
const identity = z.string().min(8).max(64).regex(/^[\x21-\x7e]+$/)
const version = z.number().int().positive()
const cursor = z.string().min(1).max(2048).optional()
const limit = z.coerce.number().int().min(1).max(100).default(25)
export const workSessionSnapshotSchema = z.object({ driverAppId: z.string().nullable(), startedAt: instant,
  endedAt: instant.nullable(), activeMinutes: z.number().int().nonnegative(), version, deletedAt: instant.nullable() }).strict()
export const sessionSchema = workSessionSnapshotSchema.extend({ id: z.string(), driverId: z.string(),
  clientMutationId: z.string().nullable(), createdAt: instant, updatedAt: instant }).passthrough()
export const openSessionSchema = z.object({ session: sessionSchema.nullable() }).passthrough()
export const sessionPageSchema = z.object({ items: z.array(sessionSchema), nextCursor: z.string().nullable() }).passthrough()
export const StartSessionSchema = z.object({ driverAppId: z.string().min(1).nullable().optional(), startedAt: z.coerce.date().optional(), clientMutationId: identity }).strict()
export const EndSessionSchema = z.object({ clientMutationId: identity, expectedVersion: version, endedAt: z.coerce.date().optional() }).strict()
const intervalFields = { startedAt: z.coerce.date(), endedAt: z.coerce.date() }
function validInterval(value: { startedAt: Date; endedAt: Date }): boolean {
  const elapsed = value.endedAt.getTime() - value.startedAt.getTime()
  return elapsed > 0 && elapsed <= MAX_RECORDED_WORK_INTERVAL_MS
}
export const CreateWorkSessionSchema = z.object({ ...intervalFields, clientMutationId: identity }).strict().refine(validInterval, 'Invalid work interval')
export const CorrectWorkSessionSchema = z.object({ ...intervalFields, clientMutationId: identity, expectedVersion: version }).strict().refine(validInterval, 'Invalid work interval')
export const WorkSessionVersionSchema = z.object({ clientMutationId: identity, expectedVersion: version }).strict()
export const ListSessionsSchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(),
  view: z.nativeEnum(WorkSessionView).default(WorkSessionView.Active), cursor, limit }).strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, 'Invalid date range')
export const WorkSessionHistoryQuerySchema = z.object({ cursor, limit }).strict()
export const workSessionRevisionSchema = z.object({ id: z.string(), sessionId: z.string(), action: z.nativeEnum(WorkSessionChange),
  before: workSessionSnapshotSchema.nullable(), after: workSessionSnapshotSchema, createdAt: instant }).passthrough()
export const workSessionHistorySchema = z.object({ items: z.array(workSessionRevisionSchema), nextCursor: z.string().nullable() }).passthrough()

export interface StartSessionDto { driverAppId?: string | null; startedAt?: Date; clientMutationId: string }
export interface EndSessionDto { endedAt?: Date; clientMutationId: string; expectedVersion: number }
export interface WorkSessionVersionDto { clientMutationId: string; expectedVersion: number }
export interface CreateWorkSessionDto { startedAt: Date; endedAt: Date; clientMutationId: string }
export interface CorrectWorkSessionDto extends CreateWorkSessionDto { expectedVersion: number }
export interface ListSessionsDto { from?: Date; to?: Date; cursor?: string; limit: number; view: WorkSessionView }
export interface WorkSessionHistoryQuery { cursor?: string; limit: number }

const consumers = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' },
  { application: 'web', role: 'consumer', migrationStatus: 'shared', owner: 'platform' }] as const
const failureCodes = ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'SESSION_VERSION_CONFLICT', 'SESSION_STATE_CONFLICT', 'SESSION_ALREADY_OPEN', 'SESSION_ALREADY_ENDED', 'IDEMPOTENCY_KEY_REUSED']
const page = { mode: 'cursor', defaultSize: 25, maximumSize: 100, stableSort: ['startedAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null } satisfies PaginationDescriptor
registerOperation({ operationId: 'driver.sessions.list', transport: 'http', method: 'GET', path: '/api/v1/sessions', realm: 'driver', lifecycle: 'active',
  request: { query: 'ListSessionsSchema' }, successData: 'sessionPageSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'INVALID_CURSOR'], consumers: [...consumers], compatibility: 'incompatible', owner: 'platform', pagination: page, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.sessions.open', transport: 'http', method: 'GET', path: '/api/v1/sessions/open', realm: 'driver', lifecycle: 'active',
  request: {}, successData: 'openSessionSchema', failureCodes: ['UNAUTHENTICATED'], consumers: [...consumers], compatibility: 'incompatible', owner: 'platform', pagination: null, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.sessions.get', transport: 'http', method: 'GET', path: '/api/v1/sessions/:id', realm: 'driver', lifecycle: 'active',
  request: {}, successData: 'sessionSchema', failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'], consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.sessions.history', transport: 'http', method: 'GET', path: '/api/v1/sessions/:id/history', realm: 'driver', lifecycle: 'active',
  request: { query: 'WorkSessionHistoryQuerySchema' }, successData: 'workSessionHistorySchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'INVALID_CURSOR'], consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: { ...page, stableSort: ['createdAt:desc', 'id:desc'] }, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.sessions.start', transport: 'http', method: 'POST', path: '/api/v1/sessions/start', realm: 'driver', lifecycle: 'active',
  request: { body: 'StartSessionSchema' }, successData: 'sessionSchema', failureCodes, consumers: [...consumers], compatibility: 'incompatible', owner: 'platform', pagination: null, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.sessions.end', transport: 'http', method: 'POST', path: '/api/v1/sessions/:id/end', realm: 'driver', lifecycle: 'active',
  request: { body: 'EndSessionSchema' }, successData: 'sessionSchema', failureCodes, consumers: [...consumers], compatibility: 'incompatible', owner: 'platform', pagination: null, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.sessions.create', transport: 'http', method: 'POST', path: '/api/v1/sessions', realm: 'driver', lifecycle: 'active',
  request: { body: 'CreateWorkSessionSchema' }, successData: 'sessionSchema', failureCodes, consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.sessions.correct', transport: 'http', method: 'PATCH', path: '/api/v1/sessions/:id', realm: 'driver', lifecycle: 'active',
  request: { body: 'CorrectWorkSessionSchema' }, successData: 'sessionSchema', failureCodes, consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.sessions.delete', transport: 'http', method: 'POST', path: '/api/v1/sessions/:id/delete', realm: 'driver', lifecycle: 'active',
  request: { body: 'WorkSessionVersionSchema' }, successData: 'sessionSchema', failureCodes, consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.sessions.restore', transport: 'http', method: 'POST', path: '/api/v1/sessions/:id/restore', realm: 'driver', lifecycle: 'active',
  request: { body: 'WorkSessionVersionSchema' }, successData: 'sessionSchema', failureCodes, consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null })

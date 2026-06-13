import { z } from 'zod'
import { registerOperation } from '../catalog/registry'

export const healthSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  uptime: z.number().min(0),
  version: z.string(),
}).passthrough()

export const readinessSchema = z.object({
  ready: z.boolean(),
  checks: z.record(z.boolean()).optional(),
}).passthrough()

export const PullSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
}).strict()

export const syncMutationSchema = z.object({
  clientMutationId: z.string().min(8).max(64),
  kind: z.enum(['trip.create', 'fuel.create', 'expense.create', 'session.start', 'session.end']),
  payload: z.record(z.unknown()),
}).strict()

export const PushSchema = z.object({
  mutations: z.array(syncMutationSchema).min(1).max(50),
}).strict()

export const syncPullResponseSchema = z.object({
  cursor: z.string(),
  entities: z.record(z.unknown()),
}).passthrough()

export const syncMutationResultSchema = z.object({
  clientMutationId: z.string(),
  status: z.enum(['APPLIED', 'VALIDATION_ERROR', 'CONFLICT', 'INTERNAL_ERROR']),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).passthrough().optional(),
}).passthrough()

export const syncPushResponseSchema = z.object({
  results: z.array(syncMutationResultSchema),
}).passthrough()

const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const

registerOperation({
  operationId: 'platform.health.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/health',
  realm: 'system',
  lifecycle: 'active',
  request: {},
  successData: 'healthSchema',
  failureCodes: [],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'platform.ready.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/ready',
  realm: 'system',
  lifecycle: 'active',
  request: {},
  successData: 'readinessSchema',
  failureCodes: [],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'platform.sync.pull',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/sync/pull',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'PullSchema' },
  successData: 'syncPullResponseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'platform.sync.push',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/sync/push',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'PushSchema' },
  successData: 'syncPushResponseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

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

export * from './sync-pull'

export * from './sync-push'

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
  failureCodes: ['VALIDATION_ERROR', 'INVALID_CURSOR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'incompatible',
  owner: 'platform',
  pagination: { mode: 'cursor', defaultSize: 25, maximumSize: 100, stableSort: ['family', 'id ASC'], filterBinding: true, emptyPageBehavior: 'Continue until nextCursor is null, including empty families', exceptionOwner: null, exceptionReason: null },
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
  compatibility: 'incompatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import { EmptySuccessDataSchema } from '../core/envelope'

export const healthSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  uptime: z.number().min(0),
  version: z.string(),
}).passthrough()

export const readinessSchema = z.object({
  ready: z.boolean(),
  checks: z.record(z.boolean()).optional(),
}).passthrough()

export const syncPullSchema = z.object({
  lastSyncAt: z.string(),
  resources: z.array(z.string()),
}).strict()

export const syncPushSchema = z.object({
  resources: z.array(z.record(z.unknown())),
  lastSyncAt: z.string(),
}).strict()

export const syncPushResponseSchema = z.object({
  resources: z.array(z.record(z.unknown())),
  lastSyncAt: z.string(),
}).passthrough()

export const deviceTokenSchema = z.object({
  token: z.string().min(1).max(512),
  platform: z.enum(['android', 'ios']),
}).strict()

export const maintenanceCatalogSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  estimatedCostPiastres: z.number().int().min(0).optional(),
  recommendedIntervalMeters: z.number().int().min(0).optional(),
}).passthrough()

registerOperation({
  operationId: 'platform.health.liveness',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/health/liveness',
  realm: 'system',
  lifecycle: 'active',
  request: {},
  successData: 'healthSchema',
  failureCodes: [],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'platform.health.readiness',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/health/readiness',
  realm: 'system',
  lifecycle: 'active',
  request: {},
  successData: 'readinessSchema',
  failureCodes: [],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
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
  request: { body: 'syncPullSchema' },
  successData: 'syncPushResponseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
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
  request: { body: 'syncPushSchema' },
  successData: 'healthSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'platform.device-token.register',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/devices/tokens',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'deviceTokenSchema' },
  successData: 'EmptySuccessDataSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'platform.maintenance.catalog',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/maintenance/catalog',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'maintenanceCatalogSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

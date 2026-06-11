import { z } from 'zod'
import { registerOperation } from '../catalog/registry'

export const moderationActionSchema = z.object({
  id: z.string(),
  moderatorId: z.string(),
  targetType: z.enum(['driver', 'post', 'review']),
  targetId: z.string(),
  action: z.string(),
  reason: z.string(),
  createdAt: z.string(),
}).passthrough()

export const moderationActionRequestSchema = z.object({
  action: z.string(),
  reason: z.string(),
}).strict()

export const auditRecordSchema = z.object({
  id: z.string(),
  adminId: z.string(),
  action: z.string(),
  targetId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  timestamp: z.string(),
}).passthrough()

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  permissions: z.array(z.string()),
  description: z.string().optional(),
}).passthrough()

export const createRoleSchema = z.object({
  name: z.string().min(2).max(50),
  permissions: z.array(z.string()).min(1),
  description: z.string().optional(),
}).strict()

export const permissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  scope: z.string(),
}).passthrough()

export const adminSettingsSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  updatedBy: z.string().optional(),
  updatedAt: z.string(),
}).passthrough()

export const adminAnalyticsSchema = z.object({
  metric: z.string(),
  value: z.number(),
  periodStart: z.string(),
  periodEnd: z.string(),
}).passthrough()

export const healthCheckSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  uptime: z.number().min(0),
  version: z.string(),
  checks: z.record(z.object({
    status: z.enum(['ok', 'fail']),
    latency: z.number().optional(),
  })).optional(),
}).passthrough()

export const featureUsageSchema = z.object({
  feature: z.string(),
  usageCount: z.number().int().min(0),
  uniqueUsers: z.number().int().min(0),
  periodStart: z.string(),
  periodEnd: z.string(),
}).passthrough()

registerOperation({
  operationId: 'admin.audit.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/audit',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'auditRecordSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.roles.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/roles',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'roleSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.roles.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/admin/roles',
  realm: 'admin',
  lifecycle: 'active',
  request: { body: 'createRoleSchema' },
  successData: 'roleSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'CONFLICT'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.settings.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/settings',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'adminSettingsSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.analytics.overview',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/analytics',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'adminAnalyticsSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.support.tickets.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/support/tickets',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'moderationActionSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.notifications.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/notifications',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'healthCheckSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.community.moderation',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/admin/community/{id}/moderate',
  realm: 'admin',
  lifecycle: 'active',
  request: { body: 'moderationActionRequestSchema' },
  successData: 'moderationActionSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.health.check',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/health',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'healthCheckSchema',
  failureCodes: [],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.feature-usage.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/analytics/feature-usage',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'featureUsageSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

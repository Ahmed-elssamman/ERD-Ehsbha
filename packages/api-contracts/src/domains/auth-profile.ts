import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import { EmptySuccessDataSchema } from '../core/envelope'
export { EmptySuccessDataSchema }

export const driverLoginSchema = z.object({
  phone: z.string().min(10).max(20),
  password: z.string().min(6).max(128),
}).strict()

export const driverRefreshSchema = z.object({
  refreshToken: z.string().min(1).max(512),
}).strict()

export const passwordResetSchema = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().length(6),
  newPassword: z.string().min(8).max(128),
}).strict()

export const passwordResetRequestSchema = z.object({
  phone: z.string().min(10).max(20),
}).strict()

export const driverProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().email().optional(),
  locale: z.enum(['ar', 'en']),
  avatarUrl: z.string().url().optional(),
}).passthrough()

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
}).strict()

export const adminRefreshSchema = z.object({
  refreshToken: z.string().min(1).max(512),
}).strict()

export const adminAuthProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.string(),
  permissions: z.array(z.string()),
  lastLoginAt: z.string().optional(),
  isActive: z.boolean(),
}).passthrough()

registerOperation({
  operationId: 'driver.auth.login',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/auth/driver/login',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'driverLoginSchema' },
  successData: 'driverProfileSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'RATE_LIMITED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.auth.refresh',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/auth/driver/refresh',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'driverRefreshSchema' },
  successData: 'driverProfileSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'SESSION_EXPIRED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.auth.password-reset.request',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/auth/password-reset/request',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'passwordResetRequestSchema' },
  successData: 'EmptySuccessDataSchema',
  failureCodes: ['VALIDATION_ERROR', 'NOT_FOUND', 'RATE_LIMITED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.auth.password-reset.confirm',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/auth/password-reset/confirm',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'passwordResetSchema' },
  successData: 'driverProfileSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.profile.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/drivers/profile',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'driverProfileSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.profile.update',
  transport: 'http',
  method: 'PATCH',
  path: '/api/v1/drivers/profile',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'driverRefreshSchema' },
  successData: 'driverProfileSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.auth.login',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/admin/auth/login',
  realm: 'admin',
  lifecycle: 'active',
  request: { body: 'adminLoginSchema' },
  successData: 'adminAuthProfileSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'ADMIN_MFA_REQUIRED', 'RATE_LIMITED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.auth.refresh',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/admin/auth/refresh',
  realm: 'admin',
  lifecycle: 'active',
  request: { body: 'adminRefreshSchema' },
  successData: 'adminAuthProfileSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'SESSION_EXPIRED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

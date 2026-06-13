import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import { EmptySuccessDataSchema } from '../core/envelope'
export { EmptySuccessDataSchema }

const phoneRegex = /^\+?\d{8,15}$/

export const driverLoginSchema = z.object({
  phone: z.string().min(10).max(20),
  password: z.string().min(6).max(128),
}).strict()

export const LoginSchema = driverLoginSchema.extend({
  deviceId: z.string().max(128).optional(),
})

export const driverRefreshSchema = z.object({
  refreshToken: z.string().min(1).max(512),
}).strict()

export const RegisterSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(80),
  locale: z.enum(['ar', 'en']).default('ar'),
  timezone: z.string().default('Africa/Cairo'),
}).strict()

export const LogoutSchema = z.object({
  refreshToken: z.string().min(20),
}).strict()

export const passwordResetSchema = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().length(6),
  newPassword: z.string().min(8).max(128),
}).strict()

export const ForgotPasswordSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
}).strict()

export const LookupEmailSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
}).strict()

export const driverProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().email().optional(),
  locale: z.enum(['ar', 'en']),
  avatarUrl: z.string().url().optional(),
}).passthrough()

export const driverAuthUserSchema = z.object({
  id: z.string(),
  phone: z.string(),
  email: z.string().email().nullable().optional(),
  locale: z.enum(['ar', 'en']),
  timezone: z.string(),
  driverId: z.string().nullable(),
  displayName: z.string().nullable().optional(),
}).passthrough()

export const driverAuthResultSchema = z.object({
  user: driverAuthUserSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
}).passthrough()

export const lookupEmailResultSchema = z.object({
  phone: z.string(),
  emailMasked: z.string(),
}).passthrough()

export const forgotPasswordResultSchema = z.object({
  sent: z.boolean(),
  channel: z.enum(['email', 'sms', 'none']),
  emailMasked: z.string(),
  expiresInMinutes: z.number().int().positive(),
  devCode: z.string().optional(),
}).passthrough()

export const authAcknowledgedResultSchema = z.object({
  ok: z.literal(true),
}).passthrough()

export const UpdateDriverSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  photoUrl: z.string().url().nullable().optional(),
  baseCity: z.string().max(80).nullable().optional(),
}).strict()

export const UpdateUserSchema = z.object({
  locale: z.enum(['ar', 'en']).optional(),
  timezone: z.string().optional(),
  email: z.string().email().optional(),
}).strict()

export const userProfileSchema = z.object({
  id: z.string(),
  phone: z.string(),
  email: z.string().email().nullable(),
  locale: z.enum(['ar', 'en']),
  timezone: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  driver: z.object({
    id: z.string(),
    displayName: z.string(),
    photoUrl: z.string().nullable().optional(),
    baseCity: z.string().nullable().optional(),
  }).passthrough().nullable().optional(),
}).passthrough()

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
}).strict()

export const adminRefreshSchema = z.object({
  refreshToken: z.string().min(10).max(512),
}).strict()

export const adminMfaVerifySchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
}).strict()

export const adminPrincipalSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
}).passthrough()

export const adminAuthSessionSchema = z.object({
  mfaRequired: z.literal(false),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  admin: adminPrincipalSchema,
}).passthrough()

export const adminMfaChallengeSchema = z.object({
  mfaRequired: z.literal(true),
  challengeId: z.string().min(1),
}).passthrough()

export const adminLoginResponseSchema = z.discriminatedUnion('mfaRequired', [
  adminAuthSessionSchema,
  adminMfaChallengeSchema,
])

const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const

registerOperation({
  operationId: 'driver.auth.register',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/auth/register',
  realm: 'public',
  lifecycle: 'active',
  request: { body: 'RegisterSchema' },
  successData: 'driverAuthResultSchema',
  failureCodes: ['VALIDATION_ERROR', 'CONFLICT', 'RATE_LIMITED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.auth.login',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/auth/login',
  realm: 'public',
  lifecycle: 'active',
  request: { body: 'LoginSchema' },
  successData: 'driverAuthResultSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'RATE_LIMITED'],
  consumers: [...producer],
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
  path: '/api/v1/auth/refresh',
  realm: 'public',
  lifecycle: 'active',
  request: { body: 'driverRefreshSchema' },
  successData: 'driverAuthResultSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'SESSION_EXPIRED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.auth.logout',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/auth/logout',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'LogoutSchema' },
  successData: 'EmptySuccessDataSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.auth.password.lookup',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/auth/password/lookup',
  realm: 'public',
  lifecycle: 'active',
  request: { body: 'LookupEmailSchema' },
  successData: 'lookupEmailResultSchema',
  failureCodes: ['VALIDATION_ERROR', 'NOT_FOUND', 'RATE_LIMITED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.auth.password.forgot',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/auth/password/forgot',
  realm: 'public',
  lifecycle: 'active',
  request: { body: 'ForgotPasswordSchema' },
  successData: 'forgotPasswordResultSchema',
  failureCodes: ['VALIDATION_ERROR', 'NOT_FOUND', 'RATE_LIMITED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.auth.password.reset',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/auth/password/reset',
  realm: 'public',
  lifecycle: 'active',
  request: { body: 'passwordResetSchema' },
  successData: 'authAcknowledgedResultSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'RATE_LIMITED'],
  consumers: [...producer],
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
  path: '/api/v1/drivers/me',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'driverProfileSchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
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
  path: '/api/v1/drivers/me',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'UpdateDriverSchema' },
  successData: 'driverProfileSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.user.me',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/me',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'userProfileSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.user.update',
  transport: 'http',
  method: 'PATCH',
  path: '/api/v1/me',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'UpdateUserSchema' },
  successData: 'userProfileSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
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
  successData: 'adminLoginResponseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'RATE_LIMITED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.auth.mfa.verify',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/admin/auth/mfa/verify',
  realm: 'admin',
  lifecycle: 'active',
  request: { body: 'adminMfaVerifySchema' },
  successData: 'adminAuthSessionSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'RATE_LIMITED'],
  consumers: [...producer],
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
  successData: 'adminAuthSessionSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'SESSION_EXPIRED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.auth.logout',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/admin/auth/logout',
  realm: 'admin',
  lifecycle: 'active',
  request: { body: 'adminRefreshSchema' },
  successData: 'authAcknowledgedResultSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.auth.me',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/admin/auth/me',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'adminPrincipalSchema',
  failureCodes: ['UNAUTHENTICATED', 'FORBIDDEN', 'ADMIN_PERMISSIONS_STALE'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

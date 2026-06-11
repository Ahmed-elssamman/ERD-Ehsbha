import { z } from 'zod'

export const FieldIssueSchema = z.object({
  path: z.string(),
  code: z.string(),
  message: z.string(),
  messageKey: z.string().nullable().optional(),
})

export type FieldIssue = z.infer<typeof FieldIssueSchema>

export const FailureEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    messageKey: z.string().nullable().optional(),
    details: z.array(FieldIssueSchema).nullable().optional(),
  }),
  meta: z.object({
    requestId: z.string().min(16).max(128),
    serverTime: z.string(),
    apiVersion: z.literal('v1'),
    contractVersion: z.string(),
  }),
})

export type FailureEnvelope = z.infer<typeof FailureEnvelopeSchema>

export const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not-found',
  CONFLICT: 'conflict',
  THROTTLING: 'throttling',
  TRANSIENT: 'transient',
  CONTRACT: 'contract',
  INTERNAL: 'internal',
} as const

export type ErrorCategory = (typeof ERROR_CATEGORIES)[keyof typeof ERROR_CATEGORIES]

export const RETRY_POLICIES = {
  NEVER: 'never',
  SAFE_READ: 'safe-read',
  RETRY_AFTER: 'retry-after',
  IDEMPOTENT_WRITE: 'idempotent-write',
} as const

export type RetryPolicy = (typeof RETRY_POLICIES)[keyof typeof RETRY_POLICIES]

export interface ErrorCodeDefinition {
  code: string
  httpStatus: number
  category: ErrorCategory
  retryPolicy: RetryPolicy
  messageKey: string | null
  detailsSchema: string | null
  realms: string[]
}

export const GOVERNED_ERROR_REGISTRY: Record<string, ErrorCodeDefinition> = {
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'errors.validation', detailsSchema: 'FieldIssue', realms: ['driver', 'admin', 'public'] },
  INVALID_CURSOR: { code: 'INVALID_CURSOR', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'errors.invalidCursor', detailsSchema: null, realms: ['driver', 'admin'] },
  UNAUTHENTICATED: { code: 'UNAUTHENTICATED', httpStatus: 401, category: 'authentication', retryPolicy: 'never', messageKey: 'errors.unauthenticated', detailsSchema: null, realms: ['driver', 'admin'] },
  SESSION_EXPIRED: { code: 'SESSION_EXPIRED', httpStatus: 401, category: 'authentication', retryPolicy: 'never', messageKey: 'errors.sessionExpired', detailsSchema: null, realms: ['driver', 'admin'] },
  FORBIDDEN: { code: 'FORBIDDEN', httpStatus: 403, category: 'authorization', retryPolicy: 'never', messageKey: 'errors.forbidden', detailsSchema: null, realms: ['driver', 'admin'] },
  ADMIN_MFA_REQUIRED: { code: 'ADMIN_MFA_REQUIRED', httpStatus: 403, category: 'authorization', retryPolicy: 'never', messageKey: 'errors.adminMfaRequired', detailsSchema: null, realms: ['admin'] },
  ADMIN_PERMISSIONS_STALE: { code: 'ADMIN_PERMISSIONS_STALE', httpStatus: 403, category: 'authorization', retryPolicy: 'never', messageKey: 'errors.adminPermissionsStale', detailsSchema: null, realms: ['admin'] },
  NOT_FOUND: { code: 'NOT_FOUND', httpStatus: 404, category: 'not-found', retryPolicy: 'never', messageKey: 'errors.notFound', detailsSchema: null, realms: ['driver', 'admin', 'public'] },
  CONFLICT: { code: 'CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.conflict', detailsSchema: null, realms: ['driver', 'admin'] },
  IDEMPOTENCY_KEY_REUSED: { code: 'IDEMPOTENCY_KEY_REUSED', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.idempotencyKeyReused', detailsSchema: null, realms: ['driver', 'admin'] },
  IDEMPOTENCY_IN_PROGRESS: { code: 'IDEMPOTENCY_IN_PROGRESS', httpStatus: 409, category: 'conflict', retryPolicy: 'retry-after', messageKey: 'errors.idempotencyInProgress', detailsSchema: null, realms: ['driver', 'admin'] },
  CONTRACT_VIOLATION: { code: 'CONTRACT_VIOLATION', httpStatus: 502, category: 'contract', retryPolicy: 'never', messageKey: 'errors.contractViolation', detailsSchema: null, realms: ['driver', 'admin', 'public'] },
  CONTRACT_VERSION_MISMATCH: { code: 'CONTRACT_VERSION_MISMATCH', httpStatus: 502, category: 'contract', retryPolicy: 'never', messageKey: 'errors.contractVersionMismatch', detailsSchema: null, realms: ['driver', 'admin', 'public'] },
  RATE_LIMITED: { code: 'RATE_LIMITED', httpStatus: 429, category: 'throttling', retryPolicy: 'retry-after', messageKey: 'errors.rateLimited', detailsSchema: null, realms: ['driver', 'admin', 'public'] },
  PROVIDER_UNAVAILABLE: { code: 'PROVIDER_UNAVAILABLE', httpStatus: 503, category: 'transient', retryPolicy: 'safe-read', messageKey: 'errors.providerUnavailable', detailsSchema: null, realms: ['driver', 'admin'] },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', httpStatus: 503, category: 'transient', retryPolicy: 'safe-read', messageKey: 'errors.serviceUnavailable', detailsSchema: null, realms: ['driver', 'admin', 'public'] },
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', httpStatus: 500, category: 'internal', retryPolicy: 'never', messageKey: 'errors.internalError', detailsSchema: null, realms: ['driver', 'admin', 'public'] },
}

export function getErrorDefinition(code: string): ErrorCodeDefinition | undefined {
  return GOVERNED_ERROR_REGISTRY[code]
}

export function normalizeErrorCode(code: string): string {
  if (GOVERNED_ERROR_REGISTRY[code]) return code
  return 'CONTRACT_VIOLATION'
}

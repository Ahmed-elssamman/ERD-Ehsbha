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
    serverTime: z.string().datetime({ offset: true }),
    apiVersion: z.literal('v1'),
    contractVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  }).passthrough(),
}).passthrough()

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
  NOTIFICATION_PREFERENCES_CONFLICT: { code: 'NOTIFICATION_PREFERENCES_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.NOTIFICATION_PREFERENCES_CONFLICT', detailsSchema: null, realms: ['driver'] },
  DIGEST_INSUFFICIENT_DATA: { code: 'DIGEST_INSUFFICIENT_DATA', httpStatus: 404, category: 'not-found', retryPolicy: 'never', messageKey: 'errors.DIGEST_INSUFFICIENT_DATA', detailsSchema: null, realms: ['driver'] },
  REPORT_PERIOD_NOT_COMPLETE: { code: 'REPORT_PERIOD_NOT_COMPLETE', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'errors.REPORT_PERIOD_NOT_COMPLETE', detailsSchema: null, realms: ['driver'] },
  REPORT_VERSION_CONFLICT: { code: 'REPORT_VERSION_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.REPORT_VERSION_CONFLICT', detailsSchema: null, realms: ['driver'] },
  REPORT_PREFERENCES_CONFLICT: { code: 'REPORT_PREFERENCES_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.REPORT_PREFERENCES_CONFLICT', detailsSchema: null, realms: ['driver'] },
  SESSION_VERSION_CONFLICT: { code: 'SESSION_VERSION_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.SESSION_VERSION_CONFLICT', detailsSchema: null, realms: ['driver'] },
  SESSION_STATE_CONFLICT: { code: 'SESSION_STATE_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.SESSION_STATE_CONFLICT', detailsSchema: null, realms: ['driver'] },
  SESSION_ALREADY_OPEN: { code: 'SESSION_ALREADY_OPEN', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.SESSION_ALREADY_OPEN', detailsSchema: null, realms: ['driver'] },
  SESSION_ALREADY_ENDED: { code: 'SESSION_ALREADY_ENDED', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.SESSION_ALREADY_ENDED', detailsSchema: null, realms: ['driver'] },
  TRIP_VERSION_CONFLICT: { code: 'TRIP_VERSION_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.TRIP_VERSION_CONFLICT', detailsSchema: null, realms: ['driver', 'admin'] },
  FUEL_LINK_CONFLICT: { code: 'FUEL_LINK_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.FUEL_LINK_CONFLICT', detailsSchema: null, realms: ['driver'] },
  FUEL_VERSION_CONFLICT: { code: 'FUEL_VERSION_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.FUEL_VERSION_CONFLICT', detailsSchema: null, realms: ['driver'] },
  VEHICLE_ODOMETER_CONFLICT: { code: 'VEHICLE_ODOMETER_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.VEHICLE_ODOMETER_CONFLICT', detailsSchema: null, realms: ['driver'] },
  MAINTENANCE_LINK_CONFLICT: { code: 'MAINTENANCE_LINK_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.MAINTENANCE_LINK_CONFLICT', detailsSchema: null, realms: ['driver'] },
  MAINTENANCE_VERSION_CONFLICT: { code: 'MAINTENANCE_VERSION_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.MAINTENANCE_VERSION_CONFLICT', detailsSchema: null, realms: ['driver'] },
  REPORTING_PROJECTION_PENDING: { code: 'REPORTING_PROJECTION_PENDING', httpStatus: 503, category: 'transient', retryPolicy: 'safe-read', messageKey: 'errors.REPORTING_PROJECTION_PENDING', detailsSchema: null, realms: ['driver', 'admin'] },
  REPORTING_CALENDAR_PENDING: { code: 'REPORTING_CALENDAR_PENDING', httpStatus: 503, category: 'transient', retryPolicy: 'safe-read', messageKey: 'errors.REPORTING_CALENDAR_PENDING', detailsSchema: null, realms: ['driver', 'admin'] },
  EXPENSE_LINK_CONFLICT: { code: 'EXPENSE_LINK_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.EXPENSE_LINK_CONFLICT', detailsSchema: null, realms: ['driver', 'admin'] },
  EXPENSE_VERSION_CONFLICT: { code: 'EXPENSE_VERSION_CONFLICT', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.EXPENSE_VERSION_CONFLICT', detailsSchema: null, realms: ['driver'] },
  OCR_CANDIDATE_NOT_FOUND: { code: 'OCR_CANDIDATE_NOT_FOUND', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_CANDIDATE_NOT_FOUND', detailsSchema: null, realms: ['driver'] },
  OCR_REFERENCE_INACTIVE: { code: 'OCR_REFERENCE_INACTIVE', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_REFERENCE_INACTIVE', detailsSchema: null, realms: ['driver'] },
  OCR_FINANCIAL_CONFLICT: { code: 'OCR_FINANCIAL_CONFLICT', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_FINANCIAL_CONFLICT', detailsSchema: null, realms: ['driver'] },
  OCR_CONFIRMATION_RETRY: { code: 'OCR_CONFIRMATION_RETRY', httpStatus: 503, category: 'transient', retryPolicy: 'idempotent-write', messageKey: 'trips.ocr.error.OCR_CONFIRMATION_RETRY', detailsSchema: null, realms: ['driver'] },
  OCR_IMPORT_CLOSED: { code: 'OCR_IMPORT_CLOSED', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_IMPORT_CLOSED', detailsSchema: null, realms: ['driver'] },
  OCR_IMPORT_EXPIRED: { code: 'OCR_IMPORT_EXPIRED', httpStatus: 410, category: 'not-found', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_IMPORT_EXPIRED', detailsSchema: null, realms: ['driver'] },
  OCR_NO_IMAGES: { code: 'OCR_NO_IMAGES', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_NO_IMAGES', detailsSchema: null, realms: ['driver'] },
  OCR_TOO_MANY_IMAGES: { code: 'OCR_TOO_MANY_IMAGES', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_TOO_MANY_IMAGES', detailsSchema: null, realms: ['driver'] },
  OCR_BATCH_TOO_LARGE: { code: 'OCR_BATCH_TOO_LARGE', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_BATCH_TOO_LARGE', detailsSchema: null, realms: ['driver'] },
  OCR_TOO_MANY_TRIPS: { code: 'OCR_TOO_MANY_TRIPS', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_TOO_MANY_TRIPS', detailsSchema: null, realms: ['driver'] },
  OCR_INVALID_HINTS: { code: 'OCR_INVALID_HINTS', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_INVALID_HINTS', detailsSchema: null, realms: ['driver'] },
  OCR_UNSUPPORTED_MIME: { code: 'OCR_UNSUPPORTED_MIME', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_UNSUPPORTED_MIME', detailsSchema: null, realms: ['driver'] },
  OCR_IMAGE_TOO_LARGE: { code: 'OCR_IMAGE_TOO_LARGE', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_IMAGE_TOO_LARGE', detailsSchema: null, realms: ['driver'] },
  OCR_IMAGE_INVALID: { code: 'OCR_IMAGE_INVALID', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_IMAGE_INVALID', detailsSchema: null, realms: ['driver'] },
  OCR_NO_TEXT: { code: 'OCR_NO_TEXT', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_NO_TEXT', detailsSchema: null, realms: ['driver'] },
  OCR_BUSY: { code: 'OCR_BUSY', httpStatus: 503, category: 'transient', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_BUSY', detailsSchema: null, realms: ['driver'] },
  OCR_TIMEOUT: { code: 'OCR_TIMEOUT', httpStatus: 503, category: 'transient', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_TIMEOUT', detailsSchema: null, realms: ['driver'] },
  OCR_AUTH: { code: 'OCR_AUTH', httpStatus: 503, category: 'transient', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_AUTH', detailsSchema: null, realms: ['driver'] },
  OCR_FAILED: { code: 'OCR_FAILED', httpStatus: 503, category: 'transient', retryPolicy: 'never', messageKey: 'trips.ocr.error.OCR_FAILED', detailsSchema: null, realms: ['driver'] },
  INVALID_CREDENTIALS: { code: 'INVALID_CREDENTIALS', httpStatus: 401, category: 'authentication', retryPolicy: 'never', messageKey: 'errors.INVALID_CREDENTIALS', detailsSchema: null, realms: ['driver', 'public'] },
  PHONE_TAKEN: { code: 'PHONE_TAKEN', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.PHONE_TAKEN', detailsSchema: null, realms: ['driver', 'public'] },
  EMAIL_TAKEN: { code: 'EMAIL_TAKEN', httpStatus: 409, category: 'conflict', retryPolicy: 'never', messageKey: 'errors.EMAIL_TAKEN', detailsSchema: null, realms: ['driver', 'public'] },
  USER_NOT_FOUND: { code: 'USER_NOT_FOUND', httpStatus: 404, category: 'not-found', retryPolicy: 'never', messageKey: 'errors.USER_NOT_FOUND', detailsSchema: null, realms: ['driver', 'public'] },
  NO_EMAIL_ON_FILE: { code: 'NO_EMAIL_ON_FILE', httpStatus: 404, category: 'not-found', retryPolicy: 'never', messageKey: 'errors.NO_EMAIL_ON_FILE', detailsSchema: null, realms: ['driver', 'public'] },
  RESET_INVALID: { code: 'RESET_INVALID', httpStatus: 401, category: 'authentication', retryPolicy: 'never', messageKey: 'errors.RESET_INVALID', detailsSchema: null, realms: ['driver', 'public'] },
  RESET_EXPIRED: { code: 'RESET_EXPIRED', httpStatus: 401, category: 'authentication', retryPolicy: 'never', messageKey: 'errors.RESET_EXPIRED', detailsSchema: null, realms: ['driver', 'public'] },
  RESET_CODE_WRONG: { code: 'RESET_CODE_WRONG', httpStatus: 401, category: 'authentication', retryPolicy: 'never', messageKey: 'errors.RESET_CODE_WRONG', detailsSchema: null, realms: ['driver', 'public'] },
  RESET_LOCKED: { code: 'RESET_LOCKED', httpStatus: 401, category: 'authentication', retryPolicy: 'never', messageKey: 'errors.RESET_LOCKED', detailsSchema: null, realms: ['driver', 'public'] },
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'errors.validation', detailsSchema: 'FieldIssue', realms: ['driver', 'admin', 'public'] },
  DAILY_DISTANCE_CONFLICT: { code: 'DAILY_DISTANCE_CONFLICT', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'errors.DAILY_DISTANCE_CONFLICT', detailsSchema: null, realms: ['driver', 'admin'] },
  TRIP_FINANCIAL_EVIDENCE_INVALID: { code: 'TRIP_FINANCIAL_EVIDENCE_INVALID', httpStatus: 400, category: 'validation', retryPolicy: 'never', messageKey: 'errors.TRIP_FINANCIAL_EVIDENCE_INVALID', detailsSchema: null, realms: ['driver', 'admin'] },
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

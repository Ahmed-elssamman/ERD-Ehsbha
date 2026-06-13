import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import { EmptySuccessDataSchema } from '../core/envelope'
import { DEFAULT_PAGE_SIZE, MAXIMUM_PAGE_SIZE } from '../core/pagination'

export const tripItemSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  driverAppId: z.string(),
  areaId: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string(),
  grossPiastres: z.number().int(),
  receivedPiastres: z.number().int().nullable().optional(),
  tipPiastres: z.number().int(),
  commissionPiastres: z.number().int(),
  tollPiastres: z.number().int().optional(),
  parkingPiastres: z.number().int().optional(),
  totalKmMeters: z.number().int(),
  paidKmMeters: z.number().int(),
  emptyKmMeters: z.number().int(),
  notes: z.string().nullable(),
  clientMutationId: z.string().nullable().optional(),
  deletedAt: z.string().nullable().optional(),
}).passthrough()

export const tripSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  vehicleId: z.string().optional(),
  distanceMeters: z.number().int().min(0),
  amountPiastres: z.number().int().min(0),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  status: z.enum(['active', 'completed', 'cancelled']),
}).passthrough()

export const createTripSchema = z.object({
  vehicleId: z.string().optional(),
  distanceMeters: z.number().int().min(0),
  amountPiastres: z.number().int().min(0),
  startedAt: z.string(),
  endedAt: z.string().optional(),
}).strict()

export const CreateTripSchema = z.object({
  vehicleId: z.string().min(1),
  driverAppId: z.string().min(1),
  areaId: z.string().min(1).nullable().optional(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  grossPiastres: z.number().int().min(0),
  receivedPiastres: z.number().int().min(0).nullable().optional(),
  tipPiastres: z.number().int().min(0).default(0),
  commissionPiastres: z.number().int().min(0).default(0),
  tollPiastres: z.number().int().min(0).default(0),
  parkingPiastres: z.number().int().min(0).default(0),
  totalKmMeters: z.number().int().min(0),
  paidKmMeters: z.number().int().min(0),
  notes: z.string().max(500).nullable().optional(),
  clientMutationId: z.string().min(8).max(64).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.endedAt <= value.startedAt) {
    ctx.addIssue({ code: 'custom', path: ['endedAt'], message: 'endedAt must be after startedAt' })
  }
  if (value.paidKmMeters > value.totalKmMeters) {
    ctx.addIssue({ code: 'custom', path: ['paidKmMeters'], message: 'paidKm cannot exceed totalKm' })
  }
  if (value.receivedPiastres !== undefined && value.receivedPiastres !== null && value.receivedPiastres > value.grossPiastres) {
    ctx.addIssue({ code: 'custom', path: ['receivedPiastres'], message: 'received cannot exceed gross' })
  }
})

export const UpdateTripSchema = CreateTripSchema.innerType().partial()

export const BatchCreateTripsSchema = z.object({
  items: z.array(z.unknown()).min(1).max(20),
}).strict()

export const BatchDeleteTripsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
}).strict()

export const ListTripsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  appId: z.string().optional(),
  areaId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAXIMUM_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
}).strict()

export const tripsListResponseSchema = z.object({
  items: z.array(tripItemSchema),
  nextCursor: z.string().nullable(),
}).passthrough()

export const batchCreateTripsResponseSchema = z.object({
  created: z.array(tripItemSchema),
  errors: z.array(z.object({
    index: z.number().int(),
    code: z.string(),
    message: z.string(),
  }).passthrough()),
}).passthrough()

export const batchDeleteTripsResponseSchema = z.object({
  deleted: z.array(z.string()),
  errors: z.array(z.object({
    id: z.string(),
    code: z.string(),
    message: z.string(),
  }).passthrough()),
}).passthrough()

export const ocrPlatformSchema = z.enum(['UBER', 'INDRIVE', 'DIDI', 'CAREEM'])
export type OcrPlatform = z.infer<typeof ocrPlatformSchema>

export const ocrPaymentMethodSchema = z.enum(['cash', 'card', 'wallet', 'unknown'])
export type OcrPaymentMethod = z.infer<typeof ocrPaymentMethodSchema>

export const ocrParsedTripSchema = z.object({
  vehicleType: z.string().nullable(),
  appHint: z.string().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  durationSec: z.number().int().nullable(),
  grossEgp: z.number().nullable(),
  receivedEgp: z.number().nullable(),
  tipEgp: z.number().nullable(),
  commissionEgp: z.number().nullable(),
  tollEgp: z.number().nullable(),
  parkingEgp: z.number().nullable(),
  waitingFeeEgp: z.number().nullable(),
  totalKm: z.number().nullable(),
  paidKm: z.number().nullable(),
  pickup: z.string().nullable(),
  destination: z.string().nullable(),
  paymentMethod: ocrPaymentMethodSchema.default('unknown'),
  notes: z.string().nullable(),
}).strict()
export type OcrParsedTrip = z.infer<typeof ocrParsedTripSchema>

export const ocrExtractModeSchema = z.enum(['single', 'multi'])
export type OcrExtractMode = z.infer<typeof ocrExtractModeSchema>

export const ocrExtractRequestHintsSchema = z.object({
  mode: ocrExtractModeSchema.default('single'),
  platform: ocrPlatformSchema.nullable().default(null),
}).strict()
export type OcrExtractRequestHints = z.infer<typeof ocrExtractRequestHintsSchema>

export const ocrTripResultSchema = z.object({
  parsed: ocrParsedTripSchema,
  fieldConfidences: z.record(z.string(), z.number().min(0).max(1)),
}).strict()
export type OcrTripResult = z.infer<typeof ocrTripResultSchema>

export const ocrExtractResponseSchema = z.object({
  platform: ocrPlatformSchema.nullable(),
  platformConfidence: z.number().min(0).max(1),
  mode: ocrExtractModeSchema.default('single'),
  parsed: ocrParsedTripSchema,
  fieldConfidences: z.record(z.string(), z.number().min(0).max(1)),
  trips: z.array(ocrTripResultSchema),
  warnings: z.array(z.string()),
  imageHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
  rawTextLengths: z.array(z.number().int().nonnegative()),
  ocrMeanConfidence: z.number().min(0).max(1),
}).passthrough()
export type OcrExtractResponse = z.infer<typeof ocrExtractResponseSchema>

export const ocrRequestSchema = z.object({
  imageUrl: z.string().url(),
  options: z.object({
    detectLanguage: z.boolean().optional(),
    extractFields: z.array(z.string()).optional(),
  }).optional(),
}).strict()

export const ocrResultSchema = z.object({
  id: z.string().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  extractedText: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  fields: z.record(z.unknown()).optional(),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
  }).passthrough()).optional(),
}).passthrough()

const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const

registerOperation({
  operationId: 'driver.trips.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/trips',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'ListTripsSchema' },
  successData: 'tripsListResponseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: { mode: 'cursor', defaultSize: DEFAULT_PAGE_SIZE, maximumSize: MAXIMUM_PAGE_SIZE, stableSort: ['startedAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null },
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.trips.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/trips',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'CreateTripSchema' },
  successData: 'tripItemSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.trips.batch-create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/trips/batch',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'BatchCreateTripsSchema' },
  successData: 'batchCreateTripsResponseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.trips.batch-delete',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/trips/batch-delete',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'BatchDeleteTripsSchema' },
  successData: 'batchDeleteTripsResponseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.trips.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/trips/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'tripItemSchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.trips.update',
  transport: 'http',
  method: 'PATCH',
  path: '/api/v1/trips/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'UpdateTripSchema' },
  successData: 'tripItemSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.trips.delete',
  transport: 'http',
  method: 'DELETE',
  path: '/api/v1/trips/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'EmptySuccessDataSchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.ocr.extract',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/ocr/extract',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'ocrExtractResponseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'PROVIDER_UNAVAILABLE'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

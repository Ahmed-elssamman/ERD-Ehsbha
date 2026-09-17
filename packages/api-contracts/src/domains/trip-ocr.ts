import { tripRecordMetadataShape, tripVersionTargetsSchema, tripWriteIdempotency } from './trip-records';
export * from './trip-records';
import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import { DEFAULT_PAGE_SIZE, MAXIMUM_PAGE_SIZE } from '../core/pagination'
import { OcrCandidateStatus, ocrCandidateSourceSchema, ocrDocumentResultSchema, type OcrCandidateEvidence } from './ocr-capture'
import { ocrPlatformSchema } from './ocr-platform'
import { MAX_RECORDED_WORK_INTERVAL_MS, tripDetailsShape, tripRecordIntegerSchema } from './trip-details'
import { resolveTripFinancials, TripView } from '@ehsbha/shared-types'
export { ocrPlatformSchema, type OcrPlatform } from './ocr-platform'

export const tripItemSchema = z.object({
  ...tripRecordMetadataShape,
  ...tripDetailsShape,
  id: z.string(),
  vehicleId: z.string(),
  driverAppId: z.string(),
  areaId: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string(),
  grossPiastres: z.number().int().nullable(),
  earningsPiastres: z.number().int().nonnegative().nullable().optional(),
  receivedPiastres: z.number().int().nullable().optional(),
  tipPiastres: z.number().int(),
  commissionPiastres: z.number().int().nullable(),
  tollPiastres: z.number().int().optional(),
  parkingPiastres: z.number().int().optional(),
  totalKmMeters: z.number().int(),
  paidKmMeters: z.number().int(),
  emptyKmMeters: z.number().int(),
  notes: z.string().nullable(),
  clientMutationId: z.string().nullable().optional(),
  deletedAt: z.string().nullable(),
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
  ...tripDetailsShape,
  vehicleId: z.string().min(1),
  driverAppId: z.string().min(1),
  areaId: z.string().min(1).nullable().optional(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  grossPiastres: tripRecordIntegerSchema.nullable().default(null),
  earningsPiastres: z.number().int().min(0).max(4_294_967_294).nullable().optional(),
  receivedPiastres: tripRecordIntegerSchema.nullable().optional(),
  tipPiastres: tripRecordIntegerSchema.default(0),
  commissionPiastres: tripRecordIntegerSchema.nullable().default(null),
  tollPiastres: tripRecordIntegerSchema.default(0),
  parkingPiastres: tripRecordIntegerSchema.default(0),
  totalKmMeters: tripRecordIntegerSchema,
  paidKmMeters: tripRecordIntegerSchema,
  notes: z.string().max(500).nullable().optional(),
  clientMutationId: z.string().min(8).max(64).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.endedAt <= value.startedAt) {
    ctx.addIssue({ code: 'custom', path: ['endedAt'], message: 'endedAt must be after startedAt' })
  }
  if (value.endedAt.getTime() - value.startedAt.getTime() > MAX_RECORDED_WORK_INTERVAL_MS) {
    ctx.addIssue({ code: 'custom', path: ['endedAt'], message: 'A recorded trip cannot exceed seven days' })
  }
  if (value.paidKmMeters > value.totalKmMeters) {
    ctx.addIssue({ code: 'custom', path: ['paidKmMeters'], message: 'paidKm cannot exceed totalKm' })
  }
  const financials = resolveTripFinancials(value)
  if (!financials || [financials.grossPiastres, financials.commissionPiastres, financials.receivedPiastres].some((amount) => amount !== null && amount > 2_147_483_647)) {
    ctx.addIssue({ code: 'custom', path: ['earningsPiastres'], message: 'TRIP_FINANCIAL_EVIDENCE_INVALID' })
  }
  if (value.grossPiastres !== null && value.waitingFeePiastres != null && value.waitingFeePiastres > value.grossPiastres) {
    ctx.addIssue({ code: 'custom', path: ['waitingFeePiastres'], message: 'waiting fee breakdown cannot exceed gross' })
  }
})

export const UpdateTripSchema = CreateTripSchema.innerType().omit({ clientMutationId: true }).partial().extend({ expectedVersion: z.number().int().positive() }).strict()

export const BatchCreateTripsSchema = z.object({
  items: z.array(z.unknown()).min(1).max(20),
}).strict()

export const BatchDeleteTripsSchema = z.object({
  items: tripVersionTargetsSchema,
}).strict()

export const ListTripsSchema = z.object({
  view: z.nativeEnum(TripView).default(TripView.Active),
  vehicleId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  appId: z.string().optional(),
  areaId: z.string().optional(),
  cursor: z.string().min(1).max(2048).optional(),
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

export const ocrPaymentMethodSchema = z.enum(['cash', 'card', 'wallet', 'unknown'])
export type OcrPaymentMethod = z.infer<typeof ocrPaymentMethodSchema>

export const ocrParsedTripSchema = z.object({
  vehicleType: z.string().nullable(),
  appHint: z.string().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  durationSec: z.number().int().nullable(),
  grossEgp: z.number().nullable(),
  earningsEgp: z.number().nullable().optional(),
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

export const ocrExtractModeSchema = z.enum(['auto', 'single', 'multi'])
export type OcrExtractMode = z.infer<typeof ocrExtractModeSchema>

export const ocrExtractRequestHintsSchema = z.object({
  mode: ocrExtractModeSchema.default('auto'),
  platform: ocrPlatformSchema.nullable().default(null),
}).strict()
export type OcrExtractRequestHints = z.infer<typeof ocrExtractRequestHintsSchema>

export const ocrCandidateEvidenceSchema: z.ZodType<OcrCandidateEvidence> = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/), platform: ocrPlatformSchema.nullable(),
  platformConfidence: z.number().min(0).max(1), status: z.nativeEnum(OcrCandidateStatus),
  duplicateOf: z.string().nullable(), sources: z.array(ocrCandidateSourceSchema),
  warnings: z.array(z.string()), rawText: z.string().max(40000),
}).strict()

export const ocrTripResultSchema = z.object({
  parsed: ocrParsedTripSchema,
  fieldConfidences: z.record(z.string(), z.number().min(0).max(1)),
  evidence: ocrCandidateEvidenceSchema.optional(),
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
  documents: z.array(ocrDocumentResultSchema).optional(),
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
  compatibility: 'incompatible',
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
  compatibility: 'incompatible',
  owner: 'platform',
  pagination: null,
  idempotency: tripWriteIdempotency,
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
  compatibility: 'incompatible',
  owner: 'platform',
  pagination: null,
  idempotency: tripWriteIdempotency,
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
  compatibility: 'incompatible',
  owner: 'platform',
  pagination: null,
  idempotency: tripWriteIdempotency,
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
  compatibility: 'incompatible',
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
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'TRIP_VERSION_CONFLICT', 'EXPENSE_LINK_CONFLICT', 'DAILY_DISTANCE_CONFLICT', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'incompatible',
  owner: 'platform',
  pagination: null,
  idempotency: tripWriteIdempotency,
  followUp: null,
})

registerOperation({
  operationId: 'driver.trips.delete',
  transport: 'http',
  method: 'DELETE',
  path: '/api/v1/trips/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'TripVersionSchema' },
  successData: 'EmptySuccessDataSchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND', 'TRIP_VERSION_CONFLICT'],
  consumers: [...producer],
  compatibility: 'incompatible',
  owner: 'platform',
  pagination: null,
  idempotency: tripWriteIdempotency,
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
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE', 'OCR_NO_IMAGES', 'OCR_TOO_MANY_IMAGES', 'OCR_BATCH_TOO_LARGE', 'OCR_TOO_MANY_TRIPS', 'OCR_INVALID_HINTS'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

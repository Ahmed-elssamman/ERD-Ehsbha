import { z } from 'zod'
import { registerOperation } from '../catalog/registry'

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

export const batchTripSchema = z.object({
  trips: z.array(createTripSchema).min(1).max(100),
}).strict()

export const updateTripSchema = z.object({
  vehicleId: z.string().optional(),
  distanceMeters: z.number().int().min(0).optional(),
  amountPiastres: z.number().int().min(0).optional(),
  endedAt: z.string().optional(),
  status: z.enum(['completed', 'cancelled']).optional(),
}).strict()

export const ocrRequestSchema = z.object({
  imageUrl: z.string().url(),
  options: z.object({
    detectLanguage: z.boolean().optional(),
    extractFields: z.array(z.string()).optional(),
  }).optional(),
}).strict()

export const ocrResultSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  extractedText: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  fields: z.record(z.unknown()).optional(),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
  })).optional(),
}).passthrough()

registerOperation({
  operationId: 'driver.trips.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/trips',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'createTripSchema' },
  successData: 'tripSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.trips.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/trips',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'tripSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
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
  path: '/api/v1/trips/{id}',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'tripSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
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
  path: '/api/v1/trips/{id}',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'updateTripSchema' },
  successData: 'tripSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'CONFLICT'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.trips.batch',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/trips/batch',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'batchTripSchema' },
  successData: 'tripSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.ocr.submit',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/ocr/submit',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'ocrRequestSchema' },
  successData: 'ocrResultSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'PROVIDER_UNAVAILABLE'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.ocr.result',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/ocr/{id}',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'ocrResultSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

import { z } from 'zod'
import { registerOperation } from '../catalog/registry'

export const analyticsSummarySchema = z.object({
  totalTrips: z.number().int().min(0),
  totalDistanceMeters: z.number().int().min(0),
  totalAmountPiastres: z.number().int().min(0),
  totalExpensesPiastres: z.number().int().min(0).optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
}).passthrough()

export const forecastSchema = z.object({
  predictedAmountPiastres: z.number().int().min(0),
  predictedTrips: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  periodStart: z.string(),
  periodEnd: z.string(),
}).passthrough()

export const recommendationSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  expectedBenefit: z.string().optional(),
}).passthrough()

export const decisionSchema = z.object({
  id: z.string(),
  type: z.string(),
  recommendation: z.string(),
  applied: z.boolean(),
  appliedAt: z.string().optional(),
  impact: z.string().optional(),
}).passthrough()

export const scoreSchema = z.object({
  driverId: z.string(),
  overall: z.number().min(0).max(100),
  reliability: z.number().min(0).max(100).optional(),
  efficiency: z.number().min(0).max(100).optional(),
  updatedAt: z.string(),
}).passthrough()

export const progressSchema = z.object({
  targetAmountPiastres: z.number().int().min(0),
  currentAmountPiastres: z.number().int().min(0),
  targetTrips: z.number().int().min(0).optional(),
  currentTrips: z.number().int().min(0).optional(),
  percentage: z.number().min(0).max(100),
  periodStart: z.string(),
  periodEnd: z.string(),
}).passthrough()

registerOperation({
  operationId: 'driver.analytics.summary',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/analytics/summary',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'analyticsSummarySchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.analytics.forecast',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/analytics/forecast',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'forecastSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.recommendations.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/recommendations',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'recommendationSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.score.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/score',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'scoreSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.analytics.progress',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/analytics/progress',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'progressSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

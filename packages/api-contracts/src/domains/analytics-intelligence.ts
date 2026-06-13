import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import { EmptySuccessDataSchema } from '../core/envelope'

export const DateSchema = z.object({
  date: z.coerce.date().optional(),
}).strict()

export const WeekSchema = z.object({
  isoYear: z.coerce.number().int(),
  isoWeek: z.coerce.number().int().min(1).max(53),
}).strict()

export const MonthSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
}).strict()

export const WindowSchema = z.object({
  window: z.string().regex(/^\d+d$/).default('7d'),
}).strict()

export const HistorySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict()

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
  description: z.string().optional(),
  body: z.string().optional(),
  expectedBenefit: z.string().optional(),
  surface: z.string().optional(),
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

export const dailyAnalyticsSchema = z.object({
  date: z.union([z.string(), z.date()]),
  tripCount: z.number().int(),
  totalKmMeters: z.number().int(),
  totalKmMetersOrLegacy: z.number().int().optional(),
  paidKmMeters: z.number().int(),
  emptyKmMeters: z.number().int(),
  onlineMinutes: z.number().int(),
  grossPiastres: z.number().int(),
  fuelPiastres: z.number().int(),
  expensePiastres: z.number().int(),
  netProfitPiastres: z.number().int(),
  profitPerKmPiastres: z.number(),
  profitPerHourPiastres: z.number(),
  emptyRatioBp: z.number().int(),
}).passthrough()

export const weeklyAnalyticsSchema = z.object({
  isoYear: z.number().int(),
  isoWeek: z.number().int(),
  tripCount: z.number().int(),
  totalKmMeters: z.number().int().optional(),
  paidKmMeters: z.number().int().optional(),
  emptyKmMeters: z.number().int().optional(),
  onlineMinutes: z.number().int().optional(),
  grossPiastres: z.number().int().optional(),
  netProfitPiastres: z.number().int(),
  fuelPiastres: z.number().int().optional(),
  expensePiastres: z.number().int().optional(),
  profitPerKmPiastres: z.number().optional(),
  profitPerHourPiastres: z.number().optional(),
  emptyRatioBp: z.number().int().optional(),
}).passthrough()

export const monthlyAnalyticsSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  tripCount: z.number().int(),
  totalKmMeters: z.number().int().optional(),
  paidKmMeters: z.number().int().optional(),
  emptyKmMeters: z.number().int().optional(),
  onlineMinutes: z.number().int().optional(),
  grossPiastres: z.number().int().optional(),
  netProfitPiastres: z.number().int(),
  fuelPiastres: z.number().int().optional(),
  expensePiastres: z.number().int().optional(),
  profitPerKmPiastres: z.number().optional(),
  profitPerHourPiastres: z.number().optional(),
  emptyRatioBp: z.number().int().optional(),
}).passthrough()

export const appPerformanceSchema = z.object({
  driverAppId: z.string(),
  appName: z.string(),
  color: z.string().nullable(),
  tripCount: z.number().int(),
  netProfitPiastres: z.number().int(),
  grossPiastres: z.number().int(),
  totalKmMeters: z.number().int(),
  onlineMinutes: z.number().int(),
  profitPerKmPiastres: z.number(),
  profitPerHourPiastres: z.number(),
}).passthrough()

export const areaPerformanceSchema = z.object({
  areaId: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  tripCount: z.number().int(),
  netProfitPiastres: z.number().int(),
  grossPiastres: z.number().int(),
  totalKmMeters: z.number().int(),
  profitPerKmPiastres: z.number(),
}).passthrough()

export const hourBucketSchema = z.object({
  bucket: z.enum(['morning', 'afternoon', 'evening', 'night']),
  tripCount: z.number().int(),
  netProfitPiastres: z.number().int(),
  totalKmMeters: z.number().int(),
  profitPerKmPiastres: z.number(),
}).passthrough()

export const monthlyForecastSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  currentNetPiastres: z.number().int(),
  forecastNetPiastres: z.number().int(),
  confidenceBandPiastres: z.number().int(),
  elapsedDays: z.number().int(),
  totalDays: z.number().int(),
}).passthrough()

export const decisionCardSchema = z.object({
  id: z.string(),
  surface: z.string(),
  type: z.string(),
  tone: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
  actionLabel: z.string().optional(),
  actionRoute: z.string().optional(),
  priority: z.number().optional(),
}).passthrough()

export const driverScoreSchema = z.object({
  date: z.string(),
  overall: z.number(),
  efficiency: z.number(),
  profit: z.number(),
  safety: z.number(),
  consistency: z.number(),
}).passthrough()

const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const

registerOperation({
  operationId: 'driver.analytics.today',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/analytics/today',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'dailyAnalyticsSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.analytics.daily',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/analytics/daily',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'DateSchema' },
  successData: 'dailyAnalyticsSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.analytics.weekly',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/analytics/weekly',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'WeekSchema' },
  successData: 'weeklyAnalyticsSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.analytics.monthly',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/analytics/monthly',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'MonthSchema' },
  successData: 'monthlyAnalyticsSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.analytics.apps',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/analytics/apps',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'WindowSchema' },
  successData: 'appPerformanceSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.analytics.areas',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/analytics/areas',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'WindowSchema' },
  successData: 'areaPerformanceSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.analytics.hours',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/analytics/hours',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'WindowSchema' },
  successData: 'hourBucketSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.analytics.forecast.monthly',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/analytics/forecast/monthly',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'monthlyForecastSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
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
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.recommendations.dismiss',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/recommendations/:id/dismiss',
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
  operationId: 'driver.decisions.today',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/decisions/today',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'recommendationSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.score.today',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/score/today',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'driverScoreSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.score.history',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/score/history',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'HistorySchema' },
  successData: 'driverScoreSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

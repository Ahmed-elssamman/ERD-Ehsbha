import { z } from 'zod'
import { MaintenanceStatus } from '@ehsbha/shared-types'
import { registerOperation } from '../catalog/registry'

export * from './expense-records'
export * from './maintenance-records'
export * from './fuel-records'
import { maintenanceItemSchema } from './maintenance-records'

export const fuelEntrySchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  liters: z.number().positive(),
  amountPiastres: z.number().int(),
  station: z.string().optional(),
  filledAt: z.string(),
}).passthrough()

export const maintenanceSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  type: z.string(),
  description: z.string(),
  amountPiastres: z.number().int(),
  performedAt: z.string(),
  status: z.enum(['scheduled', 'in-progress', 'completed']),
}).passthrough()

export const maintenanceRiskSchema = z.object({
  item: maintenanceItemSchema,
  status: z.nativeEnum(MaintenanceStatus),
  risk: z.number().nullable(),
  kmSinceLastMeters: z.number().int().nullable(),
  daysSinceLast: z.number().int().nullable(),
  lastServiceAt: z.string().nullable(),
}).passthrough()

export const dailyOdometerSchema = z.object({
  driverId: z.string().optional(),
  date: z.string(),
  totalKmMeters: z.number().int(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough()

export const odometerEntrySchema = z.object({
  id: z.string().optional(),
  vehicleId: z.string().optional(),
  readingMeters: z.number().int().optional(),
  recordedAt: z.string().optional(),
  date: z.string().optional(),
  totalKmMeters: z.number().int().optional(),
}).passthrough()

export const DateQuery = z.object({
  date: z.coerce.date().optional(),
}).strict()

export const SetDailyOdometerSchema = z.object({
  date: z.coerce.date().optional(),
  totalKmMeters: z.number().int().min(0),
  notes: z.string().max(200).nullable().optional(),
}).strict()

export * from './work-sessions'

export const driverGoalSchema = z.object({
  id: z.string(),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  targetPiastres: z.number().int(),
  startsOn: z.string(),
  endsOn: z.string(),
  isActive: z.boolean(),
}).passthrough()

export const goalSchema = z.object({
  id: z.string(),
  driverId: z.string().optional(),
  targetAmountPiastres: z.number().int().min(0).optional(),
  targetTrips: z.number().int().min(0).optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  status: z.enum(['active', 'completed', 'missed']).optional(),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  targetPiastres: z.number().int().optional(),
  startsOn: z.string().optional(),
  endsOn: z.string().optional(),
  isActive: z.boolean().optional(),
}).passthrough()

export const CreateGoalSchema = z.object({
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  targetPiastres: z.number().int().min(1),
  startsOn: z.coerce.date(),
  endsOn: z.coerce.date(),
}).strict()

export const UpdateGoalSchema = CreateGoalSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const goalProgressSchema = z.object({
  goal: driverGoalSchema,
  currentNetPiastres: z.number().int(),
  forecastNetPiastres: z.number().int(),
  elapsedDays: z.number().int(),
  totalDays: z.number().int(),
  progressBp: z.number().int(),
  status: z.enum(['ON_TRACK', 'LAGGING', 'AT_RISK', 'ACHIEVED']),
}).passthrough()

const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const





registerOperation({
  operationId: 'driver.goals.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/goals',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'driverGoalSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.goals.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/goals',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'CreateGoalSchema' },
  successData: 'driverGoalSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.goals.update',
  transport: 'http',
  method: 'PATCH',
  path: '/api/v1/goals/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'UpdateGoalSchema' },
  successData: 'driverGoalSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.goals.delete',
  transport: 'http',
  method: 'DELETE',
  path: '/api/v1/goals/:id',
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
  operationId: 'driver.goals.progress',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/goals/:id/progress',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'goalProgressSchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'incompatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.maintenance.risk',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/vehicles/:vehicleId/maintenance/risk',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'maintenanceRiskSchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'incompatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.odometer.daily.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/odometer/daily',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'DateQuery' },
  successData: 'dailyOdometerSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.odometer.daily.set',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/odometer/daily',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'SetDailyOdometerSchema' },
  successData: 'dailyOdometerSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

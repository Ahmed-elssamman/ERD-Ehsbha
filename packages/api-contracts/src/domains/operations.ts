import { z } from 'zod'
import { registerOperation } from '../catalog/registry'

export const expenseSchema = z.object({
  id: z.string(),
  tripId: z.string().optional(),
  amountPiastres: z.number().int(),
  category: z.string(),
  description: z.string().optional(),
  incurredAt: z.string(),
}).passthrough()

export const createExpenseSchema = z.object({
  tripId: z.string().optional(),
  amountPiastres: z.number().int().min(0),
  category: z.string().min(1),
  description: z.string().optional(),
}).strict()

export const fuelEntrySchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  liters: z.number().positive(),
  amountPiastres: z.number().int(),
  station: z.string().optional(),
  filledAt: z.string(),
}).passthrough()

export const createFuelEntrySchema = z.object({
  vehicleId: z.string().min(1),
  liters: z.number().positive(),
  amountPiastres: z.number().int().min(0),
  station: z.string().optional(),
}).strict()

export const maintenanceSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  type: z.string(),
  description: z.string(),
  amountPiastres: z.number().int(),
  performedAt: z.string(),
  status: z.enum(['scheduled', 'in-progress', 'completed']),
}).passthrough()

export const createMaintenanceSchema = z.object({
  vehicleId: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
  amountPiastres: z.number().int().min(0),
}).strict()

export const odometerEntrySchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  readingMeters: z.number().int(),
  recordedAt: z.string(),
}).passthrough()

export const createOdometerEntrySchema = z.object({
  vehicleId: z.string().min(1),
  readingMeters: z.number().int().min(0),
}).strict()

export const sessionSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  totalDistanceMeters: z.number().int().optional(),
  totalAmountPiastres: z.number().int().optional(),
}).passthrough()

export const goalSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  targetAmountPiastres: z.number().int().min(0),
  targetTrips: z.number().int().min(0).optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
  status: z.enum(['active', 'completed', 'missed']),
}).passthrough()

export const createGoalSchema = z.object({
  targetAmountPiastres: z.number().int().min(0),
  targetTrips: z.number().int().min(0).optional(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
}).strict()

registerOperation({
  operationId: 'driver.expenses.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/expenses',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'createExpenseSchema' },
  successData: 'expenseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.expenses.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/expenses',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'expenseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.fuel.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/fuel',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'createFuelEntrySchema' },
  successData: 'fuelEntrySchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.fuel.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/fuel',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'fuelEntrySchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.maintenance.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/maintenance',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'createMaintenanceSchema' },
  successData: 'maintenanceSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.maintenance.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/maintenance',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'maintenanceSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.odometer.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/odometer',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'createOdometerEntrySchema' },
  successData: 'odometerEntrySchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.sessions.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/sessions',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'sessionSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
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
  request: { body: 'createGoalSchema' },
  successData: 'goalSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.goals.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/goals',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'goalSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

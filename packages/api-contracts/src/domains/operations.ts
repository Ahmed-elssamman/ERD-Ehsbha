import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import { EmptySuccessDataSchema } from '../core/envelope'

const ExpenseCategory = z.enum(['RENT', 'INSURANCE', 'FINE', 'TOLL', 'FOOD', 'PHONE', 'WASH', 'PARKING', 'OTHER'])

export const driverExpenseSchema = z.object({
  id: z.string(),
  vehicleId: z.string().nullable(),
  category: ExpenseCategory,
  amountPiastres: z.number().int(),
  dateTime: z.string(),
  isRecurring: z.boolean(),
  recurrenceRule: z.string().nullable(),
  notes: z.string().nullable(),
  clientMutationId: z.string().nullable().optional(),
}).passthrough()

export const expenseSchema = z.object({
  id: z.string(),
  tripId: z.string().optional(),
  amountPiastres: z.number().int(),
  category: z.string(),
  description: z.string().optional(),
  incurredAt: z.string(),
}).passthrough()

export const CreateExpenseSchema = z.object({
  vehicleId: z.string().min(1).nullable().optional(),
  category: ExpenseCategory,
  amountPiastres: z.number().int().min(1),
  dateTime: z.coerce.date(),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  clientMutationId: z.string().min(8).max(64).optional(),
}).strict()

export const UpdateExpenseSchema = CreateExpenseSchema.partial()

export const ListExpensesSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  category: ExpenseCategory.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const driverFuelEntrySchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  dateTime: z.string().optional(),
  liters: z.number(),
  pricePerLiterPiastres: z.number().int(),
  totalPiastres: z.number().int(),
  odometerMeters: z.number().int(),
  isFullTank: z.boolean(),
  notes: z.string().nullable().optional(),
  clientMutationId: z.string().nullable().optional(),
}).passthrough()

export const fuelEntrySchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  liters: z.number().positive(),
  amountPiastres: z.number().int(),
  station: z.string().optional(),
  filledAt: z.string(),
}).passthrough()

export const CreateFuelSchema = z.object({
  vehicleId: z.string().min(1),
  dateTime: z.coerce.date(),
  liters: z.number().positive().max(500),
  pricePerLiterPiastres: z.number().int().min(1).max(20000),
  totalPiastres: z.number().int().min(1),
  odometerMeters: z.number().int().min(0),
  isFullTank: z.boolean().default(false),
  notes: z.string().max(500).nullable().optional(),
  clientMutationId: z.string().min(8).max(64).optional(),
}).strict()

export const UpdateFuelSchema = CreateFuelSchema.partial()

export const ListFuelSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const maintenanceItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  defaultIntervalKm: z.number().nullable(),
  defaultIntervalDays: z.number().int().nullable(),
  appliesToCar: z.boolean(),
  appliesToBike: z.boolean(),
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

export const maintenanceRecordSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  maintenanceItemId: z.string(),
  performedAt: z.string(),
  odometerMeters: z.number().int(),
  costPiastres: z.number().int(),
  notes: z.string().nullable(),
  maintenanceItem: maintenanceItemSchema.optional(),
}).passthrough()

export const CreateMaintenanceRecordSchema = z.object({
  maintenanceItemId: z.string().min(1),
  performedAt: z.coerce.date(),
  odometerMeters: z.number().int().min(0),
  costPiastres: z.number().int().min(0),
  notes: z.string().max(500).nullable().optional(),
}).strict()

export const maintenanceRiskSchema = z.object({
  item: maintenanceItemSchema,
  status: z.enum(['GREEN', 'AMBER', 'RED', 'OVERDUE']),
  risk: z.number(),
  kmSinceLastMeters: z.number().int(),
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

export const sessionSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  driverAppId: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string().nullable().optional(),
  activeMinutes: z.number().int().optional(),
  clientMutationId: z.string().nullable().optional(),
}).passthrough()

export const StartSessionSchema = z.object({
  driverAppId: z.string().min(1),
  startedAt: z.coerce.date().optional(),
  clientMutationId: z.string().min(8).max(64).optional(),
}).strict()

export const EndSessionSchema = z.object({
  endedAt: z.coerce.date().optional(),
}).strict()

export const ListSessionsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict()

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
  operationId: 'driver.expenses.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/expenses',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'ListExpensesSchema' },
  successData: 'driverExpenseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.expenses.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/expenses',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'CreateExpenseSchema' },
  successData: 'driverExpenseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.expenses.update',
  transport: 'http',
  method: 'PATCH',
  path: '/api/v1/expenses/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'UpdateExpenseSchema' },
  successData: 'driverExpenseSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.expenses.delete',
  transport: 'http',
  method: 'DELETE',
  path: '/api/v1/expenses/:id',
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
  operationId: 'driver.fuel.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/fuel',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'ListFuelSchema' },
  successData: 'driverFuelEntrySchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
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
  request: { body: 'CreateFuelSchema' },
  successData: 'driverFuelEntrySchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.fuel.update',
  transport: 'http',
  method: 'PATCH',
  path: '/api/v1/fuel/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'UpdateFuelSchema' },
  successData: 'driverFuelEntrySchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.fuel.delete',
  transport: 'http',
  method: 'DELETE',
  path: '/api/v1/fuel/:id',
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
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.maintenance.items',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/maintenance/items',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'maintenanceItemSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.maintenance.records.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/vehicles/:vehicleId/maintenance/records',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'maintenanceRecordSchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.maintenance.records.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/vehicles/:vehicleId/maintenance/records',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'CreateMaintenanceRecordSchema' },
  successData: 'maintenanceRecordSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
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
  compatibility: 'additive-compatible',
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

registerOperation({
  operationId: 'driver.sessions.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/sessions',
  realm: 'driver',
  lifecycle: 'active',
  request: { query: 'ListSessionsSchema' },
  successData: 'sessionSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.sessions.open',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/sessions/open',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'sessionSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.sessions.start',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/sessions/start',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'StartSessionSchema' },
  successData: 'sessionSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.sessions.end',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/sessions/:id/end',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'EndSessionSchema' },
  successData: 'sessionSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

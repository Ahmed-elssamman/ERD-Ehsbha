import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import { EmptySuccessDataSchema } from '../core/envelope'

const VehicleTypeEnum = z.enum(['CAR', 'BIKE'])
const FuelTypeEnum = z.enum(['PETROL_80', 'PETROL_92', 'PETROL_95', 'DIESEL', 'CNG', 'ELECTRIC'])

export const driverAppSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  iconUrl: z.string().nullable().optional(),
  defaultCommissionPct: z.coerce.number(),
}).passthrough()

export const appSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().optional(),
  platform: z.enum(['android', 'ios']).optional(),
}).passthrough()

export const driverAppBindingSchema = z.object({
  id: z.string(),
  appSourceId: z.string().nullable(),
  customName: z.string().nullable(),
  commissionPct: z.coerce.number(),
  color: z.string().nullable(),
  enabled: z.boolean(),
  appSource: driverAppSourceSchema.nullable().optional(),
}).passthrough()

export const driverAppSchema = driverAppBindingSchema

export const CreateDriverAppSchema = z.object({
  appSourceId: z.string().min(1).optional(),
  customName: z.string().min(2).max(40).optional(),
  commissionPct: z.number().min(0).max(60).default(20),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  enabled: z.boolean().default(true),
}).strict().refine(
  (value) => Boolean(value.appSourceId || value.customName),
  { message: 'Either appSourceId or customName is required' },
)

export const UpdateDriverAppSchema = z.object({
  commissionPct: z.number().min(0).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  enabled: z.boolean().optional(),
  customName: z.string().min(2).max(40).nullable().optional(),
}).strict()

export const driverAreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
}).passthrough()

export const areaSchema = z.object({
  id: z.string(),
  nameEn: z.string(),
  nameAr: z.string(),
  centerLat: z.number().optional(),
  centerLng: z.number().optional(),
}).passthrough()

export const CreateAreaSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).strict()

export const UpdateAreaSchema = CreateAreaSchema.partial()

export const driverMeSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  photoUrl: z.string().nullable().optional(),
  baseCity: z.string().nullable().optional(),
  monthlyGoalPiastres: z.number().int().nullable().optional(),
}).passthrough()

export const driverVehicleSchema = z.object({
  id: z.string(),
  type: VehicleTypeEnum,
  make: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  fuelType: FuelTypeEnum,
  tankLiters: z.number(),
  baselineKmPerLiter: z.number(),
  odometerMeters: z.number().int(),
  isActive: z.boolean(),
  fuelTankCostPiastres: z.number().int().nullable().optional(),
  fuelTankKmRange: z.number().nullable().optional(),
  oilCostPiastres: z.number().int().nullable().optional(),
  oilIntervalKm: z.number().nullable().optional(),
  tireCostPiastres: z.number().int().nullable().optional(),
  tireIntervalKm: z.number().nullable().optional(),
  brakesCostPiastres: z.number().int().nullable().optional(),
  brakesIntervalKm: z.number().nullable().optional(),
  chainCostPiastres: z.number().int().nullable().optional(),
  chainIntervalKm: z.number().nullable().optional(),
  batteryCostPiastres: z.number().int().nullable().optional(),
  batteryIntervalMonths: z.number().nullable().optional(),
  monthlyMaintCostPiastres: z.number().int().nullable().optional(),
  monthlyAvgKm: z.number().nullable().optional(),
}).passthrough()

export const vehicleSchema = z.object({
  id: z.string(),
  plate: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
  color: z.string().optional(),
}).passthrough()

export const CreateVehicleSchema = z.object({
  type: VehicleTypeEnum,
  make: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  year: z.number().int().min(1980).max(2100).optional(),
  fuelType: FuelTypeEnum,
  tankLiters: z.number().int().min(1).max(500).default(45),
  baselineKmPerLiter: z.number().positive().max(100).default(12),
  odometerMeters: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
}).strict()

export const createVehicleSchema = z.object({
  plate: z.string().min(3).max(20),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1990).max(2030),
  color: z.string().optional(),
}).strict()

export const UpdateVehicleSchema = CreateVehicleSchema.partial()

export const UpdateVehicleCostsSchema = z.object({
  fuelTankCostPiastres: z.number().int().min(0).nullable().optional(),
  fuelTankKmRange: z.number().int().min(1).max(2000).nullable().optional(),
  oilCostPiastres: z.number().int().min(0).nullable().optional(),
  oilIntervalKm: z.number().int().min(1).max(50000).nullable().optional(),
  tireCostPiastres: z.number().int().min(0).nullable().optional(),
  tireIntervalKm: z.number().int().min(1).max(200000).nullable().optional(),
  brakesCostPiastres: z.number().int().min(0).nullable().optional(),
  brakesIntervalKm: z.number().int().min(1).max(200000).nullable().optional(),
  chainCostPiastres: z.number().int().min(0).nullable().optional(),
  chainIntervalKm: z.number().int().min(1).max(100000).nullable().optional(),
  batteryCostPiastres: z.number().int().min(0).nullable().optional(),
  batteryIntervalMonths: z.number().int().min(1).max(120).nullable().optional(),
  monthlyMaintCostPiastres: z.number().int().min(0).nullable().optional(),
  monthlyAvgKm: z.number().int().min(100).max(20000).nullable().optional(),
}).strict()

export const vehicleCostSummarySchema = z.object({
  totalPerKmPiastres: z.number(),
  monthlyAvgKm: z.number().optional(),
  completenessBp: z.number().int(),
  components: z.array(z.object({
    key: z.string(),
    perKmPiastres: z.number(),
    shareBp: z.number().int(),
    provided: z.boolean(),
  }).passthrough()),
}).passthrough()

const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const

registerOperation({
  operationId: 'driver.apps.catalog',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/apps',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'driverAppSourceSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.apps.mine.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/drivers/me/apps',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'driverAppBindingSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.apps.mine.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/drivers/me/apps',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'CreateDriverAppSchema' },
  successData: 'driverAppBindingSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.apps.mine.update',
  transport: 'http',
  method: 'PATCH',
  path: '/api/v1/drivers/me/apps/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'UpdateDriverAppSchema' },
  successData: 'driverAppBindingSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.apps.mine.delete',
  transport: 'http',
  method: 'DELETE',
  path: '/api/v1/drivers/me/apps/:id',
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
  operationId: 'driver.areas.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/areas',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'driverAreaSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.areas.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/areas',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'CreateAreaSchema' },
  successData: 'driverAreaSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.areas.update',
  transport: 'http',
  method: 'PATCH',
  path: '/api/v1/areas/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'UpdateAreaSchema' },
  successData: 'driverAreaSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.areas.delete',
  transport: 'http',
  method: 'DELETE',
  path: '/api/v1/areas/:id',
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
  operationId: 'driver.vehicles.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/vehicles',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'driverVehicleSchema',
  failureCodes: ['UNAUTHENTICATED'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.vehicles.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/vehicles',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'CreateVehicleSchema' },
  successData: 'driverVehicleSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.vehicles.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/vehicles/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'driverVehicleSchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.vehicles.update',
  transport: 'http',
  method: 'PATCH',
  path: '/api/v1/vehicles/:id',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'UpdateVehicleSchema' },
  successData: 'driverVehicleSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.vehicles.update-costs',
  transport: 'http',
  method: 'PATCH',
  path: '/api/v1/vehicles/:id/costs',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'UpdateVehicleCostsSchema' },
  successData: 'driverVehicleSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'CONFLICT'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.vehicles.cost-summary',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/vehicles/:id/cost-summary',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'vehicleCostSummarySchema',
  failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.vehicles.delete',
  transport: 'http',
  method: 'DELETE',
  path: '/api/v1/vehicles/:id',
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

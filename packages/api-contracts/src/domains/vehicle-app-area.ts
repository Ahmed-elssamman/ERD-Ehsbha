import { z } from 'zod'
import { registerOperation } from '../catalog/registry'

export const vehicleSchema = z.object({
  id: z.string(),
  plate: z.string(),
  model: z.string(),
  year: z.number().int().min(1990).max(2030),
  color: z.string().optional(),
}).passthrough()

export const createVehicleSchema = z.object({
  plate: z.string().min(3).max(20),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1990).max(2030),
  color: z.string().optional(),
}).strict()

export const updateVehicleSchema = z.object({
  plate: z.string().min(3).max(20).optional(),
  model: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1990).max(2030).optional(),
  color: z.string().optional(),
}).strict()

export const vehicleCostSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  month: z.string(),
  maintenancePiastres: z.number().int().min(0).optional(),
  fuelPiastres: z.number().int().min(0).optional(),
  totalPiastres: z.number().int().min(0),
}).passthrough()

export const appSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  platform: z.enum(['android', 'ios']),
}).passthrough()

export const driverAppSchema = z.object({
  appId: z.string(),
  installedVersion: z.string(),
  lastUsedAt: z.string().optional(),
}).passthrough()

export const areaSchema = z.object({
  id: z.string(),
  nameEn: z.string(),
  nameAr: z.string(),
  centerLat: z.number().optional(),
  centerLng: z.number().optional(),
}).passthrough()

registerOperation({
  operationId: 'driver.vehicles.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/vehicles',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'vehicleSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
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
  request: { body: 'createVehicleSchema' },
  successData: 'vehicleSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
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
  path: '/api/v1/vehicles/{id}',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'vehicleSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
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
  path: '/api/v1/vehicles/{id}',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'updateVehicleSchema' },
  successData: 'vehicleSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'CONFLICT'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.vehicles.costs',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/vehicles/{id}/costs',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'vehicleCostSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.apps.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/apps',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'driverAppSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
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
  successData: 'areaSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

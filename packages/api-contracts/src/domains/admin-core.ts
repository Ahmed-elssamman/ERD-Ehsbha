import { z } from 'zod'
import { registerOperation } from '../catalog/registry'

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.string(),
  permissions: z.array(z.string()),
  lastLoginAt: z.string().optional(),
  isActive: z.boolean(),
}).passthrough()

export const adminDriverSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  status: z.enum(['active', 'suspended', 'inactive']),
  totalTrips: z.number().int().min(0).optional(),
  totalAmountPiastres: z.number().int().min(0).optional(),
  lastTripAt: z.string().optional(),
  registeredAt: z.string(),
}).passthrough()

export const adminTripSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  driverName: z.string().optional(),
  distanceMeters: z.number().int(),
  amountPiastres: z.number().int(),
  status: z.string(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
}).passthrough()

export const adminVehicleSchema = z.object({
  id: z.string(),
  plate: z.string(),
  model: z.string(),
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  status: z.enum(['active', 'maintenance', 'inactive']).optional(),
}).passthrough()

export const dashboardSummarySchema = z.object({
  totalDrivers: z.number().int().min(0),
  activeDrivers: z.number().int().min(0),
  totalTrips: z.number().int().min(0),
  totalRevenuePiastres: z.number().int().min(0),
  pendingSupportTickets: z.number().int().min(0),
}).passthrough()

export const bulkResultSchema = z.object({
  successCount: z.number().int().min(0),
  failureCount: z.number().int().min(0),
  errors: z.array(z.object({
    index: z.number().int(),
    code: z.string(),
    message: z.string(),
  })).optional(),
}).passthrough()

registerOperation({
  operationId: 'admin.drivers.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/drivers',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'adminDriverSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'ADMIN_PERMISSIONS_STALE'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.drivers.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/drivers/{id}',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'adminDriverSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.users.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/users',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'adminUserSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.trips.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/trips',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'adminTripSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.vehicles.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/vehicles',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'adminVehicleSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.dashboard.summary',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/dashboard',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'dashboardSummarySchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

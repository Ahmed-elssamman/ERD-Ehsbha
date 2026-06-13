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
  plate: z.string().optional(),
  model: z.string().optional(),
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  status: z.enum(['active', 'maintenance', 'inactive']).optional(),
}).passthrough()

export const bulkResultSchema = z.object({
  successCount: z.number().int().min(0),
  failureCount: z.number().int().min(0),
  errors: z.array(z.object({
    index: z.number().int(),
    code: z.string(),
    message: z.string(),
  }).passthrough()).optional(),
}).passthrough()

export const cursorPageSchema = <T extends z.ZodTypeAny>(itemSchema: T) => z.object({
  items: z.array(itemSchema),
  nextCursor: z.string().nullable(),
}).passthrough()

export const affectedResultSchema = z.object({
  affected: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative().optional(),
}).passthrough()

export const okResultSchema = z.object({ ok: z.literal(true) }).passthrough()

export const adminUsersListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  search: z.string().optional(),
}).strict()

export const adminDriversListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  baseCity: z.string().optional(),
}).strict()

export const adminDriverTripsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict()

export const adminTripsListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  driverId: z.string().optional(),
  driverAppId: z.string().optional(),
  startedAfter: z.string().datetime().optional(),
  startedBefore: z.string().datetime().optional(),
  includeDeleted: z.coerce.boolean().optional(),
}).strict()

export const adminVehiclesListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  type: z.enum(['CAR', 'BIKE']).optional(),
  isActive: z.coerce.boolean().optional(),
  driverId: z.string().optional(),
}).strict()

export const adminDashboardQuerySchema = z.object({
  range: z.enum(['1d', '7d', '30d', '90d']).default('7d'),
}).strict()

export const adminUserListItemSchema = z.object({
  id: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  locale: z.string(),
  isBlacklisted: z.boolean(),
  driverId: z.string().nullable(),
  tripCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  lastActivityAt: z.string().nullable(),
}).strict()
export const adminUsersPageSchema = cursorPageSchema(adminUserListItemSchema)

export const adminUserDetailSchema = z.object({
  id: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  locale: z.string(),
  timezone: z.string(),
  createdAt: z.string(),
  driver: z.object({
    id: z.string(),
    displayName: z.string(),
    baseCity: z.string().nullable(),
    photoUrl: z.string().nullable(),
    vehicles: z.array(z.object({
      id: z.string(),
      type: z.string(),
      make: z.string().nullable(),
      model: z.string().nullable(),
      year: z.number().int().nullable(),
    }).passthrough()),
    driverApps: z.array(z.object({
      id: z.string(),
      commissionPct: z.union([z.string(), z.number()]).transform(String),
      enabled: z.boolean(),
      appSource: z.object({ code: z.string(), name: z.string() }).passthrough(),
    }).passthrough()),
    _count: z.object({
      trips: z.number().int().nonnegative(),
      fuelLogs: z.number().int().nonnegative(),
      expenses: z.number().int().nonnegative(),
      maintenanceRecords: z.number().int().nonnegative(),
    }).strict(),
  }).passthrough().nullable(),
  _count: z.object({
    supportTickets: z.number().int().nonnegative(),
    deviceTokens: z.number().int().nonnegative(),
  }).strict(),
}).passthrough()

export const adminUserStatusSchema = z.object({
  id: z.string(),
  phone: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
}).passthrough()

export const adminDriverListItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string(),
  phone: z.string(),
  baseCity: z.string().nullable(),
  userStatus: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  vehicleCount: z.number().int().nonnegative(),
  tripCount: z.number().int().nonnegative(),
  lastTripAt: z.string().nullable(),
  joinedAt: z.string(),
}).strict()
export const adminDriversPageSchema = cursorPageSchema(adminDriverListItemSchema)

const adminScoreSchema = z.object({
  date: z.string(),
  overall: z.number(),
  efficiency: z.number(),
  profit: z.number(),
  safety: z.number(),
  consistency: z.number(),
}).passthrough()

export const adminDriverDetailSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  baseCity: z.string().nullable(),
  createdAt: z.string(),
  user: z.object({
    phone: z.string(),
    email: z.string().nullable(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  }).passthrough(),
  vehicles: z.array(z.object({
    id: z.string(),
    type: z.string(),
    make: z.string().nullable(),
    model: z.string().nullable(),
    year: z.number().int().nullable(),
    isActive: z.boolean(),
    fuelType: z.string(),
    odometerMeters: z.union([z.string(), z.number()]),
  }).passthrough()),
  driverApps: z.array(z.object({
    id: z.string(),
    enabled: z.boolean(),
    commissionPct: z.union([z.string(), z.number()]).transform(String),
    customName: z.string().nullable(),
    appSource: z.object({ code: z.string(), name: z.string() }).passthrough(),
  }).passthrough()),
  areas: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()),
  _count: z.object({
    trips: z.number().int().nonnegative(),
    fuelLogs: z.number().int().nonnegative(),
    expenses: z.number().int().nonnegative(),
    maintenanceRecords: z.number().int().nonnegative(),
  }).strict(),
  latestScore: adminScoreSchema.nullable(),
  scoreHistory: z.array(adminScoreSchema),
  last30DaysAggregates: z.array(z.object({
    date: z.string(),
    tripCount: z.number().int(),
    grossPiastres: z.number(),
    netProfitPiastres: z.number(),
    totalKmMeters: z.number(),
  }).strict()),
  areaBreakdown: z.array(z.object({
    areaId: z.string(),
    areaName: z.string(),
    tripCount: z.number().int(),
    grossPiastres: z.number(),
    netProfitPiastres: z.number(),
  }).strict()),
  appBreakdown: z.array(z.object({
    driverAppId: z.string(),
    appName: z.string(),
    tripCount: z.number().int(),
    grossPiastres: z.number(),
    netProfitPiastres: z.number(),
  }).strict()),
  totals: z.object({
    netProfitPiastres: z.number(),
    grossPiastres: z.number(),
    totalKmMeters: z.number(),
    fuelPiastres: z.number(),
    expensePiastres: z.number(),
  }).strict(),
}).passthrough()

export const adminRecentTripSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  grossPiastres: z.number().int(),
  totalKmMeters: z.number().int(),
  emptyKmMeters: z.number().int(),
  appName: z.string(),
  areaName: z.string().nullable(),
}).passthrough()

export const adminTripListItemSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  driverPhone: z.string(),
  driverDisplayName: z.string(),
  driverAppId: z.string(),
  appName: z.string(),
  appCode: z.string(),
  areaName: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string(),
  grossPiastres: z.number().int(),
  receivedPiastres: z.number().int().nullable(),
  tipPiastres: z.number().int(),
  commissionPiastres: z.number().int(),
  tollPiastres: z.number().int(),
  parkingPiastres: z.number().int(),
  totalKmMeters: z.number().int(),
  paidKmMeters: z.number().int(),
  emptyKmMeters: z.number().int(),
  deletedAt: z.string().nullable(),
}).strict()
export const adminTripsPageSchema = cursorPageSchema(adminTripListItemSchema)

export const adminTripDetailSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  grossPiastres: z.number().int(),
  receivedPiastres: z.number().int().nullable(),
  tipPiastres: z.number().int(),
  commissionPiastres: z.number().int(),
  tollPiastres: z.number().int(),
  parkingPiastres: z.number().int(),
  totalKmMeters: z.number().int(),
  paidKmMeters: z.number().int(),
  emptyKmMeters: z.number().int(),
  notes: z.string().nullable(),
  driverId: z.string(),
  driver: z.object({
    displayName: z.string(),
    user: z.object({ phone: z.string(), email: z.string().nullable() }).passthrough(),
  }).passthrough(),
  driverApp: z.object({
    customName: z.string().nullable(),
    appSource: z.object({ name: z.string(), code: z.string() }).passthrough(),
  }).passthrough(),
  vehicle: z.object({
    id: z.string(),
    type: z.string(),
    make: z.string().nullable(),
    model: z.string().nullable(),
    year: z.number().int().nullable(),
  }).passthrough(),
  area: z.object({ name: z.string() }).passthrough().nullable(),
}).passthrough()

export const adminVehicleListItemSchema = z.object({
  id: z.string(),
  type: z.enum(['CAR', 'BIKE']),
  make: z.string().nullable(),
  model: z.string().nullable(),
  year: z.number().int().nullable(),
  fuelType: z.string(),
  isActive: z.boolean(),
  odometerMeters: z.number(),
  driverId: z.string(),
  driverPhone: z.string(),
  driverDisplayName: z.string(),
  tripCount: z.number().int().nonnegative(),
  fuelLogCount: z.number().int().nonnegative(),
  maintenanceCount: z.number().int().nonnegative(),
  createdAt: z.string(),
}).strict()
export const adminVehiclesPageSchema = cursorPageSchema(adminVehicleListItemSchema)

export const adminEntitySchema = z.object({ id: z.string() }).passthrough()

const adminDashboardKpiSchema = z.object({
  value: z.number(),
  deltaPct: z.number().nullable(),
  sparkline: z.array(z.number()),
}).strict()

export const adminDashboardOverviewSchema = z.object({
  range: z.string(),
  generatedAt: z.string(),
  users: z.object({
    total: adminDashboardKpiSchema,
    active30d: adminDashboardKpiSchema,
    newToday: adminDashboardKpiSchema,
    newThisWeek: adminDashboardKpiSchema,
    newThisMonth: adminDashboardKpiSchema,
  }).strict(),
  drivers: z.object({
    total: adminDashboardKpiSchema,
    active: adminDashboardKpiSchema,
    inactive: adminDashboardKpiSchema,
    retentionPct: adminDashboardKpiSchema,
  }).strict(),
  trips: z.object({
    total: adminDashboardKpiSchema,
    today: adminDashboardKpiSchema,
    weekly: adminDashboardKpiSchema,
    monthly: adminDashboardKpiSchema,
  }).strict(),
  ocr: z.object({
    requests: adminDashboardKpiSchema,
    successRatePct: adminDashboardKpiSchema,
    failureRatePct: adminDashboardKpiSchema,
    meanConfidencePct: adminDashboardKpiSchema,
  }).strict(),
  business: z.object({
    growthRatePct: adminDashboardKpiSchema,
    engagementRatePct: adminDashboardKpiSchema,
    retentionRatePct: adminDashboardKpiSchema,
    conversionRatePct: adminDashboardKpiSchema,
  }).strict(),
  queues: z.object({
    openTickets: z.number().int().nonnegative(),
    pendingReviews: z.number().int().nonnegative(),
    flaggedPosts: z.number().int().nonnegative(),
    unreadAlerts: z.number().int().nonnegative(),
  }).strict(),
}).passthrough()

const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const

registerOperation({
  operationId: 'admin.drivers.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/drivers',
  realm: 'admin',
  lifecycle: 'active',
  request: { query: 'adminDriversListQuerySchema' },
  successData: 'adminDriversPageSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'ADMIN_PERMISSIONS_STALE'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: { mode: 'cursor', defaultSize: 25, maximumSize: 100, stableSort: ['createdAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null },
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.drivers.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/drivers/:id',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'adminDriverDetailSchema',
  failureCodes: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.drivers.trips',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/drivers/:id/trips',
  realm: 'admin',
  lifecycle: 'active',
  request: { query: 'adminDriverTripsQuerySchema' },
  successData: 'adminRecentTripSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'],
  consumers: [...producer],
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
  request: { query: 'adminUsersListQuerySchema' },
  successData: 'adminUsersPageSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'ADMIN_PERMISSIONS_STALE'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: { mode: 'cursor', defaultSize: 25, maximumSize: 100, stableSort: ['createdAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null },
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.users.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/users/:id',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'adminUserDetailSchema',
  failureCodes: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'],
  consumers: [...producer],
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
  request: { query: 'adminTripsListQuerySchema' },
  successData: 'adminTripsPageSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'ADMIN_PERMISSIONS_STALE'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: { mode: 'cursor', defaultSize: 25, maximumSize: 100, stableSort: ['startedAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null },
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.trips.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/trips/:id',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'adminTripDetailSchema',
  failureCodes: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'],
  consumers: [...producer],
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
  request: { query: 'adminVehiclesListQuerySchema' },
  successData: 'adminVehiclesPageSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'ADMIN_PERMISSIONS_STALE'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: { mode: 'cursor', defaultSize: 25, maximumSize: 100, stableSort: ['createdAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null },
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.vehicles.get',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/vehicles/:id',
  realm: 'admin',
  lifecycle: 'active',
  request: {},
  successData: 'adminVehicleSchema',
  failureCodes: ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'admin.dashboard.overview',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/admin/dashboard/overview',
  realm: 'admin',
  lifecycle: 'active',
  request: { query: 'adminDashboardQuerySchema' },
  successData: 'adminDashboardOverviewSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'ADMIN_PERMISSIONS_STALE'],
  consumers: [...producer],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

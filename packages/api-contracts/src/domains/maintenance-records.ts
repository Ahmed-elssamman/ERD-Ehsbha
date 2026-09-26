import { z } from 'zod'
import { MaintenanceChange, MaintenanceView, isCalendarDate } from '@ehsbha/shared-types'
import { registerOperation } from '../catalog/registry'
import type { PaginationDescriptor, IdempotencyPolicy } from '../catalog/types'

const amount = z.number().int().min(0).max(2_147_483_647)
const cursor = z.string().min(1).max(2048).optional()
const limit = z.coerce.number().int().min(1).max(100).default(25)
export const maintenanceItemSchema = z.object({
  id: z.string(), code: z.string(), name: z.string(), defaultIntervalKm: z.number().nullable(),
  defaultIntervalDays: z.number().int().nullable(), appliesToCar: z.boolean(), appliesToBike: z.boolean(),
}).passthrough()
export const maintenanceSnapshotSchema = z.object({
  vehicleId: z.string(), maintenanceItemId: z.string(), performedAt: z.string().datetime({ offset: true }),
  odometerMeters: z.number().int().nonnegative().safe(), costPiastres: amount,
  linkedExpenseId: z.string().nullable(), deletedAt: z.string().datetime({ offset: true }).nullable(), version: z.number().int().positive(),
}).strict()
export const maintenanceRecordSchema = maintenanceSnapshotSchema.extend({
  id: z.string(), notes: z.string().nullable(), clientMutationId: z.string().nullable().optional(), maintenanceItem: maintenanceItemSchema.optional(),
}).passthrough()
export const CreateMaintenanceRecordSchema = z.object({
  maintenanceItemId: z.string().min(1), performedAt: z.coerce.date(), odometerMeters: z.number().int().nonnegative().safe(),
  costPiastres: amount, linkedExpenseId: z.string().min(1).nullable().optional(),
  notes: z.string().max(500).nullable().optional(), clientMutationId: z.string().min(8).max(64).optional(),
}).strict()
export const UpdateMaintenanceRecordSchema = CreateMaintenanceRecordSchema.omit({ clientMutationId: true }).partial()
  .extend({ expectedVersion: z.number().int().positive() }).strict()
export const MaintenanceVersionSchema = z.object({ expectedVersion: z.coerce.number().int().positive() }).strict()
export const ListMaintenanceRecordsSchema = z.object({ view: z.nativeEnum(MaintenanceView).default(MaintenanceView.Active), cursor, limit }).strict()
export const MaintenanceHistoryQuerySchema = z.object({ cursor, limit }).strict()
export const maintenancePageSchema = z.object({ items: z.array(maintenanceRecordSchema), nextCursor: z.string().nullable() }).passthrough()
export const maintenanceRevisionSchema = z.object({
  id: z.string(), recordId: z.string(), version: z.number().int().positive(), action: z.nativeEnum(MaintenanceChange),
  before: maintenanceSnapshotSchema.nullable(), after: maintenanceSnapshotSchema, createdAt: z.string().datetime({ offset: true }),
}).passthrough()
export const maintenanceHistorySchema = z.object({ items: z.array(maintenanceRevisionSchema), nextCursor: z.string().nullable() }).passthrough()
export const MaintenanceLinkableExpensesQuerySchema = z.object({
  date: z.string().refine(isCalendarDate, 'Expected YYYY-MM-DD'), amountPiastres: z.coerce.number().int().positive().max(2_147_483_647), cursor, limit,
}).strict()
export const maintenanceLinkableExpensesSchema = z.object({ items: z.array(z.object({
  id: z.string(), vehicleId: z.string().nullable(), dateTime: z.string().datetime({ offset: true }), amountPiastres: amount,
}).passthrough()), nextCursor: z.string().nullable() }).passthrough()

const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const
const page = { mode: 'cursor', defaultSize: 25, maximumSize: 100, stableSort: ['performedAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null } satisfies PaginationDescriptor
const retry = { header: 'Idempotency-Key', minimumKeyLength: 8, maximumKeyLength: 128, scope: 'realm-actor-operation-key', retentionHours: 24 } satisfies IdempotencyPolicy
const base = '/api/v1/vehicles/:vehicleId/maintenance'
registerOperation({ operationId: 'driver.maintenance.items', transport: 'http', method: 'GET', path: '/api/v1/maintenance/items', realm: 'driver', lifecycle: 'active',
  request: {}, successData: 'maintenanceItemSchema', failureCodes: ['UNAUTHENTICATED'], consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.maintenance.records.list', transport: 'http', method: 'GET', path: `${base}/records`, realm: 'driver', lifecycle: 'active',
  request: { query: 'ListMaintenanceRecordsSchema' }, successData: 'maintenancePageSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'INVALID_CURSOR'], consumers: [...producer], compatibility: 'incompatible', owner: 'platform', pagination: page, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.maintenance.records.create', transport: 'http', method: 'POST', path: `${base}/records`, realm: 'driver', lifecycle: 'active',
  request: { body: 'CreateMaintenanceRecordSchema' }, successData: 'maintenanceRecordSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'MAINTENANCE_LINK_CONFLICT'], consumers: [...producer], compatibility: 'incompatible', owner: 'platform', pagination: null, idempotency: retry, followUp: null })
registerOperation({ operationId: 'driver.maintenance.records.update', transport: 'http', method: 'PATCH', path: `${base}/records/:id`, realm: 'driver', lifecycle: 'active',
  request: { body: 'UpdateMaintenanceRecordSchema' }, successData: 'maintenanceRecordSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'MAINTENANCE_LINK_CONFLICT', 'MAINTENANCE_VERSION_CONFLICT'], consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: retry, followUp: null })
registerOperation({ operationId: 'driver.maintenance.records.delete', transport: 'http', method: 'DELETE', path: `${base}/records/:id`, realm: 'driver', lifecycle: 'active',
  request: { query: 'MaintenanceVersionSchema' }, successData: 'EmptySuccessDataSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'MAINTENANCE_VERSION_CONFLICT'], consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: retry, followUp: null })
registerOperation({ operationId: 'driver.maintenance.records.restore', transport: 'http', method: 'POST', path: `${base}/records/:id/restore`, realm: 'driver', lifecycle: 'active',
  request: { body: 'MaintenanceVersionSchema' }, successData: 'maintenanceRecordSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'MAINTENANCE_LINK_CONFLICT', 'MAINTENANCE_VERSION_CONFLICT'], consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: retry, followUp: null })
registerOperation({ operationId: 'driver.maintenance.records.history', transport: 'http', method: 'GET', path: `${base}/records/:id/history`, realm: 'driver', lifecycle: 'active',
  request: { query: 'MaintenanceHistoryQuerySchema' }, successData: 'maintenanceHistorySchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'INVALID_CURSOR'], consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: { ...page, stableSort: ['version:desc'] }, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.maintenance.linkable-expenses', transport: 'http', method: 'GET', path: `${base}/linkable-expenses`, realm: 'driver', lifecycle: 'active',
  request: { query: 'MaintenanceLinkableExpensesQuerySchema' }, successData: 'maintenanceLinkableExpensesSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'INVALID_CURSOR'], consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: { ...page, stableSort: ['dateTime:desc', 'id:desc'] }, idempotency: null, followUp: null })

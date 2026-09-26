import { z } from 'zod'
import { ExpenseCategory, ExpenseChange, ExpenseView, isCalendarDate, DRIVER_TIME_ZONE } from '@ehsbha/shared-types'
import { registerOperation } from '../catalog/registry'
import type { PaginationDescriptor, IdempotencyPolicy } from '../catalog/types'

export const expenseCategorySchema = z.nativeEnum(ExpenseCategory)
const expenseAmountSchema = z.number().int().min(1).max(2_147_483_647)
const expenseDateSchema = z.string().refine(isCalendarDate, 'Expected YYYY-MM-DD')
const expenseCursorSchema = z.string().min(1).max(2048).optional()
const expensePageLimitSchema = z.coerce.number().int().min(1).max(100).default(25)

export const expenseSnapshotSchema = z.object({
  vehicleId: z.string().nullable(), category: expenseCategorySchema, amountPiastres: expenseAmountSchema,
  dateTime: z.string().datetime({ offset: true }), linkedTripId: z.string().nullable(),
  isRecurring: z.boolean(), recurrenceRule: z.string().nullable(),
  deletedAt: z.string().datetime({ offset: true }).nullable(), version: z.number().int().positive(),
}).strict()

export const driverExpenseSchema = expenseSnapshotSchema.extend({
  linkedFuel: z.array(z.object({ id: z.string(), vehicleId: z.string() })).optional(),
  linkedMaintenance: z.array(z.object({ id: z.string(), vehicleId: z.string() })).optional(),
  id: z.string(), notes: z.string().nullable(), clientMutationId: z.string().nullable().optional(),
}).passthrough()

// Older generic export remains available to its contract consumers.
export const expenseSchema = z.object({
  id: z.string(), tripId: z.string().optional(), amountPiastres: z.number().int(), category: z.string(),
  description: z.string().optional(), incurredAt: z.string(),
}).passthrough()

export const CreateExpenseSchema = z.object({
  vehicleId: z.string().min(1).nullable().optional(), category: expenseCategorySchema,
  amountPiastres: expenseAmountSchema, dateTime: z.coerce.date(),
  linkedTripId: z.string().min(1).nullable().optional(),
  isRecurring: z.boolean().default(false), recurrenceRule: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(), clientMutationId: z.string().min(8).max(64).optional(),
}).strict()

export const ExpenseVersionSchema = z.object({ expectedVersion: z.coerce.number().int().positive() }).strict()
export const UpdateExpenseSchema = CreateExpenseSchema.partial().extend({ expectedVersion: z.number().int().positive() }).strict()

export const ListExpensesSchema = z.object({
  from: z.coerce.date().optional(), to: z.coerce.date().optional(), category: expenseCategorySchema.optional(),
  view: z.nativeEnum(ExpenseView).default(ExpenseView.Active), cursor: expenseCursorSchema, limit: expensePageLimitSchema,
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, 'Invalid date range')

export const expensePageSchema = z.object({ items: z.array(driverExpenseSchema), nextCursor: z.string().nullable() }).passthrough()
export const ExpenseSummaryQuerySchema = z.object({ from: expenseDateSchema, to: expenseDateSchema }).strict()
  .refine((value) => value.from <= value.to, 'Invalid date range')
export const expenseSummarySchema = z.object({
  from: expenseDateSchema, to: expenseDateSchema, timeZone: z.literal(DRIVER_TIME_ZONE),
  totalPiastres: z.number().int().nonnegative().safe(), recordCount: z.number().int().nonnegative(), linkedCount: z.number().int().nonnegative(),
  byCategory: z.array(z.object({ category: expenseCategorySchema, amountPiastres: z.number().int().nonnegative().safe(), count: z.number().int().nonnegative() })),
}).passthrough()

export const ExpenseHistoryQuerySchema = z.object({ cursor: expenseCursorSchema, limit: expensePageLimitSchema }).strict()
export const expenseRevisionSchema = z.object({
  id: z.string(), expenseId: z.string(), action: z.nativeEnum(ExpenseChange),
  before: expenseSnapshotSchema.nullable(), after: expenseSnapshotSchema,
  createdAt: z.string().datetime({ offset: true }),
}).passthrough()
export const expenseHistorySchema = z.object({ items: z.array(expenseRevisionSchema), nextCursor: z.string().nullable() }).passthrough()

export const ExpenseLinkableTripsQuerySchema = z.object({
  date: expenseDateSchema, amountPiastres: z.coerce.number().int().min(1).max(2_147_483_647),
  category: expenseCategorySchema.refine((value) => value === ExpenseCategory.Toll || value === ExpenseCategory.Parking, 'Only toll or parking fees can be linked'),
  cursor: expenseCursorSchema, limit: expensePageLimitSchema,
}).strict()
export const expenseLinkableTripSchema = z.object({
  id: z.string(), vehicleId: z.string(), startedAt: z.string().datetime({ offset: true }),
  feePiastres: expenseAmountSchema, appName: z.string(),
}).passthrough()
export const expenseLinkableTripsSchema = z.object({ items: z.array(expenseLinkableTripSchema), nextCursor: z.string().nullable() }).passthrough()

const expenseRetry = { header: 'Idempotency-Key', minimumKeyLength: 8, maximumKeyLength: 128, scope: 'realm-actor-operation-key', retentionHours: 24 } satisfies IdempotencyPolicy

const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const
const page = { mode: 'cursor', defaultSize: 25, maximumSize: 100, stableSort: ['dateTime:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null } satisfies PaginationDescriptor

registerOperation({ operationId: 'driver.expenses.list', transport: 'http', method: 'GET', path: '/api/v1/expenses', realm: 'driver', lifecycle: 'active',
  request: { query: 'ListExpensesSchema' }, successData: 'expensePageSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'INVALID_CURSOR'],
  consumers: [...producer], compatibility: 'incompatible', owner: 'platform', pagination: page, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.expenses.summary', transport: 'http', method: 'GET', path: '/api/v1/expenses/summary', realm: 'driver', lifecycle: 'active',
  request: { query: 'ExpenseSummaryQuerySchema' }, successData: 'expenseSummarySchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.expenses.linkable-trips', transport: 'http', method: 'GET', path: '/api/v1/expenses/linkable-trips', realm: 'driver', lifecycle: 'active',
  request: { query: 'ExpenseLinkableTripsQuerySchema' }, successData: 'expenseLinkableTripsSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'INVALID_CURSOR'],
  consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: { ...page, stableSort: ['startedAt:desc', 'id:desc'] }, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.expenses.history', transport: 'http', method: 'GET', path: '/api/v1/expenses/:id/history', realm: 'driver', lifecycle: 'active',
  request: { query: 'ExpenseHistoryQuerySchema' }, successData: 'expenseHistorySchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'INVALID_CURSOR'],
  consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: { ...page, stableSort: ['createdAt:desc', 'id:desc'] }, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.expenses.create', transport: 'http', method: 'POST', path: '/api/v1/expenses', realm: 'driver', lifecycle: 'active',
  request: { body: 'CreateExpenseSchema' }, successData: 'driverExpenseSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'CONFLICT', 'EXPENSE_LINK_CONFLICT', 'MAINTENANCE_LINK_CONFLICT', 'FUEL_LINK_CONFLICT'],
  consumers: [...producer], compatibility: 'incompatible', owner: 'platform', pagination: null, idempotency: expenseRetry, followUp: null })
registerOperation({ operationId: 'driver.expenses.update', transport: 'http', method: 'PATCH', path: '/api/v1/expenses/:id', realm: 'driver', lifecycle: 'active',
  request: { body: 'UpdateExpenseSchema' }, successData: 'driverExpenseSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'EXPENSE_VERSION_CONFLICT', 'EXPENSE_LINK_CONFLICT', 'MAINTENANCE_LINK_CONFLICT', 'FUEL_LINK_CONFLICT'],
  consumers: [...producer], compatibility: 'incompatible', owner: 'platform', pagination: null, idempotency: expenseRetry, followUp: null })
registerOperation({ operationId: 'driver.expenses.delete', transport: 'http', method: 'DELETE', path: '/api/v1/expenses/:id', realm: 'driver', lifecycle: 'active',
  request: { query: 'ExpenseVersionSchema' }, successData: 'EmptySuccessDataSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'EXPENSE_VERSION_CONFLICT'],
  consumers: [...producer], compatibility: 'incompatible', owner: 'platform', pagination: null, idempotency: expenseRetry, followUp: null })
registerOperation({ operationId: 'driver.expenses.restore', transport: 'http', method: 'POST', path: '/api/v1/expenses/:id/restore', realm: 'driver', lifecycle: 'active',
  request: { body: 'ExpenseVersionSchema' }, successData: 'driverExpenseSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'EXPENSE_VERSION_CONFLICT', 'EXPENSE_LINK_CONFLICT', 'MAINTENANCE_LINK_CONFLICT', 'FUEL_LINK_CONFLICT'],
  consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: expenseRetry, followUp: null })

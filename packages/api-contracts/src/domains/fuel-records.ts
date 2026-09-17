import { z } from 'zod'
import { FuelChange, FuelEfficiencyIssue, FuelEfficiencyMethod, FuelFillCoverage, FuelKind, FuelQuantityUnit, FuelView, type FuelSnapshot, isCalendarDate } from '@ehsbha/shared-types'
import { registerOperation } from '../catalog/registry'
import type { IdempotencyPolicy, PaginationDescriptor } from '../catalog/types'

const amount = z.number().int().nonnegative().max(2_147_483_647)
const quantity = z.number().positive().max(9999.999).refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001, 'Use at most three decimal places')
const mileage = z.number().int().nonnegative().safe()
const cursor = z.string().min(1).max(2048).optional()
const limit = z.coerce.number().int().min(1).max(100).default(25)
const instant = z.string().datetime({ offset: true })
export const fuelSnapshotSchema = z.object({
  vehicleId: z.string(), dateTime: instant, fuelKind: z.nativeEnum(FuelKind).nullable(),
  quantity: quantity.nullable(), pricePerUnitPiastres: amount.nullable(), totalPiastres: amount,
  odometerMeters: mileage.nullable(), isFullTank: z.boolean(), fillCoverage: z.nativeEnum(FuelFillCoverage),
  linkedExpenseId: z.string().nullable(), deletedAt: instant.nullable(), version: z.number().int().positive(),
}).strict()
export const driverFuelEntrySchema = fuelSnapshotSchema.extend({
  id: z.string(), quantityUnit: z.nativeEnum(FuelQuantityUnit).nullable(), notes: z.string().nullable(),
  clientMutationId: z.string().nullable(), createdAt: instant, updatedAt: instant,
}).passthrough()
export const CreateFuelSchema = z.object({
  vehicleId: z.string().min(1), dateTime: z.coerce.date(), fuelKind: z.nativeEnum(FuelKind).nullable().default(null),
  quantity: quantity.nullable().default(null), pricePerUnitPiastres: amount.nullable().default(null), totalPiastres: amount,
  odometerMeters: mileage.nullable().default(null), isFullTank: z.boolean().default(false),
  fillCoverage: z.nativeEnum(FuelFillCoverage).default(FuelFillCoverage.Unconfirmed),
  linkedExpenseId: z.string().min(1).nullable().optional(), notes: z.string().max(500).nullable().optional(),
  clientMutationId: z.string().min(8).max(64).optional(),
}).strict()
export const UpdateFuelSchema = CreateFuelSchema.omit({ clientMutationId: true }).partial()
  .extend({ expectedVersion: z.number().int().positive() }).strict()
export const FuelVersionSchema = z.object({ expectedVersion: z.coerce.number().int().positive() }).strict()
export const ListFuelSchema = z.object({
  vehicleId: z.string().min(1).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(),
  view: z.nativeEnum(FuelView).default(FuelView.Active), cursor, limit,
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, 'From must precede to')
export const fuelPageSchema = z.object({
  items: z.array(driverFuelEntrySchema), nextCursor: z.string().nullable(),
  summary: z.object({ recordCount: z.number().int().nonnegative(), totalPiastres: z.number().int().nonnegative().safe() }),
}).passthrough()
export const FuelHistoryQuerySchema = z.object({ cursor, limit }).strict()
export const fuelRevisionSchema = z.object({
  id: z.string(), recordId: z.string(), version: z.number().int().positive(), action: z.nativeEnum(FuelChange),
  before: fuelSnapshotSchema.nullable(), after: fuelSnapshotSchema, createdAt: instant,
}).passthrough()
export const fuelHistorySchema = z.object({ items: z.array(fuelRevisionSchema), nextCursor: z.string().nullable() }).passthrough()
export const FuelLinkableExpensesQuerySchema = z.object({
  vehicleId: z.string().min(1), date: z.string().refine(isCalendarDate, 'Expected YYYY-MM-DD'),
  amountPiastres: z.coerce.number().int().positive().max(2_147_483_647), cursor, limit,
}).strict()
export const fuelLinkableExpensesSchema = z.object({ items: z.array(z.object({
  id: z.string(), vehicleId: z.string().nullable(), dateTime: instant, amountPiastres: amount,
}).passthrough()), nextCursor: z.string().nullable() }).passthrough()
export const FuelEfficiencyQuerySchema = z.object({ vehicleId: z.string().min(1), from: z.coerce.date(), to: z.coerce.date() }).strict()
  .refine((value) => value.from < value.to && value.to.getTime() - value.from.getTime() <= 366 * 86_400_000, 'Choose a period up to one year')
export const fuelEfficiencySchema = z.object({
  vehicleId: z.string(), method: z.nativeEnum(FuelEfficiencyMethod),
  kmPerLiter: z.number().positive().nullable(), litersPer100Km: z.number().positive().nullable(),
  costPerKmPiastres: z.number().int().nonnegative().safe().nullable(),
  cycleCount: z.number().int().nonnegative(), rejectedCycleCount: z.number().int().nonnegative(),
  recordCount: z.number().int().nonnegative(), measuredFillCount: z.number().int().nonnegative(),
  distanceMeters: mileage, quantityLiters: z.number().nonnegative(), purchasePiastres: z.number().int().nonnegative().safe(),
  from: instant.nullable(), to: instant.nullable(), issues: z.array(z.nativeEnum(FuelEfficiencyIssue)),
  requestedFrom: instant, requestedTo: instant, truncated: z.boolean(),
}).passthrough()
export interface CreateFuelRequest {
  vehicleId: string; dateTime: Date; fuelKind: FuelKind | null; quantity: number | null; pricePerUnitPiastres: number | null;
  totalPiastres: number; odometerMeters: number | null; isFullTank: boolean; fillCoverage: FuelFillCoverage;
  linkedExpenseId?: string | null; notes?: string | null; clientMutationId?: string;
}
export interface UpdateFuelRequest extends Partial<Omit<CreateFuelRequest, 'clientMutationId'>> { expectedVersion: number }
export interface FuelRecord extends FuelSnapshot {
  id: string; quantityUnit: FuelQuantityUnit | null; notes: string | null; clientMutationId: string | null; createdAt: string; updatedAt: string;
}
export interface FuelPage { items: FuelRecord[]; nextCursor: string | null; summary: { recordCount: number; totalPiastres: number } }
export interface FuelListRequest { vehicleId?: string; from?: Date; to?: Date; view: FuelView; cursor?: string; limit: number }

const producer = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const
const page = { mode: 'cursor', defaultSize: 25, maximumSize: 100, stableSort: ['dateTime:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null } satisfies PaginationDescriptor
const retry = { header: 'Idempotency-Key', minimumKeyLength: 8, maximumKeyLength: 128, scope: 'realm-actor-operation-key', retentionHours: 24 } satisfies IdempotencyPolicy
registerOperation({ operationId: 'driver.fuel.list', transport: 'http', method: 'GET', path: '/api/v1/fuel', realm: 'driver', lifecycle: 'active',
  request: { query: 'ListFuelSchema' }, successData: 'fuelPageSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'INVALID_CURSOR'], consumers: [...producer], compatibility: 'incompatible', owner: 'platform', pagination: page, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.fuel.create', transport: 'http', method: 'POST', path: '/api/v1/fuel', realm: 'driver', lifecycle: 'active',
  request: { body: 'CreateFuelSchema' }, successData: 'driverFuelEntrySchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'FUEL_LINK_CONFLICT'], consumers: [...producer], compatibility: 'incompatible', owner: 'platform', pagination: null, idempotency: retry, followUp: null })
registerOperation({ operationId: 'driver.fuel.update', transport: 'http', method: 'PATCH', path: '/api/v1/fuel/:id', realm: 'driver', lifecycle: 'active',
  request: { body: 'UpdateFuelSchema' }, successData: 'driverFuelEntrySchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'FUEL_LINK_CONFLICT', 'FUEL_VERSION_CONFLICT'], consumers: [...producer], compatibility: 'incompatible', owner: 'platform', pagination: null, idempotency: retry, followUp: null })
registerOperation({ operationId: 'driver.fuel.delete', transport: 'http', method: 'DELETE', path: '/api/v1/fuel/:id', realm: 'driver', lifecycle: 'active',
  request: { query: 'FuelVersionSchema' }, successData: 'EmptySuccessDataSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'FUEL_VERSION_CONFLICT'], consumers: [...producer], compatibility: 'incompatible', owner: 'platform', pagination: null, idempotency: retry, followUp: null })
registerOperation({ operationId: 'driver.fuel.restore', transport: 'http', method: 'POST', path: '/api/v1/fuel/:id/restore', realm: 'driver', lifecycle: 'active',
  request: { body: 'FuelVersionSchema' }, successData: 'driverFuelEntrySchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'FUEL_LINK_CONFLICT', 'FUEL_VERSION_CONFLICT'], consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: retry, followUp: null })
registerOperation({ operationId: 'driver.fuel.history', transport: 'http', method: 'GET', path: '/api/v1/fuel/:id/history', realm: 'driver', lifecycle: 'active',
  request: { query: 'FuelHistoryQuerySchema' }, successData: 'fuelHistorySchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'INVALID_CURSOR'], consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: { ...page, stableSort: ['version:desc'] }, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.fuel.linkable-expenses', transport: 'http', method: 'GET', path: '/api/v1/fuel/linkable-expenses', realm: 'driver', lifecycle: 'active',
  request: { query: 'FuelLinkableExpensesQuerySchema' }, successData: 'fuelLinkableExpensesSchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'INVALID_CURSOR'], consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: page, idempotency: null, followUp: null })
registerOperation({ operationId: 'driver.fuel.efficiency', transport: 'http', method: 'GET', path: '/api/v1/fuel/efficiency', realm: 'driver', lifecycle: 'active',
  request: { query: 'FuelEfficiencyQuerySchema' }, successData: 'fuelEfficiencySchema', failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND'], consumers: [...producer], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null })

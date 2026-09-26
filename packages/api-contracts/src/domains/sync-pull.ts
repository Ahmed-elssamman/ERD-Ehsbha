import { z } from 'zod'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { SyncEntityKind, SyncPullMode, type SyncJsonValue } from '@ehsbha/shared-types'
import { tripItemSchema } from './trip-ocr'
import { driverFuelEntrySchema } from './fuel-records'
import { driverExpenseSchema } from './expense-records'
import { sessionSchema, driverGoalSchema } from './operations'
import { driverVehicleSchema, driverAreaSchema, driverAppBindingSchema } from './vehicle-app-area'

extendZodWithOpenApi(z)

export const SYNC_CURSOR_MAX_LENGTH = 4096
export const SYNC_CYCLE_LIFETIME_MS = 24 * 60 * 60 * 1000
export const SYNC_PAGE_MAXIMUM = 100
export const PullSchema = z.object({
  cursor: z.string().min(1).max(SYNC_CURSOR_MAX_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(SYNC_PAGE_MAXIMUM).default(25),
}).strict()
export interface PullDto { cursor?: string; limit: number }

const instant = z.string().datetime({ offset: true })
const timestamps = { createdAt: instant, updatedAt: instant }
export const syncTripSchema = tripItemSchema.extend(timestamps)
export const syncExpenseSchema = driverExpenseSchema.extend(timestamps)
export const syncSessionSchema = sessionSchema.extend({ ...timestamps,
  driverAppId: z.string().nullable(), endedAt: instant.nullable(), activeMinutes: z.number().int(), clientMutationId: z.string().nullable(),
})
export const syncVehicleSchema = driverVehicleSchema.extend(timestamps)
export const syncAreaSchema = driverAreaSchema.extend({ createdAt: instant })
export const syncDriverAppSchema = driverAppBindingSchema.extend(timestamps)
export const syncGoalSchema = driverGoalSchema.extend(timestamps)
const jsonValue: z.ZodType<SyncJsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue),
])).openapi('SyncJsonValue', {
  type: ['string', 'number', 'boolean', 'null', 'array', 'object'],
  items: { $ref: '#/components/schemas/SyncJsonValue' },
  additionalProperties: { $ref: '#/components/schemas/SyncJsonValue' },
})
export const syncRecommendationSchema = z.object({
  id: z.string(), type: z.string(), title: z.string(), body: z.string(),
  score: z.number().min(0).max(1), payload: jsonValue, surface: z.string(),
  generatedAt: instant, expiresAt: instant, dismissedAt: instant.nullable(),
}).passthrough()

export const syncPageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(SyncEntityKind.Trips), items: z.array(syncTripSchema).max(SYNC_PAGE_MAXIMUM) }),
  z.object({ kind: z.literal(SyncEntityKind.Fuels), items: z.array(driverFuelEntrySchema).max(SYNC_PAGE_MAXIMUM) }),
  z.object({ kind: z.literal(SyncEntityKind.Expenses), items: z.array(syncExpenseSchema).max(SYNC_PAGE_MAXIMUM) }),
  z.object({ kind: z.literal(SyncEntityKind.Sessions), items: z.array(syncSessionSchema).max(SYNC_PAGE_MAXIMUM) }),
  z.object({ kind: z.literal(SyncEntityKind.Vehicles), items: z.array(syncVehicleSchema).max(SYNC_PAGE_MAXIMUM) }),
  z.object({ kind: z.literal(SyncEntityKind.Areas), items: z.array(syncAreaSchema).max(SYNC_PAGE_MAXIMUM) }),
  z.object({ kind: z.literal(SyncEntityKind.DriverApps), items: z.array(syncDriverAppSchema).max(SYNC_PAGE_MAXIMUM) }),
  z.object({ kind: z.literal(SyncEntityKind.Goals), items: z.array(syncGoalSchema).max(SYNC_PAGE_MAXIMUM) }),
  z.object({ kind: z.literal(SyncEntityKind.Recommendations), items: z.array(syncRecommendationSchema).max(SYNC_PAGE_MAXIMUM) }),
])
export type SyncPage = z.infer<typeof syncPageSchema>
export const syncPullResponseSchema = z.object({
  mode: z.literal(SyncPullMode.Reconcile), cycleId: z.string().uuid(),
  startedAt: instant, expiresAt: instant, page: syncPageSchema,
  nextCursor: z.string().min(1).max(SYNC_CURSOR_MAX_LENGTH).nullable(),
}).passthrough()
export interface SyncPullResponse {
  mode: SyncPullMode.Reconcile;
  cycleId: string;
  startedAt: string;
  expiresAt: string;
  page: SyncPage;
  nextCursor: string | null;
}

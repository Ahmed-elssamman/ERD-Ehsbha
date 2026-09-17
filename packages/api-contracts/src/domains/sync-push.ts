import { z } from 'zod'
import { SyncMutationKind, SyncMutationStatus } from '@ehsbha/shared-types'
import { CreateTripSchema } from './trip-ocr'
import { CreateFuelSchema, driverFuelEntrySchema } from './fuel-records'
import { CreateExpenseSchema } from './expense-records'
import { StartSessionSchema, EndSessionSchema } from './operations'
import { syncTripSchema, syncExpenseSchema, syncSessionSchema } from './sync-pull'
import { getErrorDefinition } from '../core/errors'

export const syncMutationIdSchema = z.string().min(8).max(64).regex(/^[\x21-\x7e]+$/)
const identity = { clientMutationId: syncMutationIdSchema }
const tripPayload = CreateTripSchema.innerType().omit({ clientMutationId: true }).superRefine((value, ctx) => {
  const result = CreateTripSchema.safeParse(value)
  if (!result.success) for (const issue of result.error.issues) ctx.addIssue(issue)
})
export const syncMutationSchema = z.discriminatedUnion('kind', [
  z.object({ ...identity, kind: z.literal(SyncMutationKind.TripCreate), payload: tripPayload }).strict(),
  z.object({ ...identity, kind: z.literal(SyncMutationKind.FuelCreate), payload: CreateFuelSchema.omit({ clientMutationId: true }) }).strict(),
  z.object({ ...identity, kind: z.literal(SyncMutationKind.ExpenseCreate), payload: CreateExpenseSchema.omit({ clientMutationId: true }) }).strict(),
  z.object({ ...identity, kind: z.literal(SyncMutationKind.SessionStart), payload: StartSessionSchema.omit({ clientMutationId: true }) }).strict(),
  z.object({ ...identity, kind: z.literal(SyncMutationKind.SessionEnd), payload: EndSessionSchema.omit({ clientMutationId: true }).extend({ id: z.string().min(1) }).strict() }).strict(),
])
export type SyncMutation = z.infer<typeof syncMutationSchema>
export const PushSchema = z.object({ mutations: z.array(syncMutationSchema).min(1).max(50) }).strict()
  .refine((value) => new Set(value.mutations.map((mutation) => mutation.clientMutationId)).size === value.mutations.length, 'Mutation identities must be unique within a batch')
export interface PushDto { mutations: SyncMutation[] }

const receipt = { ...identity, status: z.literal(SyncMutationStatus.Applied), recordId: z.string(),
  appliedAt: z.string().datetime({ offset: true }), replayed: z.boolean() }
export const syncAppliedResultSchema = z.discriminatedUnion('kind', [
  z.object({ ...receipt, kind: z.literal(SyncMutationKind.TripCreate), data: syncTripSchema.nullable() }).passthrough(),
  z.object({ ...receipt, kind: z.literal(SyncMutationKind.FuelCreate), data: driverFuelEntrySchema.nullable() }).passthrough(),
  z.object({ ...receipt, kind: z.literal(SyncMutationKind.ExpenseCreate), data: syncExpenseSchema.nullable() }).passthrough(),
  z.object({ ...receipt, kind: z.literal(SyncMutationKind.SessionStart), data: syncSessionSchema.nullable() }).passthrough(),
  z.object({ ...receipt, kind: z.literal(SyncMutationKind.SessionEnd), data: syncSessionSchema.nullable() }).passthrough(),
])
export const syncFailedResultSchema = z.object({
  ...identity, kind: z.nativeEnum(SyncMutationKind),
  status: z.nativeEnum(SyncMutationStatus).refine((value): value is Exclude<SyncMutationStatus, SyncMutationStatus.Applied> => value !== SyncMutationStatus.Applied),
  error: z.object({ code: z.string().refine((code) => getErrorDefinition(code)?.realms.includes('driver') === true), messageKey: z.string() }).passthrough(),
}).passthrough()
export const syncMutationResultSchema = z.union([syncAppliedResultSchema, syncFailedResultSchema])
export type SyncMutationResult = z.infer<typeof syncMutationResultSchema>
export type SyncAppliedResult = z.infer<typeof syncAppliedResultSchema>
export type SyncFailedResult = z.infer<typeof syncFailedResultSchema>
export const syncPushResponseSchema = z.object({ results: z.array(syncMutationResultSchema).min(1).max(50) }).passthrough()
export interface SyncPushResponse { results: SyncMutationResult[] }

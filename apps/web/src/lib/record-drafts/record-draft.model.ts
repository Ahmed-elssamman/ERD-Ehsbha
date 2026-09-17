import { z } from 'zod';

export enum RecordDraftKind { Expense = 'expense', Maintenance = 'maintenance', Fuel = 'fuel', Trip = 'trip', WorkSession = 'work-session', NotificationPreferences = 'notification-preferences', Report = 'report', ReportPreferences = 'report-preferences' }
export enum RecordDraftStatus { Editing = 'editing', Pending = 'pending', Completed = 'completed' }
export enum RecordDraftIssue { Storage = 'storage', Conflict = 'conflict', Account = 'account', Invalid = 'invalid' }
export enum RecordDraftSaveState { Empty = 'empty', Saving = 'saving', Saved = 'saved', Failed = 'failed' }

export const recordDraftSchema = z.object({
  schemaVersion: z.literal(1), generation: z.string().uuid(), accountId: z.string().min(1), kind: z.nativeEnum(RecordDraftKind),
  scope: z.string().min(1).max(200), revision: z.number().int().nonnegative(),
  status: z.nativeEnum(RecordDraftStatus), context: z.string().max(32_000), fields: z.string().max(16_000).nullable(),
  linkId: z.string().max(200).nullable(), updatedAt: z.number().int().nonnegative(),
  pending: z.object({ key: z.string().uuid(), body: z.string().max(16_000), startedAt: z.number().int().nonnegative() }).strict().nullable(),
}).strict().superRefine((draft, context) => {
  if ((draft.status === RecordDraftStatus.Pending) !== (draft.pending !== null)) {
    context.addIssue({ code: 'custom', path: ['pending'], message: 'draft-state' });
  }
});
export type RecordDraft = z.infer<typeof recordDraftSchema>;
export interface RecordDraftSummary { scope: string; updatedAt: number; status: RecordDraftStatus | null }
export interface RecordDraftState { saveState: RecordDraftSaveState; issue: RecordDraftIssue | null; status: RecordDraftStatus }
export class RecordDraftError extends Error {
  constructor(public issue: RecordDraftIssue) { super(`RECORD_DRAFT_${issue}`); this.name = 'RecordDraftError'; }
}
export function parseDraftJson<T extends z.ZodType>(text: string, schema: T): z.output<T> {
  try { return schema.parse(JSON.parse(text)); } catch { throw new RecordDraftError(RecordDraftIssue.Invalid); }
}

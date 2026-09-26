import { z } from 'zod';
import { isAxiosError } from 'axios';
import { sessionSchema, MAX_RECORDED_WORK_INTERVAL_MS } from '@ehsbha/api-contracts';
import { WorkSessionMutation, WorkSessionView, LocalTimeOccurrence, resolveLocalDateTime } from '@ehsbha/shared-types';
import { parseDraftJson, RecordDraftError, RecordDraftIssue, type RecordDraft } from '@/lib/record-drafts/record-draft.model';
import { readApiError } from '@/lib/api/client';
import { toDatetimeLocalValue } from '@/lib/time';
import { WorkSessionsApi, type WorkSessionRecord } from './work-sessions.api';

export const WORK_SESSION_DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
export const WORK_SESSION_VIEWS = [{ value: WorkSessionView.Active, label: 'workSessions.active' }, { value: WorkSessionView.Deleted, label: 'workSessions.deleted' }];
export const WORK_SESSION_QUERY_KEYS = ['work-sessions', 'analytics', 'decisions', 'score', 'record-drafts'];
export const workSessionContextSchema = z.object({ action: z.nativeEnum(WorkSessionMutation), record: sessionSchema.nullable() }).strict();
export interface WorkSessionContext { action: WorkSessionMutation; record: WorkSessionRecord | null }
export const workSessionFieldsSchema = z.object({ startedAt: z.string().max(100), endedAt: z.string().max(100),
  startedOccurrence: z.nativeEnum(LocalTimeOccurrence), endedOccurrence: z.nativeEnum(LocalTimeOccurrence),
  recordedStartedAt: z.string().nullable(), recordedEndedAt: z.string().nullable() }).strict();
export type WorkSessionFields = z.infer<typeof workSessionFieldsSchema>;
const instant = z.string().datetime({ offset: true });
const target = { id: z.string().min(1), expectedVersion: z.number().int().positive() };
export const workSessionCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal(WorkSessionMutation.Start), startedAt: instant }).strict(),
  z.object({ action: z.literal(WorkSessionMutation.End), ...target, endedAt: instant }).strict(),
  z.object({ action: z.literal(WorkSessionMutation.Create), startedAt: instant, endedAt: instant }).strict(),
  z.object({ action: z.literal(WorkSessionMutation.Correct), ...target, startedAt: instant, endedAt: instant }).strict(),
  z.object({ action: z.literal(WorkSessionMutation.Delete), ...target }).strict(),
  z.object({ action: z.literal(WorkSessionMutation.Restore), ...target }).strict(),
]);
export type WorkSessionCommand = z.infer<typeof workSessionCommandSchema>;
export function validateWorkSessionDraft(draft: RecordDraft): void {
  const context = parseDraftJson(draft.context, workSessionContextSchema);
  if (context.action !== WorkSessionMutation.Start && context.action !== WorkSessionMutation.Create && !context.record) throw new RecordDraftError(RecordDraftIssue.Invalid);
  if (draft.fields !== null) parseDraftJson(draft.fields, workSessionFieldsSchema);
  if (draft.pending) {
    const command = parseDraftJson(draft.pending.body, workSessionCommandSchema);
    if (command.action !== context.action || ('id' in command && (command.id !== context.record?.id || command.expectedVersion !== context.record.version))) throw new RecordDraftError(RecordDraftIssue.Invalid);
  }
}
export function workSessionDefaults(context: WorkSessionContext): WorkSessionFields {
  const now = new Date(), record = context.record;
  return { startedAt: record ? toDatetimeLocalValue(new Date(record.startedAt)) : context.action === WorkSessionMutation.Start ? toDatetimeLocalValue(now) : '',
    endedAt: record?.endedAt ? toDatetimeLocalValue(new Date(record.endedAt)) : context.action === WorkSessionMutation.End ? toDatetimeLocalValue(now) : '',
    startedOccurrence: LocalTimeOccurrence.Unspecified, endedOccurrence: LocalTimeOccurrence.Unspecified,
    recordedStartedAt: record?.startedAt ?? (context.action === WorkSessionMutation.Start ? now.toISOString() : null),
    recordedEndedAt: record?.endedAt ?? (context.action === WorkSessionMutation.End ? now.toISOString() : null) };
}
export function workSessionCommand(context: WorkSessionContext, fields: WorkSessionFields): WorkSessionCommand | null {
  const { action, record } = context;
  const target = record ? { id: record.id, expectedVersion: record.version } : null;
  if (action === WorkSessionMutation.Delete || action === WorkSessionMutation.Restore) return target ? { action, ...target } : null;
  const startedAt = resolveLocalDateTime(fields.startedAt, fields.startedOccurrence, fields.recordedStartedAt);
  const endedAt = resolveLocalDateTime(fields.endedAt, fields.endedOccurrence, fields.recordedEndedAt);
  if (!startedAt || new Date(startedAt).getTime() > Date.now() + 60_000) return null;
  if (action === WorkSessionMutation.Start) return { action, startedAt };
  if (!endedAt || new Date(endedAt).getTime() > Date.now() + 60_000) return null;
  const elapsed = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (elapsed <= 0 || elapsed > MAX_RECORDED_WORK_INTERVAL_MS) return null;
  if (action === WorkSessionMutation.End) return target ? { action, ...target, endedAt } : null;
  if (action === WorkSessionMutation.Create) return { action, startedAt, endedAt };
  return target ? { action, ...target, startedAt, endedAt } : null;
}
export function sendWorkSession(command: WorkSessionCommand, clientMutationId: string) {
  switch (command.action) {
    case WorkSessionMutation.Start: return WorkSessionsApi.start({ startedAt: command.startedAt, clientMutationId });
    case WorkSessionMutation.End: return WorkSessionsApi.end(command.id, { endedAt: command.endedAt, expectedVersion: command.expectedVersion, clientMutationId });
    case WorkSessionMutation.Create: return WorkSessionsApi.create({ startedAt: command.startedAt, endedAt: command.endedAt, clientMutationId });
    case WorkSessionMutation.Correct: return WorkSessionsApi.correct(command.id, { startedAt: command.startedAt, endedAt: command.endedAt, expectedVersion: command.expectedVersion, clientMutationId });
    case WorkSessionMutation.Delete: return WorkSessionsApi.remove(command.id, { expectedVersion: command.expectedVersion, clientMutationId });
    case WorkSessionMutation.Restore: return WorkSessionsApi.restore(command.id, { expectedVersion: command.expectedVersion, clientMutationId });
  }
}
export function workSessionUnconfirmed(error: Error): boolean { return !isAxiosError(error) || !error.response || error.response.status >= 500; }
const sessionErrorKeys: Record<string, string> = { SESSION_VERSION_CONFLICT: 'errors.SESSION_VERSION_CONFLICT', SESSION_STATE_CONFLICT: 'errors.SESSION_STATE_CONFLICT',
  SESSION_ALREADY_OPEN: 'errors.SESSION_ALREADY_OPEN', SESSION_ALREADY_ENDED: 'errors.SESSION_ALREADY_ENDED', NOT_FOUND: 'errors.NOT_FOUND', VALIDATION_ERROR: 'workSessions.invalidTime', IDEMPOTENCY_KEY_REUSED: 'workSessions.identityConflict' };
export function workSessionErrorKey(error: Error): string { return sessionErrorKeys[readApiError(error).code] ?? 'workSessions.saveUnconfirmed'; }

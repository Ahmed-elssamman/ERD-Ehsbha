import { z } from 'zod';
import { isAxiosError } from 'axios';
import { ReportMutation, ReportPeriod, isCalendarDate, lastCompletedReportRange } from '@ehsbha/shared-types';
import type { ReportSummary } from '@ehsbha/api-contracts';
import { readApiError } from '@/lib/api/client';
import { parseDraftJson, RecordDraftError, RecordDraftIssue, type RecordDraft } from '@/lib/record-drafts/record-draft.model';

export const REPORT_PERIOD_OPTIONS = [{ value: ReportPeriod.Weekly, label: 'reports.weekly' }, { value: ReportPeriod.Monthly, label: 'reports.monthly' }];
export const reportFieldsSchema = z.object({ period: z.nativeEnum(ReportPeriod), date: z.string().max(10) }).strict();
export interface ReportFields { period: ReportPeriod; date: string }
export interface ReportDraftContext extends ReportFields { action: ReportMutation; id: string | null; version: number }
export const reportDraftContextSchema = reportFieldsSchema.extend({ action: z.union([z.literal(ReportMutation.Create), z.literal(ReportMutation.Revise)]), id: z.string().min(1).nullable(), version: z.number().int().nonnegative() }).strict()
  .refine((value) => value.action === ReportMutation.Create ? value.id === null && value.version === 0 : value.id !== null && value.version > 0);
export const reportDraftCommandSchema = reportDraftContextSchema.refine((value) => isCalendarDate(value.date));
export function newReportContext(now = new Date()): ReportDraftContext {
  return { action: ReportMutation.Create, id: null, version: 0, period: ReportPeriod.Weekly, date: lastCompletedReportRange(ReportPeriod.Weekly, now).startsOn };
}
export function reviseReportContext(report: ReportSummary): ReportDraftContext {
  return { action: ReportMutation.Revise, id: report.id, version: report.version, period: report.period, date: report.startsOn };
}
export function validateReportDraft(draft: RecordDraft): void {
  const context = parseDraftJson(draft.context, reportDraftContextSchema);
  if (draft.fields !== null) parseDraftJson(draft.fields, reportFieldsSchema);
  if (draft.pending) {
    const command = parseDraftJson(draft.pending.body, reportDraftCommandSchema);
    if (command.action !== context.action || command.id !== context.id || command.version !== context.version ||
      (context.action === ReportMutation.Revise && (command.period !== context.period || command.date !== context.date))) throw new RecordDraftError(RecordDraftIssue.Invalid);
  }
}
export function reportUnconfirmed(error: Error): boolean {
  return !isAxiosError(error) || !error.response || error.response.status === 408 || error.response.status === 429 || error.response.status >= 500;
}
const REPORT_ERROR_KEYS: Record<string, string> = {
  REPORT_PERIOD_NOT_COMPLETE: 'errors.REPORT_PERIOD_NOT_COMPLETE', REPORT_VERSION_CONFLICT: 'errors.REPORT_VERSION_CONFLICT', REPORT_PREFERENCES_CONFLICT: 'errors.REPORT_PREFERENCES_CONFLICT',
  IDEMPOTENCY_KEY_REUSED: 'errors.IDEMPOTENCY_KEY_REUSED', VALIDATION_ERROR: 'reports.invalid', NOT_FOUND: 'reports.notFound',
};
export function reportErrorKey(error: Error): string { return REPORT_ERROR_KEYS[readApiError(error).code] ?? 'reports.requestFailed'; }

import { z } from 'zod';
import { reportPreferenceFields, reportPreferencesSchema, validReportSchedule, type ReportPreferences, type ReportPreferenceFields } from '@ehsbha/api-contracts';
import { parseDraftJson, RecordDraftError, RecordDraftIssue, type RecordDraft } from '@/lib/record-drafts/record-draft.model';

export const REPORT_TIME_FIELDS = [
  { name: 'deliveryTime', label: 'reports.settings.deliveryTime' }, { name: 'quietStartTime', label: 'reports.settings.quietStart' }, { name: 'quietEndTime', label: 'reports.settings.quietEnd' },
] as const;
export const reportPreferenceFormSchema = z.object({ weeklyEnabled: z.boolean(), monthlyEnabled: z.boolean(), quietEnabled: z.boolean(), deliveryTime: z.string().max(10), quietStartTime: z.string().max(10), quietEndTime: z.string().max(10) }).strict();
export interface ReportPreferenceForm { weeklyEnabled: boolean; monthlyEnabled: boolean; quietEnabled: boolean; deliveryTime: string; quietStartTime: string; quietEndTime: string }
export interface ReportPreferenceCommand extends ReportPreferenceFields { expectedVersion: number }
export const reportPreferenceCommandSchema = z.object({ ...reportPreferenceFields, expectedVersion: z.number().int().nonnegative() }).strict().refine(validReportSchedule);
export function reportMinuteTime(minute: number): string { return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`; }
function timeMinute(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return -1;
  const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute;
}
export function reportPreferenceDefaults(value: ReportPreferences): ReportPreferenceForm {
  return { weeklyEnabled: value.weeklyEnabled, monthlyEnabled: value.monthlyEnabled, quietEnabled: value.quietEnabled,
    deliveryTime: reportMinuteTime(value.deliveryMinute), quietStartTime: reportMinuteTime(value.quietStartMinute), quietEndTime: reportMinuteTime(value.quietEndMinute) };
}
export function reportPreferenceCommand(context: ReportPreferences, fields: ReportPreferenceForm): ReportPreferenceCommand | null {
  const result = reportPreferenceCommandSchema.safeParse({ weeklyEnabled: fields.weeklyEnabled, monthlyEnabled: fields.monthlyEnabled, quietEnabled: fields.quietEnabled,
    deliveryMinute: timeMinute(fields.deliveryTime), quietStartMinute: timeMinute(fields.quietStartTime), quietEndMinute: timeMinute(fields.quietEndTime), expectedVersion: context.version });
  return result.success ? result.data : null;
}
export function validateReportPreferenceDraft(draft: RecordDraft): void {
  const context = parseDraftJson(draft.context, reportPreferencesSchema);
  if (draft.fields !== null) parseDraftJson(draft.fields, reportPreferenceFormSchema);
  if (draft.pending && parseDraftJson(draft.pending.body, reportPreferenceCommandSchema).expectedVersion !== context.version) throw new RecordDraftError(RecordDraftIssue.Invalid);
}

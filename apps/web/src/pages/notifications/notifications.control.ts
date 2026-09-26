import { z } from 'zod';
import { isAxiosError } from 'axios';
import { DigestFrequency } from '@ehsbha/shared-types';
import { notificationPreferenceFields, notificationPreferencesSchema, validNotificationSchedule, type NotificationPreferences, type NotificationPreferenceFields } from '@ehsbha/api-contracts';
import { readApiError } from '@/lib/api/client';
import { parseDraftJson, RecordDraftError, RecordDraftIssue, type RecordDraft } from '@/lib/record-drafts/record-draft.model';

export const NOTIFICATION_PAGE_SIZE = 25;
export const NOTIFICATION_READ_BATCH_SIZE = 5;
export const NOTIFICATION_FREQUENCIES = [
  { value: DigestFrequency.Daily, label: 'notifications.settings.daily' },
  { value: DigestFrequency.EveryThreeDays, label: 'notifications.settings.everyThreeDays' },
  { value: DigestFrequency.Weekly, label: 'notifications.settings.weekly' },
];
export const NOTIFICATION_TIME_FIELDS = [
  { name: 'deliveryTime', label: 'notifications.settings.deliveryTime' },
  { name: 'quietStartTime', label: 'notifications.settings.quietStart' },
  { name: 'quietEndTime', label: 'notifications.settings.quietEnd' },
] as const;
export const notificationFieldsSchema = z.object({ digestEnabled: z.boolean(), digestFrequency: z.nativeEnum(DigestFrequency), quietEnabled: z.boolean(),
  deliveryTime: z.string().max(10), quietStartTime: z.string().max(10), quietEndTime: z.string().max(10) }).strict();
export interface NotificationFields { digestEnabled: boolean; digestFrequency: DigestFrequency; quietEnabled: boolean; deliveryTime: string; quietStartTime: string; quietEndTime: string }
export const notificationCommandSchema = z.object({ ...notificationPreferenceFields, expectedVersion: z.number().int().nonnegative() }).strict().refine(validNotificationSchedule);
export interface NotificationCommand extends NotificationPreferenceFields { expectedVersion: number }
export function minuteTime(minute: number): string { return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`; }
function timeMinute(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return -1;
  const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute;
}
export function notificationDefaults(value: NotificationPreferences): NotificationFields {
  return { digestEnabled: value.digestEnabled, digestFrequency: value.digestFrequency, quietEnabled: value.quietEnabled,
    deliveryTime: minuteTime(value.deliveryMinute), quietStartTime: minuteTime(value.quietStartMinute), quietEndTime: minuteTime(value.quietEndMinute) };
}
export function notificationCommand(context: NotificationPreferences, fields: NotificationFields): NotificationCommand | null {
  const result = notificationCommandSchema.safeParse({ digestEnabled: fields.digestEnabled, digestFrequency: fields.digestFrequency, quietEnabled: fields.quietEnabled,
    deliveryMinute: timeMinute(fields.deliveryTime), quietStartMinute: timeMinute(fields.quietStartTime), quietEndMinute: timeMinute(fields.quietEndTime), expectedVersion: context.version });
  return result.success ? result.data : null;
}
export function validateNotificationDraft(draft: RecordDraft): void {
  const context = parseDraftJson(draft.context, notificationPreferencesSchema);
  if (draft.fields !== null) parseDraftJson(draft.fields, notificationFieldsSchema);
  if (draft.pending) {
    const command = parseDraftJson(draft.pending.body, notificationCommandSchema);
    if (command.expectedVersion !== context.version) throw new RecordDraftError(RecordDraftIssue.Invalid);
  }
}
export function notificationUnconfirmed(error: Error): boolean {
  return !isAxiosError(error) || !error.response || error.response.status === 408 || error.response.status === 429 || error.response.status >= 500;
}
const ERROR_KEYS: Record<string, string> = {
  NOTIFICATION_PREFERENCES_CONFLICT: 'errors.NOTIFICATION_PREFERENCES_CONFLICT', DIGEST_INSUFFICIENT_DATA: 'errors.DIGEST_INSUFFICIENT_DATA',
  IDEMPOTENCY_KEY_REUSED: 'errors.IDEMPOTENCY_KEY_REUSED', VALIDATION_ERROR: 'notifications.settings.invalid',
};
export function notificationErrorKey(error: Error): string { return ERROR_KEYS[readApiError(error).code] ?? 'notifications.requestFailed'; }

import { z } from 'zod';
import { DigestFrequency } from '@ehsbha/shared-types';
import { registerOperation } from '../catalog/registry';

const minute = z.number().int().min(0).max(1439);
export const notificationPreferenceFields = {
  digestEnabled: z.boolean(), digestFrequency: z.nativeEnum(DigestFrequency), deliveryMinute: minute,
  quietEnabled: z.boolean(), quietStartMinute: minute, quietEndMinute: minute,
};
export interface NotificationPreferenceFields {
  digestEnabled: boolean; digestFrequency: DigestFrequency; deliveryMinute: number;
  quietEnabled: boolean; quietStartMinute: number; quietEndMinute: number;
}
export function validNotificationSchedule(value: NotificationPreferenceFields): boolean {
  if (!value.quietEnabled || !value.digestEnabled) return true;
  const { deliveryMinute: delivery, quietStartMinute: start, quietEndMinute: end } = value;
  if (start === end) return false;
  return start < end ? delivery < start || delivery >= end : delivery < start && delivery >= end;
}
export const notificationPreferencesSchema = z.object({ ...notificationPreferenceFields, version: z.number().int().nonnegative() }).passthrough();
export const UpdateNotificationPreferencesSchema = z.object({ ...notificationPreferenceFields,
  expectedVersion: z.number().int().nonnegative(), clientMutationId: z.string().uuid(),
}).strict().refine(validNotificationSchedule, { message: 'Delivery time falls within quiet hours', path: ['deliveryMinute'] });
export interface NotificationPreferences extends NotificationPreferenceFields { version: number }
export interface UpdateNotificationPreferences extends NotificationPreferenceFields { expectedVersion: number; clientMutationId: string }

const consumers = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }] as const;
registerOperation({ operationId: 'driver.notifications.preferences.get', transport: 'http', method: 'GET', path: '/api/v1/notifications/preferences', realm: 'driver', lifecycle: 'active',
  request: {}, successData: 'notificationPreferencesSchema', failureCodes: ['UNAUTHENTICATED'], consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null });
registerOperation({ operationId: 'driver.notifications.preferences.update', transport: 'http', method: 'PATCH', path: '/api/v1/notifications/preferences', realm: 'driver', lifecycle: 'active',
  request: { body: 'UpdateNotificationPreferencesSchema' }, successData: 'notificationPreferencesSchema', failureCodes: ['UNAUTHENTICATED', 'VALIDATION_ERROR', 'NOTIFICATION_PREFERENCES_CONFLICT', 'IDEMPOTENCY_KEY_REUSED'], consumers: [...consumers], compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null });

import { notificationPreferencesSchema, type UpdateNotificationPreferences } from '@ehsbha/api-contracts';
import { api } from '@/lib/api/client';
import { parseData } from '@/features/platform-api';

export const NotificationPreferencesApi = {
  get: () => api.get('/notifications/preferences').then((response) => parseData(notificationPreferencesSchema, response.data, 'driver.notifications.preferences.get')),
  update: (body: UpdateNotificationPreferences) => api.patch('/notifications/preferences', body).then((response) => parseData(notificationPreferencesSchema, response.data, 'driver.notifications.preferences.update')),
};

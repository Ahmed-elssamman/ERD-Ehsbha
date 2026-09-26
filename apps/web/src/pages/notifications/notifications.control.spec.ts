import { describe, expect, it } from 'vitest';
import { DigestFrequency } from '@ehsbha/shared-types';
import { AxiosError, AxiosHeaders } from 'axios';
import { notificationCommand, notificationDefaults, notificationUnconfirmed } from './notifications.control';

describe('notification preference form', () => {
  const context = { digestEnabled: true, digestFrequency: DigestFrequency.Daily, deliveryMinute: 510, quietEnabled: true, quietStartMinute: 1380, quietEndMinute: 420, version: 4 };
  it('retains the saved version and minute precision', () => {
    const value = notificationCommand(context, { ...notificationDefaults(context), deliveryTime: '09:17' });
    expect(value?.expectedVersion).toBe(4); expect(value?.deliveryMinute).toBe(557);
  });
  it('rejects malformed times and delivery during quiet hours', () => {
    expect(notificationCommand(context, { ...notificationDefaults(context), deliveryTime: '23:00' })).toBeNull();
    expect(notificationCommand(context, { ...notificationDefaults(context), deliveryTime: '' })).toBeNull();
    expect(notificationCommand(context, { ...notificationDefaults(context), quietEndTime: '24:30' })).toBeNull();
  });
  it('permits disabling automatic delivery independently of quiet hours', () => {
    expect(notificationCommand(context, { ...notificationDefaults(context), digestEnabled: false, deliveryTime: '23:00' })?.digestEnabled).toBe(false);
  });
  it('retains retry identity for uncertain timeouts, throttling, and server failures', () => {
    const failure = (status: number) => {
      const error = new AxiosError('Request failed');
      error.response = { status, statusText: 'Failed', data: null, headers: {}, config: { headers: new AxiosHeaders() } };
      return error;
    };
    for (const status of [408, 429, 500, 503]) expect(notificationUnconfirmed(failure(status))).toBe(true);
    expect(notificationUnconfirmed(failure(409))).toBe(false);
  });
});

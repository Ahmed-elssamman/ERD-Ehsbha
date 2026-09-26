import { DigestFrequency } from '@ehsbha/shared-types';
import { UpdateNotificationPreferencesSchema } from '@ehsbha/api-contracts';
import { DEFAULT_NOTIFICATION_PREFERENCES, digestEventKey, digestIsDue } from './notifications.control';
import { digestHourObservation } from './digest-insights';

describe('Cairo digest delivery', () => {
  const preferences = DEFAULT_NOTIFICATION_PREFERENCES;
  it('waits for delivery and excludes quiet hours and disabled automation', () => {
    expect(digestIsDue(preferences, null, new Date('2026-09-17T05:29:59Z'))).toBe(false);
    expect(digestIsDue(preferences, null, new Date('2026-09-17T05:30:00Z'))).toBe(true);
    expect(digestIsDue(preferences, null, new Date('2026-09-17T20:00:00Z'))).toBe(false);
    expect(digestIsDue({ ...preferences, digestEnabled: false }, null, new Date('2026-09-17T09:00Z'))).toBe(false);
  });
  it('counts calendar days over the 23-hour spring transition', () => {
    const weekly = { ...preferences, digestFrequency: DigestFrequency.Weekly };
    expect(digestIsDue(weekly, new Date('2026-04-17'), new Date('2026-04-23T09:00Z'))).toBe(false);
    expect(digestIsDue(weekly, new Date('2026-04-17'), new Date('2026-04-24T05:30Z'))).toBe(true);
    expect(digestEventKey(new Date('2026-09-17T21:00Z'))).toBe('daily-digest:2026-09-18');
    expect(digestEventKey(new Date('2026-10-29T20:30Z'))).toBe(digestEventKey(new Date('2026-10-29T21:30Z')));
  });
  it('rejects invalid schedules and accepts daytime quiet windows', () => {
    const { version, ...fields } = preferences;
    const body = { ...fields, expectedVersion: version, clientMutationId: 'dca9ef29-4e70-411f-8bb3-2f60eb03d294' };
    expect(UpdateNotificationPreferencesSchema.safeParse({ ...body, deliveryMinute: 1380 }).success).toBe(false);
    expect(UpdateNotificationPreferencesSchema.safeParse({ ...body, quietStartMinute: 480, quietEndMinute: 480 }).success).toBe(false);
    expect(UpdateNotificationPreferencesSchema.safeParse({ ...body, deliveryMinute: 600, quietStartMinute: 480, quietEndMinute: 540 }).success).toBe(true);
    expect(UpdateNotificationPreferencesSchema.safeParse({ ...body, deliveryMinute: 1440 }).success).toBe(false);
  });
});

describe('digest trip observations', () => {
  const trip = { startedAt: new Date('2026-09-10T07:00Z'), endedAt: new Date('2026-09-10T07:30Z'), driverAppId: 'app', areaId: null, paidKmMeters: 5000,
    earningsPiastres: 10000n, grossPiastres: null, commissionPiastres: null, tipPiastres: 0 };
  it('uses piastres and actual trip durations, with a minimum sample', () => {
    expect(digestHourObservation([trip, trip])).toBeNull();
    expect(digestHourObservation([trip, trip, trip])).toEqual({ hour: 10, earningsPerTripHourPiastres: 20000, tripCount: 3 });
  });
  it('does not round a short trip down to a minute or infer operating profit', () => {
    const short = { ...trip, endedAt: new Date('2026-09-10T07:00:30Z'), earningsPiastres: 100n };
    expect(digestHourObservation([short, short, short])?.earningsPerTripHourPiastres).toBe(12000);
  });
  it('refuses unsafe JSON monetary rates', () => {
    const huge = { ...trip, earningsPiastres: BigInt(Number.MAX_SAFE_INTEGER) };
    expect(() => digestHourObservation([huge, huge, huge])).toThrow();
  });
});

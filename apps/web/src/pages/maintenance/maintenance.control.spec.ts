import { describe, it, expect } from 'vitest';
import { LocalTimeOccurrence } from '@ehsbha/shared-types';
import { maintenanceFormSchema } from './maintenance.control';

describe('service entry validation', () => {
  const input = { maintenanceItemId: 'oil', performedAt: '2026-09-01T12:00', dateOccurrence: LocalTimeOccurrence.Unspecified, recordedDateTime: null, odometerKm: 0, costEgp: 0, notes: '' };
  it('distinguishes known zero cost from an empty amount', () => {
    expect(maintenanceFormSchema.safeParse(input).success).toBe(true);
    expect(maintenanceFormSchema.safeParse({ ...input, costEgp: '' }).success).toBe(false);
    expect(maintenanceFormSchema.safeParse({ ...input, odometerKm: '' }).success).toBe(false);
    expect(maintenanceFormSchema.safeParse({ ...input, costEgp: '0.001' }).success).toBe(false);
  });
  it('requires Cairo fold selection and preserves an unchanged recorded instant', () => {
    expect(maintenanceFormSchema.safeParse({ ...input, performedAt: '2026-10-29T23:30' }).success).toBe(false);
    expect(maintenanceFormSchema.safeParse({ ...input, performedAt: '2026-10-29T23:30', dateOccurrence: LocalTimeOccurrence.Later }).success).toBe(true);
    expect(maintenanceFormSchema.safeParse({ ...input, performedAt: '2026-10-29T23:30', recordedDateTime: '2026-10-29T21:30:00.000Z' }).success).toBe(true);
    expect(maintenanceFormSchema.safeParse({ ...input, performedAt: '2026-04-24T00:30' }).success).toBe(false);
  });
});

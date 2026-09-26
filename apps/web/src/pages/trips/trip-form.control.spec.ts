import { describe, expect, it } from 'vitest';
import { TripIncomeMode, LocalTimeOccurrence } from '@ehsbha/shared-types';
import { tripFormSchema } from './trip-form.control';

const draft = {
  incomeMode: TripIncomeMode.TakeHome, vehicleId: 'vehicle', driverAppId: 'app',
  startedAt: '2026-09-16T17:00', endedAt: '2026-09-16T17:30',
  grossEgp: '', commissionEgp: '', receivedEgp: '', earningsEgp: '85', tipEgp: '5',
  tollEgp: '0', parkingEgp: '0', totalKm: '10', paidKm: '8', commissionAuto: false,
};

describe('manual financial evidence', () => {
  it('rejects a nonexistent Cairo time and requires a choice for repeated times', () => {
    expect(tripFormSchema.safeParse({ ...draft, startedAt: '2026-04-24T00:30', endedAt: '2026-04-24T01:30' }).success).toBe(false);
    const repeated = { ...draft, startedAt: '2026-10-29T23:50', endedAt: '2026-10-29T23:10' };
    expect(tripFormSchema.safeParse(repeated).success).toBe(false);
    expect(tripFormSchema.safeParse({ ...repeated, startedOccurrence: LocalTimeOccurrence.Earlier, endedOccurrence: LocalTimeOccurrence.Later }).success).toBe(true);
    expect(tripFormSchema.safeParse({ ...repeated, startedOccurrence: LocalTimeOccurrence.Later, endedOccurrence: LocalTimeOccurrence.Earlier }).success).toBe(false);
  });
  it('edits a recorded autumn trip without silently changing its occurrence', () => {
    expect(tripFormSchema.safeParse({ ...draft, startedAt: '2026-10-29T23:50', endedAt: '2026-10-29T23:10',
      recordedStartedAt: '2026-10-29T20:50:00.123Z', recordedEndedAt: '2026-10-29T21:10:00.123Z' }).success).toBe(true);
  });
  it('keeps blank fare details null and accepts tips included in take-home income', () => {
    expect(tripFormSchema.parse(draft)).toMatchObject({ grossEgp: null, commissionEgp: null, receivedEgp: null, earningsEgp: 85, tipEgp: 5 });
  });
  it('requires an income fact and rejects tips exceeding that total', () => {
    expect(tripFormSchema.safeParse({ ...draft, earningsEgp: '' }).success).toBe(false);
    expect(tripFormSchema.safeParse({ ...draft, tipEgp: '86' }).success).toBe(false);
  });
  it('does not invent a commission for gross-only entry', () => {
    expect(tripFormSchema.safeParse({ ...draft, incomeMode: TripIncomeMode.Breakdown, grossEgp: '100' }).success).toBe(false);
    expect(tripFormSchema.safeParse({ ...draft, incomeMode: TripIncomeMode.Breakdown, grossEgp: '100', commissionEgp: '0' }).success).toBe(true);
  });
  it('rejects conflicting fare, commission and received amounts', () => {
    expect(tripFormSchema.safeParse({ ...draft, incomeMode: TripIncomeMode.Breakdown, grossEgp: '100', commissionEgp: '15', receivedEgp: '90' }).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { FuelFillCoverage, LocalTimeOccurrence } from '@ehsbha/shared-types';
import { fuelFormSchema, optionalFuelNumber } from './fuel.control';

const form = { dateTime: '2026-09-01T12:00', dateOccurrence: LocalTimeOccurrence.Unspecified, recordedDateTime: null,
  fuelKind: 'PETROL_92', totalEgp: '', quantity: '', unitPriceEgp: '', odometerKm: '', isFullTank: false, fillCoverage: FuelFillCoverage.Unconfirmed, notes: '' };
describe('fuel form', () => {
  it('requires an explicit payment without turning absent measurements into zero', () => {
    expect(fuelFormSchema.safeParse(form).success).toBe(false);
    expect(fuelFormSchema.safeParse({ ...form, totalEgp: '0' }).success).toBe(true);
    expect(optionalFuelNumber('')).toBeNull(); expect(optionalFuelNumber('0')).toBe(0);
    expect(fuelFormSchema.safeParse({ ...form, totalEgp: '123.45', quantity: '0' }).success).toBe(false);
    expect(fuelFormSchema.safeParse({ ...form, totalEgp: '123.456' }).success).toBe(false);
  });
  it('keeps the actual receipt independent of its quantity and unit price', () => {
    const parsed = fuelFormSchema.parse({ ...form, totalEgp: '12.34', quantity: '2', unitPriceEgp: '10' });
    expect(parsed.totalEgp).toBe('12.34');
    expect(fuelFormSchema.safeParse({ ...form, totalEgp: '1', dateTime: '2026-04-24T00:30' }).success).toBe(false);
  });
});

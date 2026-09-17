import { describe, expect, it } from 'vitest';
import { resolveTripFinancials, tripEarningsPiastres, tripContributionPiastres } from './trip-finance';

describe('trip financial evidence', () => {
  it('subtracts trip fees once from take-home income including tips, allowing negative contribution', () => {
    expect(tripContributionPiastres({ grossPiastres: null, commissionPiastres: null, earningsPiastres: 1500, tipPiastres: 500,
      tollPiastres: 2000, parkingPiastres: 100 })).toBe(-600);
  });
  it('preserves missing gross and commission for take-home-only income', () => {
    expect(resolveTripFinancials({ grossPiastres: null, commissionPiastres: null, earningsPiastres: 8500, tipPiastres: 500 }))
      .toEqual({ grossPiastres: null, commissionPiastres: null, receivedPiastres: 8000, earningsPiastres: 8500, tipPiastres: 500 });
  });
  it('does not add included tips twice and accepts database integer representation', () => {
    expect(tripEarningsPiastres({ grossPiastres: null, commissionPiastres: null, earningsPiastres: 8500n, tipPiastres: 500 })).toBe(8500);
    expect(tripEarningsPiastres({ grossPiastres: 10000, commissionPiastres: 2000, tipPiastres: 500 })).toBe(8500);
  });
  it('derives commission only when gross and fare after commission are known', () => {
    expect(resolveTripFinancials({ grossPiastres: 10000, commissionPiastres: null, receivedPiastres: 8000, tipPiastres: 500 })?.commissionPiastres).toBe(2000);
    expect(resolveTripFinancials({ grossPiastres: 10000, commissionPiastres: null, tipPiastres: 0 })).toBeNull();
  });
  it('distinguishes known zero from missing income and rejects contradictory evidence', () => {
    expect(tripEarningsPiastres({ grossPiastres: null, commissionPiastres: null, earningsPiastres: 0, tipPiastres: 0 })).toBe(0);
    expect(resolveTripFinancials({ grossPiastres: null, commissionPiastres: null, tipPiastres: 0 })).toBeNull();
    expect(resolveTripFinancials({ grossPiastres: 10000, commissionPiastres: 1000, earningsPiastres: 8500, tipPiastres: 0 })).toBeNull();
    expect(resolveTripFinancials({ grossPiastres: null, commissionPiastres: null, earningsPiastres: 100, tipPiastres: 200 })).toBeNull();
  });
  it('rejects fractions, negative and unsafe values', () => {
    for (const earningsPiastres of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(resolveTripFinancials({ grossPiastres: null, commissionPiastres: null, earningsPiastres, tipPiastres: 0 })).toBeNull();
    }
  });
});

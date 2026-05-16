import { computeProfit } from './profit.engine';

describe('profit.engine', () => {
  it('returns zeros for empty input', () => {
    const out = computeProfit({
      grossPiastres: 0,
      tipPiastres: 0,
      commissionPiastres: 0,
      fuelPiastres: 0,
      expensePiastres: 0,
      maintAmortPiastres: 0,
      totalKmMeters: 0,
      paidKmMeters: 0,
      onlineMinutes: 0,
    });
    expect(out).toEqual({
      netProfitPiastres: 0,
      profitPerKmPiastres: 0,
      profitPerHourPiastres: 0,
      emptyRatioBp: 0,
      emptyKmMeters: 0,
    });
  });

  it('computes net profit correctly', () => {
    const out = computeProfit({
      grossPiastres: 50_000,
      tipPiastres: 2_000,
      commissionPiastres: 10_000,
      fuelPiastres: 8_000,
      expensePiastres: 3_000,
      maintAmortPiastres: 1_000,
      totalKmMeters: 80_000,
      paidKmMeters: 60_000,
      onlineMinutes: 240,
    });
    // gross = 50000 + 2000 - 10000 = 42000
    // net   = 42000 - 8000 - 3000 - 1000 = 30000 piastres = 300 EGP
    expect(out.netProfitPiastres).toBe(30_000);
    // 30000 piastres / 80 km = 375 piastres/km
    expect(out.profitPerKmPiastres).toBe(375);
    // 30000 piastres / 4 hours = 7500 piastres/hour = 75 EGP/hr
    expect(out.profitPerHourPiastres).toBe(7_500);
    expect(out.emptyKmMeters).toBe(20_000);
    expect(out.emptyRatioBp).toBe(2_500);
  });

  it('handles negative profit (a losing day)', () => {
    const out = computeProfit({
      grossPiastres: 8_000,
      tipPiastres: 0,
      commissionPiastres: 2_000,
      fuelPiastres: 5_000,
      expensePiastres: 4_000,
      maintAmortPiastres: 500,
      totalKmMeters: 30_000,
      paidKmMeters: 20_000,
      onlineMinutes: 120,
    });
    // gross = 8000 - 2000 = 6000
    // net   = 6000 - 5000 - 4000 - 500 = -3500
    expect(out.netProfitPiastres).toBe(-3_500);
    expect(out.profitPerKmPiastres).toBeLessThan(0);
  });

  it('handles zero km without dividing by zero', () => {
    const out = computeProfit({
      grossPiastres: 0,
      tipPiastres: 0,
      commissionPiastres: 0,
      fuelPiastres: 5_000,
      expensePiastres: 0,
      maintAmortPiastres: 0,
      totalKmMeters: 0,
      paidKmMeters: 0,
      onlineMinutes: 0,
    });
    expect(out.profitPerKmPiastres).toBe(0);
    expect(out.profitPerHourPiastres).toBe(0);
    expect(out.emptyRatioBp).toBe(0);
  });

  it('clamps empty ratio basis points to [0, 10000]', () => {
    const out = computeProfit({
      grossPiastres: 0,
      tipPiastres: 0,
      commissionPiastres: 0,
      fuelPiastres: 0,
      expensePiastres: 0,
      maintAmortPiastres: 0,
      totalKmMeters: 100_000,
      paidKmMeters: 0,
      onlineMinutes: 60,
    });
    expect(out.emptyRatioBp).toBe(10_000);
  });
});

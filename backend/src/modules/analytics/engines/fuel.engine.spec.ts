import { computeFuelEfficiency, detectEfficiencyDrop } from './fuel.engine';

describe('fuel.engine', () => {
  it('handles insufficient data', () => {
    const out = computeFuelEfficiency([]);
    expect(out.method).toBe('INSUFFICIENT_DATA');
    expect(out.kmPerLiter).toBe(0);
  });

  it('uses tank-to-tank when two full-tanks exist', () => {
    const a = new Date('2026-04-01T08:00:00Z');
    const b = new Date('2026-04-05T08:00:00Z');
    const out = computeFuelEfficiency([
      { dateTime: a, liters: 40, totalPiastres: 80_000, odometerMeters: 100_000_000, isFullTank: true },
      { dateTime: new Date('2026-04-03T08:00:00Z'), liters: 20, totalPiastres: 40_000, odometerMeters: 100_240_000, isFullTank: false },
      { dateTime: b, liters: 25, totalPiastres: 50_000, odometerMeters: 100_540_000, isFullTank: true },
    ]);
    // km between fulls: 540 km
    // liters between fulls (exclusive of a, inclusive of b): 20 + 25 = 45
    // kmpl = 540/45 = 12
    expect(out.method).toBe('TANK_TO_TANK');
    expect(out.kmPerLiter).toBeCloseTo(12, 5);
  });

  it('falls back to rolling estimate when no two full fills', () => {
    const out = computeFuelEfficiency([
      { dateTime: new Date('2026-04-01T08:00:00Z'), liters: 30, totalPiastres: 60_000, odometerMeters: 100_000_000, isFullTank: false },
      { dateTime: new Date('2026-04-05T08:00:00Z'), liters: 25, totalPiastres: 50_000, odometerMeters: 100_500_000, isFullTank: false },
    ]);
    expect(out.method).toBe('ROLLING');
    // km = 500, liters total = 55, kmpl ≈ 9.09
    expect(out.kmPerLiter).toBeCloseTo(500 / 55, 5);
  });

  it('detects efficiency drop above threshold', () => {
    expect(detectEfficiencyDrop(10, 12, 0.1)).toBe(true);
    expect(detectEfficiencyDrop(11, 12, 0.1)).toBe(false);
    expect(detectEfficiencyDrop(0, 12, 0.1)).toBe(false);
    expect(detectEfficiencyDrop(10, 0, 0.1)).toBe(false);
  });
});

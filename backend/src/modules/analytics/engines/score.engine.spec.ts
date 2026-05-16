import { computeDriverScore, computeFatigue } from './score.engine';

describe('score.engine', () => {
  it('returns 50 when no median data is available', () => {
    const s = computeDriverScore({
      profitPerKmPiastres: 100,
      profitPerKmMedian: 0,
      netProfitPiastres: 1000,
      netProfitMedian: 0,
      emptyRatioBp: 0,
      lateNightShare: 0,
      onlineMinutesVarianceMinutes: 0,
      fatigueScore: 0,
    });
    expect(s.efficiency).toBe(50);
    expect(s.profit).toBe(50);
    expect(s.safety).toBe(100);
    expect(s.consistency).toBe(100);
    expect(s.overall).toBe(Math.round(0.35 * 50 + 0.25 * 50 + 0.25 * 100 + 0.15 * 100));
  });

  it('rewards above-median performance', () => {
    const s = computeDriverScore({
      profitPerKmPiastres: 200,
      profitPerKmMedian: 100,
      netProfitPiastres: 5000,
      netProfitMedian: 2500,
      emptyRatioBp: 0,
      lateNightShare: 0,
      onlineMinutesVarianceMinutes: 0,
      fatigueScore: 0,
    });
    expect(s.efficiency).toBeGreaterThan(50);
    expect(s.profit).toBeGreaterThan(50);
  });

  it('penalizes high fatigue and late-night work', () => {
    const a = computeDriverScore({
      profitPerKmPiastres: 100,
      profitPerKmMedian: 100,
      netProfitPiastres: 1000,
      netProfitMedian: 1000,
      emptyRatioBp: 0,
      lateNightShare: 0,
      onlineMinutesVarianceMinutes: 0,
      fatigueScore: 0,
    });
    const b = computeDriverScore({
      profitPerKmPiastres: 100,
      profitPerKmMedian: 100,
      netProfitPiastres: 1000,
      netProfitMedian: 1000,
      emptyRatioBp: 0,
      lateNightShare: 0.8,
      onlineMinutesVarianceMinutes: 0,
      fatigueScore: 0.9,
    });
    expect(b.safety).toBeLessThan(a.safety);
    expect(b.overall).toBeLessThan(a.overall);
  });
});

describe('fatigue', () => {
  it('SAFE when most signals are low', () => {
    const f = computeFatigue({
      continuousDriveMinutes: 30,
      dailyOnlineMinutes: 120,
      weeklyOnlineMinutes: 600,
      nightShare: 0,
      sleepGapHours: 22,
    });
    expect(f.level).toBe('SAFE');
  });

  it('HIGH when continuous + daily are both saturated', () => {
    const f = computeFatigue({
      continuousDriveMinutes: 240,
      dailyOnlineMinutes: 720,
      weeklyOnlineMinutes: 3000,
      nightShare: 0.7,
      sleepGapHours: 2,
    });
    expect(f.level).toBe('HIGH');
    expect(f.score).toBeGreaterThanOrEqual(0.7);
  });

  it('clamps score to [0, 1]', () => {
    const f = computeFatigue({
      continuousDriveMinutes: 99999,
      dailyOnlineMinutes: 99999,
      weeklyOnlineMinutes: 99999,
      nightShare: 5,
      sleepGapHours: -10,
    });
    expect(f.score).toBeLessThanOrEqual(1);
    expect(f.score).toBeGreaterThanOrEqual(0);
  });
});

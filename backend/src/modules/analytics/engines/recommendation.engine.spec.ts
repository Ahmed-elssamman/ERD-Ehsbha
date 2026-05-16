import { generateRecommendations, pickDailyDecisions } from './recommendation.engine';

const baseCtx = {
  locale: 'ar' as const,
  recent7d: {
    netProfitPiastres: 10_000,
    grossPiastres: 50_000,
    onlineMinutes: 600,
    totalKmMeters: 500_000,
    paidKmMeters: 350_000,
    emptyRatioBp: 3_000,
    fuelKmPerLiter: 10,
  },
  baseline90d: {
    emptyRatioBp: 2_000,
    fuelKmPerLiter: 12,
    profitPerKmPiastres: 200,
  },
  appPerformance: [],
  maintenance: [],
  fatigue: { score: 0.2, level: 'SAFE' as const },
};

describe('recommendation.engine', () => {
  it('flags high empty km', () => {
    const r = generateRecommendations(baseCtx);
    expect(r.find((x) => x.type === 'empty_km_high')).toBeTruthy();
  });

  it('flags fuel efficiency drop', () => {
    const r = generateRecommendations(baseCtx);
    expect(r.find((x) => x.type === 'fuel_efficiency_drop')).toBeTruthy();
  });

  it('flags maintenance imminent for RED items', () => {
    const r = generateRecommendations({
      ...baseCtx,
      maintenance: [{ name: 'Engine oil', status: 'RED', risk: 0.97 }],
    });
    expect(r.find((x) => x.type === 'maintenance_imminent')).toBeTruthy();
  });

  it('flags best app when one earns 15%+ more per hour', () => {
    const r = generateRecommendations({
      ...baseCtx,
      appPerformance: [
        { driverAppId: 'a', appName: 'Uber', profitPerHourPiastres: 4_000, onlineMinutes: 600 },
        { driverAppId: 'b', appName: 'inDrive', profitPerHourPiastres: 6_000, onlineMinutes: 600 },
      ],
    });
    expect(r.find((x) => x.type === 'best_app_window')).toBeTruthy();
  });

  it('flags high fatigue', () => {
    const r = generateRecommendations({
      ...baseCtx,
      fatigue: { score: 0.8, level: 'HIGH' },
    });
    expect(r.find((x) => x.type === 'fatigue_high')).toBeTruthy();
  });

  it('flags goal lag when forecast < 90% of target', () => {
    const r = generateRecommendations({
      ...baseCtx,
      monthlyGoal: {
        targetPiastres: 1_000_000,
        currentNetPiastres: 200_000,
        forecastNetPiastres: 500_000,
      },
    });
    expect(r.find((x) => x.type === 'goal_lag')).toBeTruthy();
  });
});

describe('pickDailyDecisions', () => {
  it('returns at most 3 decisions, balanced across buckets', () => {
    const picks = pickDailyDecisions([
      { type: 'best_app_window', title: 'a', body: '', score: 0.9, ttlMinutes: 60 },
      { type: 'empty_km_high', title: 'b', body: '', score: 0.8, ttlMinutes: 60 },
      { type: 'fatigue_high', title: 'c', body: '', score: 0.95, ttlMinutes: 60 },
      { type: 'goal_lag', title: 'd', body: '', score: 0.7, ttlMinutes: 60 },
      { type: 'maintenance_imminent', title: 'e', body: '', score: 0.85, ttlMinutes: 60 },
    ]);
    expect(picks).toHaveLength(3);
    const types = picks.map((p) => p.type);
    expect(types.some((t) => ['best_app_window', 'empty_km_high'].includes(t))).toBe(true);
    expect(types.some((t) => ['fatigue_high', 'maintenance_imminent', 'fuel_efficiency_drop'].includes(t))).toBe(true);
    expect(types).toContain('goal_lag');
  });
});

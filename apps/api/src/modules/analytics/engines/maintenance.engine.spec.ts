import { computeMaintenanceRisk } from './maintenance.engine';

describe('maintenance.engine', () => {
  const now = new Date('2026-05-16T12:00:00Z');

  it('does not infer a service at zero from missing history', () => {
    expect(computeMaintenanceRisk({ currentOdoMeters: 200000000, lastServiceOdoMeters: null, lastServiceAt: null, intervalKm: 10000, intervalDays: 180, now }))
      .toEqual({ status: 'UNKNOWN', risk: null, kmUsage: null, timeUsage: null });
  });

  it('does not treat a future service or odometer rollback as a healthy vehicle', () => {
    const input = { currentOdoMeters: 1000, lastServiceOdoMeters: 2000, lastServiceAt: new Date('2026-05-01T12:00:00Z'), intervalKm: 10000, intervalDays: 180, now };
    expect(computeMaintenanceRisk(input).status).toBe('UNKNOWN');
    expect(computeMaintenanceRisk({ ...input, currentOdoMeters: 3000, lastServiceAt: new Date('2026-06-01T12:00Z') }).status).toBe('UNKNOWN');
  });

  it('uses only provided positive intervals and preserves known zero usage', () => {
    const input = { currentOdoMeters: 1000, lastServiceOdoMeters: 1000, lastServiceAt: now, intervalKm: 10000, intervalDays: 0, now };
    expect(computeMaintenanceRisk(input)).toEqual({ status: 'GREEN', risk: 0, kmUsage: 0, timeUsage: null });
    expect(computeMaintenanceRisk({ ...input, intervalKm: 0 }).status).toBe('UNKNOWN');
  });

  it('GREEN when usage is low', () => {
    const r = computeMaintenanceRisk({
      currentOdoMeters: 100_000_000,
      lastServiceOdoMeters: 99_000_000,
      lastServiceAt: new Date('2026-05-01T12:00:00Z'),
      intervalKm: 10_000,
      intervalDays: 180,
      now,
    });
    expect(r.status).toBe('GREEN');
    expect(r.risk).toBeLessThan(0.7);
  });

  it('AMBER when between 0.7 and 0.95', () => {
    const r = computeMaintenanceRisk({
      currentOdoMeters: 108_000_000,
      lastServiceOdoMeters: 100_000_000,
      lastServiceAt: new Date('2026-05-01T12:00:00Z'),
      intervalKm: 10_000,
      intervalDays: 180,
      now,
    });
    // kmUsage 8000/10000 = 0.8
    expect(r.status).toBe('AMBER');
  });

  it('RED at >=0.95 and < 1', () => {
    const r = computeMaintenanceRisk({
      currentOdoMeters: 109_500_000,
      lastServiceOdoMeters: 100_000_000,
      lastServiceAt: new Date('2026-05-01T12:00:00Z'),
      intervalKm: 10_000,
      intervalDays: 180,
      now,
    });
    expect(r.status).toBe('RED');
  });

  it('OVERDUE above 1', () => {
    const r = computeMaintenanceRisk({
      currentOdoMeters: 112_000_000,
      lastServiceOdoMeters: 100_000_000,
      lastServiceAt: new Date('2026-05-01T12:00:00Z'),
      intervalKm: 10_000,
      intervalDays: 180,
      now,
    });
    expect(r.status).toBe('OVERDUE');
  });

  it('uses time usage when greater than km usage', () => {
    const r = computeMaintenanceRisk({
      currentOdoMeters: 100_500_000,
      lastServiceOdoMeters: 100_000_000,
      lastServiceAt: new Date('2025-05-01T12:00:00Z'),
      intervalKm: 10_000,
      intervalDays: 180,
      now,
    });
    expect(r.timeUsage).toBeGreaterThan(1);
    expect(r.status).toBe('OVERDUE');
  });
});

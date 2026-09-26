import { FuelFillCoverage, FuelKind } from '@ehsbha/shared-types';
import { fuelComparisonRecommendations } from './fuel-comparison.engine';
import type { FuelPoint } from './fuel.engine';

function record(day: number, odometerMeters: number, vehicleId = 'car'): FuelPoint {
  return { id: `${vehicleId}-${day}`, vehicleId, dateTime: new Date(Date.UTC(2026, 7, day)), fuelKind: FuelKind.Petrol92,
    quantity: 50, totalPiastres: 50000, odometerMeters, isFullTank: true, fillCoverage: FuelFillCoverage.Complete };
}
const boundary = new Date('2026-08-15T00:00Z');
const points = [record(1, 0), record(4, 600000), record(8, 1200000), record(15, 1400000), record(18, 1800000), record(22, 2200000)];
describe('fuel comparisons', () => {
  it('compares separate windows for one vehicle and carries measured evidence', () => {
    const result = fuelComparisonRecommendations([{ id: 'car', label: 'Car A', points }], boundary, 'en');
    expect(result).toHaveLength(1);
    expect(result[0].payload).toMatchObject({ vehicleId: 'car', baselineKmPerLiter: 12, recentKmPerLiter: 8,
      baselineCycleCount: 2, recentCycleCount: 2, baselineTo: '2026-08-08T00:00:00.000Z', recentFrom: boundary.toISOString() });
    expect(result[0].body).toContain('Car A');
    expect(result[0].body).toContain('33%');
  });
  it('does not join vehicles, overlapping cycles, missing fills or fuel conversions', () => {
    for (const invalid of [points.slice(1), points.map((row, index) => index > 2 ? { ...row, vehicleId: 'other' } : row),
      points.map((row) => ({ ...row, fillCoverage: FuelFillCoverage.Unconfirmed })),
      points.map((row) => row.dateTime >= boundary ? { ...row, fuelKind: FuelKind.Diesel } : row)]) {
      expect(fuelComparisonRecommendations([{ id: 'car', label: 'Car', points: invalid }], boundary, 'en')).toHaveLength(0);
    }
  });
});

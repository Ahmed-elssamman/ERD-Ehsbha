import { FuelEfficiencyIssue, FuelFillCoverage, FuelKind } from '@ehsbha/shared-types';
import { computeFuelEfficiency, detectEfficiencyDrop, type FuelPoint } from './fuel.engine';

function point(id: number, odometerMeters: number | null, quantity: number | null, changes: Partial<FuelPoint> = {}): FuelPoint {
  return { id: String(id), vehicleId: 'car', dateTime: new Date(Date.UTC(2026, 3, id)), fuelKind: FuelKind.Petrol92,
    quantity, totalPiastres: 10000, odometerMeters, isFullTank: true, fillCoverage: FuelFillCoverage.Complete, ...changes };
}
describe('fuel evidence', () => {
  it('never averages completed petrol and diesel cycles together', () => {
    const points = [point(1, 0, 10), point(2, 100000, 10), point(3, 200000, 10, { fuelKind: FuelKind.Diesel }), point(4, 300000, 10, { fuelKind: FuelKind.Diesel })];
    expect(computeFuelEfficiency(points)).toMatchObject({ kmPerLiter: null, issues: [FuelEfficiencyIssue.MixedFuel] });
  });
  it('keeps missing results null and does not invent a rolling estimate', () => {
    expect(computeFuelEfficiency([])).toMatchObject({ method: 'INSUFFICIENT_DATA', kmPerLiter: null, costPerKmPiastres: null });
    expect(computeFuelEfficiency([point(1, 0, 30, { isFullTank: false }), point(2, 500000, 25, { isFullTank: false })]).kmPerLiter).toBeNull();
  });
  it('excludes the opening purchase, includes partial fills and weights multiple cycles', () => {
    const records = [point(1, 1000000, 999, { totalPiastres: 999999 }), point(2, null, 20, { isFullTank: false }), point(3, 1540000, 25), point(4, 1640000, 20)];
    const result = computeFuelEfficiency(records);
    expect(result).toMatchObject({ method: 'TANK_TO_TANK', cycleCount: 2, measuredFillCount: 3, distanceMeters: 640000, quantityLiters: 65, purchasePiastres: 30000, costPerKmPiastres: 47 });
    expect(result.kmPerLiter).toBeCloseTo(640 / 65);
    expect(result.litersPer100Km).toBeCloseTo(65 / 640 * 100);
    expect(records[0].id).toBe('1');
  });
  it('needs boundary mileage, every consumed quantity and confirmed fill coverage', () => {
    const first = point(1, 0, null);
    expect(computeFuelEfficiency([first, point(2, 500000, 50)]).kmPerLiter).toBe(10);
    for (const last of [point(2, null, 50), point(2, 500000, null), point(2, 500000, 50, { fillCoverage: FuelFillCoverage.Unconfirmed }), point(2, 500000, 50, { fillCoverage: FuelFillCoverage.Missing })]) {
      expect(computeFuelEfficiency([first, last]).kmPerLiter).toBeNull();
    }
    expect(computeFuelEfficiency([first, point(2, 200000, null, { isFullTank: false }), point(3, 500000, 50)]).issues).toContain(FuelEfficiencyIssue.MissingQuantity);
  });
  it('rejects odometer rollback inside a cycle even when the closing reading is higher', () => {
    const result = computeFuelEfficiency([point(1, 100000, 10), point(2, 50000, 10, { isFullTank: false }), point(3, 300000, 10)]);
    expect(result.kmPerLiter).toBeNull();
    expect(result.issues).toContain(FuelEfficiencyIssue.OdometerOrder);
  });
  it('does not join tied timestamps, vehicles or incompatible fuel families', () => {
    const start = point(1, 100000, 10);
    expect(computeFuelEfficiency([start, point(2, 200000, 10, { vehicleId: 'bike' })]).issues).toEqual([FuelEfficiencyIssue.MixedVehicles]);
    expect(computeFuelEfficiency([start, point(2, 200000, 10, { dateTime: start.dateTime })]).kmPerLiter).toBeNull();
    for (const fuelKind of [null, FuelKind.Cng, FuelKind.Electric, FuelKind.Diesel]) {
      expect(computeFuelEfficiency([start, point(2, 200000, 10, { fuelKind })]).kmPerLiter).toBeNull();
    }
    expect(computeFuelEfficiency([start, point(2, 200000, 10, { fuelKind: FuelKind.Petrol95 })]).kmPerLiter).toBe(10);
  });
  it('recovers at a new full boundary after a rejected cycle', () => {
    const result = computeFuelEfficiency([point(1, 0, 10), point(2, 100000, null), point(3, 300000, 20)]);
    expect(result).toMatchObject({ cycleCount: 1, rejectedCycleCount: 1, kmPerLiter: 10, from: new Date('2026-04-02T00:00:00Z') });
  });
  it('rejects invalid precision and zero distance instead of returning a plausible ratio', () => {
    expect(computeFuelEfficiency([point(1, 0, 10), point(2, 100000, 0.0001)]).issues).toContain(FuelEfficiencyIssue.InvalidRecord);
    expect(computeFuelEfficiency([point(1, 0, 10), point(2, 0, 10)]).kmPerLiter).toBeNull();
  });
  it('never reports a drop from missing or zero evidence', () => {
    expect(detectEfficiencyDrop(10, 12)).toBe(true);
    expect(detectEfficiencyDrop(11, 12)).toBe(false);
    expect(detectEfficiencyDrop(null, 12)).toBe(false);
    expect(detectEfficiencyDrop(10, null)).toBe(false);
    expect(detectEfficiencyDrop(0, 12)).toBe(false);
  });
  it('retains a known free fill as zero cost rather than missing evidence', () => {
    expect(computeFuelEfficiency([point(1, 0, null), point(2, 100000, 10, { totalPiastres: 0 })])).toMatchObject({ kmPerLiter: 10, costPerKmPiastres: 0 });
  });
});

import { computeVehicleCostPerKm, operationalCostForDistance } from './vehicle-cost.engine';

describe('vehicle-cost.engine', () => {
  it('returns zero cost and 0% completeness for empty inputs', () => {
    const s = computeVehicleCostPerKm({});
    expect(s.totalPerKmPiastres).toBe(0);
    expect(s.completenessBp).toBe(0);
    expect(s.monthlyAvgKm).toBe(3000); // default
    expect(s.components.every((c) => !c.provided)).toBe(true);
  });

  it('computes fuel cost per km correctly (10L @ 22.25 EGP/L, 305 km range)', () => {
    // tank cost = 22250 piastres, range 305 km → 22250 / 305 ≈ 72.95 piastres/km
    const s = computeVehicleCostPerKm({
      fuelTankCostPiastres: 22_250,
      fuelTankKmRange: 305,
    });
    const fuel = s.components.find((c) => c.key === 'fuel')!;
    expect(fuel.provided).toBe(true);
    expect(fuel.perKmPiastres).toBeCloseTo(22_250 / 305, 0);
    expect(s.totalPerKmPiastres).toBeCloseTo(22_250 / 305, 0);
  });

  it('user example: fuel 222.5 EGP / 305 km → ~0.73 EGP/km', () => {
    const s = computeVehicleCostPerKm({
      fuelTankCostPiastres: 22_250,  // 222.50 EGP
      fuelTankKmRange: 305,
    });
    // 22250 piastres / 305 km = 72.95 piastres/km = 0.73 EGP/km ✓
    expect(s.totalPerKmPiastres).toBeGreaterThan(70);
    expect(s.totalPerKmPiastres).toBeLessThan(75);
  });

  it('user example: oil 200 EGP / 800 km → 0.25 EGP/km', () => {
    const s = computeVehicleCostPerKm({
      oilCostPiastres: 20_000,
      oilIntervalKm: 800,
    });
    const oil = s.components.find((c) => c.key === 'oil')!;
    // 20000 / 800 = 25 piastres/km = 0.25 EGP/km ✓
    expect(oil.perKmPiastres).toBe(25);
  });

  it('sums all components into total cost/km', () => {
    const s = computeVehicleCostPerKm({
      fuelTankCostPiastres: 22_250,
      fuelTankKmRange: 305,
      oilCostPiastres: 20_000,
      oilIntervalKm: 800,
      tireCostPiastres: 200_000,        // 2000 EGP
      tireIntervalKm: 40_000,
      brakesCostPiastres: 80_000,        // 800 EGP
      brakesIntervalKm: 30_000,
    });
    const fuel = 22_250 / 305;
    const oil = 20_000 / 800;
    const tire = 200_000 / 40_000;
    const brakes = 80_000 / 30_000;
    expect(s.totalPerKmPiastres).toBeCloseTo(fuel + oil + tire + brakes, 0);
  });

  it('computes battery cost-per-km via monthly km × interval months', () => {
    const s = computeVehicleCostPerKm({
      batteryCostPiastres: 150_000,
      batteryIntervalMonths: 24,
      monthlyAvgKm: 3000,
    });
    const battery = s.components.find((c) => c.key === 'battery')!;
    // total km life = 24 × 3000 = 72_000; per km = 150_000 / 72_000 ≈ 2.08
    expect(battery.perKmPiastres).toBeCloseTo(150_000 / (24 * 3000), 1);
  });

  it('monthly overhead spreads across monthlyAvgKm', () => {
    const s = computeVehicleCostPerKm({
      monthlyMaintCostPiastres: 60_000, // 600 EGP/month
      monthlyAvgKm: 6000,
    });
    const m = s.components.find((c) => c.key === 'monthly')!;
    expect(m.perKmPiastres).toBeCloseTo(60_000 / 6000, 1);
  });

  it('shareBp normalizes across components', () => {
    const s = computeVehicleCostPerKm({
      fuelTankCostPiastres: 22_250,
      fuelTankKmRange: 305,
      oilCostPiastres: 20_000,
      oilIntervalKm: 800,
    });
    const totalShare = s.components.reduce((sum, c) => sum + c.shareBp, 0);
    expect(totalShare).toBeLessThanOrEqual(10_000);
    expect(totalShare).toBeGreaterThanOrEqual(9_990); // rounding tolerance
  });

  it('completenessBp reflects how many components have data', () => {
    expect(computeVehicleCostPerKm({}).completenessBp).toBe(0);

    // 1 of 7 buckets (fuel, oil, tires, brakes, chain, battery, monthly)
    const oneFilled = computeVehicleCostPerKm({
      fuelTankCostPiastres: 22_250,
      fuelTankKmRange: 305,
    });
    expect(oneFilled.completenessBp).toBe(Math.round((1 / 7) * 10_000));
  });

  it('operationalCostForDistance returns piastres for a given distance', () => {
    // 1 EGP/km × 10 km = 10 EGP = 1000 piastres
    expect(operationalCostForDistance(100, 10_000)).toBe(1000);
    expect(operationalCostForDistance(0, 10_000)).toBe(0);
    expect(operationalCostForDistance(100, 0)).toBe(0);
  });
});

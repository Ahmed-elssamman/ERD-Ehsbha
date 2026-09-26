import { describe, expect, it } from 'vitest'
import { CreateFuelSchema, UpdateFuelSchema, ListFuelSchema, FuelEfficiencyQuerySchema } from './fuel-records'
import { UpdateVehicleSchema } from './vehicle-app-area'

const purchase = { vehicleId: 'car', dateTime: '2026-09-01T08:00:00Z', totalPiastres: 0 }
describe('fuel source contracts', () => {
  it('retains free purchases and explicitly missing evidence', () => {
    expect(CreateFuelSchema.parse(purchase)).toMatchObject({ totalPiastres: 0, quantity: null, fuelKind: null, odometerMeters: null, pricePerUnitPiastres: null, fillCoverage: 'UNCONFIRMED' });
    expect(CreateFuelSchema.parse({ ...purchase, fuelKind: 'ELECTRIC', quantity: 12.345 }).quantity).toBe(12.345);
  });
  it('rejects rounding loss, legacy fields, unsafe amounts and unguarded corrections', () => {
    for (const change of [{ quantity: 1.0001 }, { quantity: 0 }, { totalPiastres: 2_147_483_648 }, { liters: 10 }, { odometerMeters: -1 }]) {
      expect(CreateFuelSchema.safeParse({ ...purchase, ...change }).success).toBe(false);
    }
    expect(UpdateFuelSchema.safeParse({ totalPiastres: 1 }).success).toBe(false);
    expect(UpdateFuelSchema.parse({ expectedVersion: 1, odometerMeters: null }).odometerMeters).toBeNull();
    expect(UpdateVehicleSchema.safeParse({ odometerMeters: 1 }).success).toBe(false);
    expect(UpdateVehicleSchema.safeParse({ odometerMeters: 1, expectedOdometerVersion: 1 }).success).toBe(true);
  });
  it('bounds pages and evidence periods', () => {
    expect(ListFuelSchema.parse({}).limit).toBe(25);
    expect(ListFuelSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(ListFuelSchema.safeParse({ from: '2026-02-01', to: '2026-01-01' }).success).toBe(false);
    expect(FuelEfficiencyQuerySchema.safeParse({ vehicleId: 'car', from: '2025-01-01', to: '2026-09-01' }).success).toBe(false);
  });
});

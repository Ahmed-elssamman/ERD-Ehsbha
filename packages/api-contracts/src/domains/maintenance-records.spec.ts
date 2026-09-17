import { describe, it, expect } from 'vitest';
import { CreateMaintenanceRecordSchema, UpdateMaintenanceRecordSchema, ListMaintenanceRecordsSchema, maintenanceRiskSchema, maintenanceSnapshotSchema } from './operations';

describe('maintenance contracts', () => {
  const record = { maintenanceItemId: 'oil', performedAt: '2026-09-01T10:00:00Z', odometerMeters: 0, costPiastres: 0 };
  it('accepts known zero cost and mileage but rejects money overflow, fractions and extra fields', () => {
    expect(CreateMaintenanceRecordSchema.parse(record).costPiastres).toBe(0);
    for (const costPiastres of [-1, 0.5, 2147483648]) expect(CreateMaintenanceRecordSchema.safeParse({ ...record, costPiastres }).success).toBe(false);
    expect(CreateMaintenanceRecordSchema.safeParse({ ...record, guessed: true }).success).toBe(false);
  });
  it('requires the version for corrections and caps pages', () => {
    expect(UpdateMaintenanceRecordSchema.safeParse({ costPiastres: 99 }).success).toBe(false);
    expect(UpdateMaintenanceRecordSchema.safeParse({ costPiastres: 99, expectedVersion: 1 }).success).toBe(true);
    expect(ListMaintenanceRecordsSchema.parse({}).limit).toBe(25);
    expect(ListMaintenanceRecordsSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
  it('keeps missing service evidence nullable and excludes notes from financial snapshots', () => {
    expect(maintenanceRiskSchema.shape.risk.parse(null)).toBeNull();
    expect(maintenanceRiskSchema.shape.status.parse('UNKNOWN')).toBe('UNKNOWN');
    const snapshot = { ...record, vehicleId: 'car', linkedExpenseId: null, deletedAt: null, version: 1 };
    expect(maintenanceSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(maintenanceSnapshotSchema.safeParse({ ...snapshot, notes: 'private' }).success).toBe(false);
  });
});

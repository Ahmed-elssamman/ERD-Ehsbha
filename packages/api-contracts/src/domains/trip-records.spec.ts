import { describe, expect, it } from 'vitest';
import { CreateTripSchema, UpdateTripSchema, BatchDeleteTripsSchema } from './trip-ocr';
import { TripBulkActionSchema, TripVersionSchema } from './trip-records';

describe('reviewed trip writes', () => {
  it('requires a positive integer version for corrections and status changes', () => {
    expect(UpdateTripSchema.safeParse({ notes: 'A correction' }).success).toBe(false);
    for (const expectedVersion of [0, -1, 1.5]) {
      expect(UpdateTripSchema.safeParse({ expectedVersion, notes: 'A correction' }).success).toBe(false);
      expect(TripVersionSchema.safeParse({ expectedVersion }).success).toBe(false);
    }
    expect(TripVersionSchema.parse({ expectedVersion: '2' })).toEqual({ expectedVersion: 2 });
    expect(UpdateTripSchema.parse({ expectedVersion: 2, notes: 'A correction' })).toEqual({ expectedVersion: 2, notes: 'A correction' });
  });
  it('rejects unversioned or duplicated batch targets', () => {
    expect(BatchDeleteTripsSchema.safeParse({ ids: ['trip-a'] }).success).toBe(false);
    expect(TripBulkActionSchema.safeParse({ items: [{ id: 'trip-a' }], reason: 'Reviewed correction' }).success).toBe(false);
    const items = [{ id: 'trip-a', expectedVersion: 1 }, { id: 'trip-a', expectedVersion: 2 }];
    expect(BatchDeleteTripsSchema.safeParse({ items }).success).toBe(false);
    expect(TripBulkActionSchema.safeParse({ items, reason: 'Reviewed correction' }).success).toBe(false);
  });
  it('does not accept client-controlled origin or version at creation', () => {
    const body = { vehicleId: 'vehicle-a', driverAppId: 'app-a', startedAt: '2026-09-16T10:00:00Z', endedAt: '2026-09-16T10:30:00Z',
      earningsPiastres: 8500, totalKmMeters: 10000, paidKmMeters: 8000 };
    expect(CreateTripSchema.safeParse(body).success).toBe(true);
    expect(CreateTripSchema.safeParse({ ...body, source: 'OCR' }).success).toBe(false);
    expect(CreateTripSchema.safeParse({ ...body, version: 999 }).success).toBe(false);
    expect(UpdateTripSchema.safeParse({ expectedVersion: 1, source: 'OCR' }).success).toBe(false);
  });
});

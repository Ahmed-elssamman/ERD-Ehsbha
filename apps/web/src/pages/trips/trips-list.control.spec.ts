import { describe, expect, it } from 'vitest';
import { rangeFor, TripDatePreset } from './trips-list.control';

describe('Cairo trip filters', () => {
  it('selects the new month while the UTC date is still in the preceding month', () => {
    expect(rangeFor(TripDatePreset.ThisMonth, new Date('2026-09-30T21:30Z'))).toEqual({
      from: '2026-09-30T21:00:00.000Z', to: '2026-10-01T20:59:59.999Z',
    });
  });
  it('uses exactly seven calendar dates across the 25-hour autumn day', () => {
    expect(rangeFor(TripDatePreset.Last7, new Date('2026-10-30T12:00Z'))).toEqual({
      from: '2026-10-23T21:00:00.000Z', to: '2026-10-30T21:59:59.999Z',
    });
  });
  it('uses the 23-hour spring day and leaves all-time queries unbounded', () => {
    expect(rangeFor(TripDatePreset.Today, new Date('2026-04-24T12:00Z'))).toEqual({
      from: '2026-04-23T22:00:00.000Z', to: '2026-04-24T20:59:59.999Z',
    });
    expect(rangeFor(TripDatePreset.All)).toEqual({});
  });
});

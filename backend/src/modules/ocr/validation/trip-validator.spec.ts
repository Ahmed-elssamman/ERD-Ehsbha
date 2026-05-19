import { TripValidator } from './trip-validator';
import { EMPTY_PARSED } from '../dto/ocr.dto';

const REF = new Date('2026-05-20T12:00:00Z');

describe('TripValidator', () => {
  const v = new TripValidator();

  it('passes for sane values', () => {
    const w = v.validate({ ...EMPTY_PARSED, grossEgp: 27.04, totalKm: 5.7, startedAt: '2026-05-18T22:46:00.000Z', endedAt: '2026-05-18T22:57:00.000Z' }, REF);
    expect(w).not.toContain('OCR_OUT_OF_RANGE_fare');
    expect(w).not.toContain('OCR_OUT_OF_RANGE_distance');
  });

  it('flags negative fare', () => {
    expect(v.validate({ ...EMPTY_PARSED, grossEgp: -1 }, REF)).toContain('OCR_OUT_OF_RANGE_fare');
  });

  it('flags absurd fare', () => {
    expect(v.validate({ ...EMPTY_PARSED, grossEgp: 9999 }, REF)).toContain('OCR_OUT_OF_RANGE_fare');
  });

  it('flags received > 1.5x gross', () => {
    expect(v.validate({ ...EMPTY_PARSED, grossEgp: 20, receivedEgp: 50 }, REF)).toContain('OCR_OUT_OF_RANGE_received');
  });

  it('flags commission > 0.6x gross', () => {
    expect(v.validate({ ...EMPTY_PARSED, grossEgp: 20, commissionEgp: 15 }, REF)).toContain('OCR_OUT_OF_RANGE_commission');
  });

  it('flags distance > 500km', () => {
    expect(v.validate({ ...EMPTY_PARSED, totalKm: 1000 }, REF)).toContain('OCR_OUT_OF_RANGE_distance');
  });

  it('flags paidKm > totalKm * 1.05', () => {
    expect(v.validate({ ...EMPTY_PARSED, totalKm: 10, paidKm: 12 }, REF)).toContain('OCR_OUT_OF_RANGE_paidKm');
  });

  it('flags end before start', () => {
    expect(v.validate({ ...EMPTY_PARSED, startedAt: '2026-05-18T23:00:00Z', endedAt: '2026-05-18T22:00:00Z' }, REF)).toContain('OCR_END_BEFORE_START');
  });

  it('flags duration > 12h', () => {
    expect(v.validate({ ...EMPTY_PARSED, durationSec: 13 * 3600 }, REF)).toContain('OCR_DURATION_TOO_LONG');
  });

  it('flags very high rate per km', () => {
    expect(v.validate({ ...EMPTY_PARSED, grossEgp: 500, totalKm: 1 }, REF)).toContain('OCR_RATE_PER_KM_HIGH');
  });

  it('flags very low rate per km', () => {
    expect(v.validate({ ...EMPTY_PARSED, grossEgp: 5, totalKm: 100 }, REF)).toContain('OCR_RATE_PER_KM_LOW');
  });

  it('flags future timestamp', () => {
    expect(v.validate({ ...EMPTY_PARSED, startedAt: '2027-01-01T00:00:00Z' }, REF)).toContain('OCR_FUTURE_TIMESTAMP');
  });

  it('flags very old timestamp', () => {
    expect(v.validate({ ...EMPTY_PARSED, startedAt: '2024-01-01T00:00:00Z' }, REF)).toContain('OCR_TIMESTAMP_TOO_OLD');
  });
});

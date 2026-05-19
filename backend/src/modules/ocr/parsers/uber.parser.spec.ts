import { UberParser } from './uber.parser';
import { SemanticNormalizer } from '../semantic/normalizer';
import { FIXTURE as UBER_AR } from '../__fixtures__/uber-ar.txt';
import { FIXTURE as UBER_EN } from '../__fixtures__/uber-en.txt';
import { FIXTURE as UBER_MIXED } from '../__fixtures__/uber-mixed.txt';

describe('UberParser - Arabic Egypt screenshot', () => {
  const parser = new UberParser(new SemanticNormalizer());
  const r = parser.parse(UBER_AR, []);

  it('reads gross fare 27.04 EGP', () => {
    expect(r.fields.grossEgp).toBeCloseTo(27.04, 2);
  });

  it('reads received amount 28.00 EGP from cash-collected line', () => {
    expect(r.fields.receivedEgp).toBeCloseTo(28.0, 2);
  });

  it('reads total distance 5.70 km', () => {
    expect(r.fields.totalKm).toBeCloseTo(5.7, 2);
  });

  it('reads duration 11 minutes 41 seconds = 701 seconds', () => {
    expect(r.fields.durationSec).toBe(701);
  });

  it('reads date 18 May 2026 with PM time', () => {
    expect(r.fields.startedAt).toBeTruthy();
    const d = new Date(r.fields.startedAt!);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(4);
    expect(d.getUTCDate()).toBe(18);
    expect(d.getUTCHours()).toBe(22);
    expect(d.getUTCMinutes()).toBe(46);
  });

  it('detects scooter vehicle type', () => {
    expect(r.fields.vehicleType).toBe('scooter');
  });

  it('detects cash payment', () => {
    expect(r.fields.paymentMethod).toBe('cash');
  });

  it('captures pickup and destination', () => {
    expect(r.fields.pickup).toMatch(/Nasr City/);
    expect(r.fields.destination).toMatch(/Ahmed El-Zomor/);
  });

  it('emits waiting-fee warning', () => {
    expect(r.warnings).toContain('OCR_WAITING_FEE_DETECTED');
  });

  it('emits distance-is-paid warning (visible distance = with-passenger km)', () => {
    expect(r.warnings).toContain('OCR_DISTANCE_IS_PAID_KM');
  });

  it('sets paid km from app distance directly', () => {
    expect(r.fields.paidKm).toBeCloseTo(5.7, 2);
  });

  it('approximates total km to paid km when no separate empty-km is visible', () => {
    expect(r.fields.totalKm).toBeCloseTo(5.7, 2);
  });

  it('sets app hint to Uber', () => {
    expect(r.fields.appHint).toBe('Uber');
  });
});

describe('UberParser - English variant', () => {
  const parser = new UberParser(new SemanticNormalizer());
  const r = parser.parse(UBER_EN, []);

  it('reads gross fare', () => {
    expect(r.fields.grossEgp).toBeCloseTo(27.04, 2);
  });

  it('reads received', () => {
    expect(r.fields.receivedEgp).toBeCloseTo(28.0, 2);
  });

  it('reads distance', () => {
    expect(r.fields.totalKm).toBeCloseTo(5.7, 2);
  });

  it('reads duration', () => {
    expect(r.fields.durationSec).toBe(701);
  });
});

describe('UberParser - Mixed Arabic+English', () => {
  const parser = new UberParser(new SemanticNormalizer());
  const r = parser.parse(UBER_MIXED, []);

  it('reads gross fare', () => {
    expect(r.fields.grossEgp).toBeCloseTo(27.04, 2);
  });

  it('reads distance', () => {
    expect(r.fields.totalKm).toBeCloseTo(5.7, 2);
  });
});

import { UberParser } from './uber.parser';
import { CareemParser } from './careem.parser';
import { DidiParser } from './didi.parser';
import { SemanticNormalizer } from '../semantic/normalizer';
import { MultiScreenshotMerger } from '../merge/multi-screenshot.merger';
import { FIXTURE as UBER_AR } from '../__fixtures__/uber-ar.txt';
import { FIXTURE as UBER_BREAKDOWN } from '../__fixtures__/uber-breakdown.txt';
import { FIXTURE as CAREEM_REAL, FIXTURE_MAP as CAREEM_REAL_MAP } from '../__fixtures__/careem-real.txt';
import { FIXTURE as DIDI_REAL } from '../__fixtures__/didi-real.txt';

const normalizer = new SemanticNormalizer();

describe('Real screenshots — Uber Arabic (summary + breakdown)', () => {
  const parser = new UberParser(normalizer);
  const merger = new MultiScreenshotMerger();

  it('summary alone yields received from cash + duration', () => {
    const r = parser.parse(UBER_AR, []);
    // Cash collected (generic received, weight 1.0) → 28.00
    expect(r.fields.receivedEgp).toBeCloseTo(28.0, 2);
    expect(r.fields.totalKm).toBeCloseTo(5.7, 2);
    expect(r.fields.durationSec).toBe(701);
    expect(r.fields.startedAt).toMatch(/2026-05-18T22:46/);
  });

  it('breakdown alone yields الأجرة → gross, الدخل → received, رسوم الخدمة → commission', () => {
    const r = parser.parse(UBER_BREAKDOWN, []);
    expect(r.fields.grossEgp).toBeCloseTo(31.81, 2);
    expect(r.fields.commissionEgp).toBeCloseTo(4.77, 2);
    expect(r.fields.receivedEgp).toBeCloseTo(27.04, 2);
  });

  it('does NOT mis-attribute "مبالغ الدخل -28.00" to received (anchored الدخل)', () => {
    const r = parser.parse(UBER_BREAKDOWN, []);
    expect(r.fields.receivedEgp).not.toBeCloseTo(28.0, 1);
  });

  it('merged: breakdown overrides cash-collected for received (الدخل wins via weight)', () => {
    const a = parser.parse(UBER_AR, []);
    const b = parser.parse(UBER_BREAKDOWN, []);
    const merged = merger.merge([a, b]);
    expect(merged.parsed.grossEgp).toBeCloseTo(31.81, 2);
    expect(merged.parsed.receivedEgp).toBeCloseTo(27.04, 2);
    expect(merged.parsed.commissionEgp).toBeCloseTo(4.77, 2);
    expect(merged.parsed.totalKm).toBeCloseTo(5.7, 2);
    expect(merged.parsed.durationSec).toBe(701);
  });
});

describe('Real screenshots — Careem (دخلي / إجمالي المدفوع / km 26,6 / day-name date)', () => {
  const parser = new CareemParser(normalizer);
  const r = parser.parse(CAREEM_REAL, []);

  it('reads gross from الأجرة under استلمت (104.00, comma-decimal)', () => {
    expect(r.fields.grossEgp).toBeCloseTo(104.0, 2);
  });

  it('reads received from دخلي (91.16, comma-decimal)', () => {
    expect(r.fields.receivedEgp).toBeCloseTo(91.16, 2);
  });

  it('reads commission from إجمالي المدفوع (12.84, bundles service+VAT)', () => {
    expect(r.fields.commissionEgp).toBeCloseTo(12.84, 2);
  });

  it('reads distance from LTR format "km 26,6" → 26.6', () => {
    expect(r.fields.totalKm).toBeCloseTo(26.6, 2);
  });

  it('reads duration 35 min = 2100 sec', () => {
    expect(r.fields.durationSec).toBe(2100);
  });

  it('parses day-name-prefixed date "الجمعة، 15 مايو 2026"', () => {
    expect(r.fields.startedAt).toBeTruthy();
    const d = new Date(r.fields.startedAt!);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(4);
    expect(d.getUTCDate()).toBe(15);
  });

  it('parses English AM/PM marker (08:45 PM → 20:45)', () => {
    const d = new Date(r.fields.startedAt!);
    expect(d.getUTCHours()).toBe(20);
    expect(d.getUTCMinutes()).toBe(45);
  });

  it('detects wallet payment from "السداد عبر الهاتف المحمول"', () => {
    expect(r.fields.paymentMethod).toBe('wallet');
  });

  it('map view yields pickup + destination from address lines', () => {
    const m = parser.parse(CAREEM_REAL_MAP, []);
    expect(m.fields.pickup ?? m.fields.destination).toBeTruthy();
  });
});

describe('Real screenshots — DiDi (أرباحك / تم استلام النقد / 14 د 5 ث / yyyy/mm/dd)', () => {
  const parser = new DidiParser(normalizer);
  const r = parser.parse(DIDI_REAL, []);

  it('reads gross from تم استلام النقد (35.00)', () => {
    expect(r.fields.grossEgp).toBeCloseTo(35.0, 2);
  });

  it('reads received from أرباحك (29.87)', () => {
    expect(r.fields.receivedEgp).toBeCloseTo(29.87, 2);
  });

  it('reads commission from رسوم الخدمة شاملة ضريبة (4.85, absolute value)', () => {
    expect(r.fields.commissionEgp).toBeCloseTo(4.85, 2);
  });

  it('reads distance 6.7 km', () => {
    expect(r.fields.totalKm).toBeCloseTo(6.7, 2);
  });

  it('reads abbreviated duration "14 د 5 ث" → 845 sec', () => {
    expect(r.fields.durationSec).toBe(14 * 60 + 5);
  });

  it('parses yyyy/mm/dd date "2026/05/16, 08:43 م"', () => {
    expect(r.fields.startedAt).toBeTruthy();
    const d = new Date(r.fields.startedAt!);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(4);
    expect(d.getUTCDate()).toBe(16);
    expect(d.getUTCHours()).toBe(20);
    expect(d.getUTCMinutes()).toBe(43);
  });

  it('detects cash payment from نقدًا', () => {
    expect(r.fields.paymentMethod).toBe('cash');
  });

  it('reads waiting fee 0.32', () => {
    expect(r.fields.waitingFeeEgp).toBeCloseTo(0.32, 2);
  });
});

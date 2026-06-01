import { clamp, egpToPiastres, fromBp, kmToMeters, metersToKm, piastresToEgp, safeDiv, toBp } from './money';

describe('money utils', () => {
  it('converts EGP <-> piastres safely', () => {
    expect(egpToPiastres(123.45)).toBe(12_345);
    expect(piastresToEgp(12_345)).toBe(123.45);
    expect(piastresToEgp(BigInt(12_345))).toBe(123.45);
  });

  it('converts km <-> meters', () => {
    expect(kmToMeters(12.345)).toBe(12_345);
    expect(metersToKm(12_345)).toBe(12.345);
    expect(metersToKm(BigInt(12_345))).toBe(12.345);
  });

  it('safeDiv returns fallback on zero/infinite den', () => {
    expect(safeDiv(10, 5)).toBe(2);
    expect(safeDiv(10, 0)).toBe(0);
    expect(safeDiv(10, 0, 999)).toBe(999);
  });

  it('clamps values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(20, 0, 10)).toBe(10);
  });

  it('round-trips basis points', () => {
    expect(toBp(0.25)).toBe(2_500);
    expect(fromBp(2_500)).toBe(0.25);
    expect(toBp(2)).toBe(10_000);
    expect(toBp(-1)).toBe(0);
  });
});

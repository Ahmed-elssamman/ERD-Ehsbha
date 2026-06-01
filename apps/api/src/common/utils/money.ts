export function piastresToEgp(piastres: number | bigint): number {
  const n = typeof piastres === 'bigint' ? Number(piastres) : piastres;
  return Math.round(n) / 100;
}

export function egpToPiastres(egp: number): number {
  return Math.round(egp * 100);
}

export function metersToKm(meters: number | bigint): number {
  const n = typeof meters === 'bigint' ? Number(meters) : meters;
  return n / 1000;
}

export function kmToMeters(km: number): number {
  return Math.round(km * 1000);
}

export function safeDiv(num: number, den: number, fallback = 0): number {
  if (!den || !isFinite(den)) return fallback;
  const r = num / den;
  return isFinite(r) ? r : fallback;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function toBp(ratio: number): number {
  return Math.round(clamp(ratio, 0, 1) * 10_000);
}

export function fromBp(bp: number): number {
  return bp / 10_000;
}

export function kmToMeters(km: number): number {
  return Math.max(0, Math.round(km * 1000));
}

export function metersToKm(meters: number): number {
  return meters / 1000;
}

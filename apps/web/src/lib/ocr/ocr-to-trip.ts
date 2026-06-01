import type { CreateTripInput, DriverApp } from '@/lib/api/endpoints';
import type { OcrParsedTripDto, OcrPlatform } from '@/lib/api/ocr.api';

/**
 * Builds a `CreateTripInput` directly from an OCR-parsed trip — bypassing the
 * per-trip TripForm because in multi-trip mode the driver reviews N trips at
 * once and we save them in a batch without rendering the full form for each.
 *
 * Fallbacks for missing OCR fields:
 *   - Missing `startedAt`: derived from `Date.now() - durationSec` so the
 *     trip's timestamps still bracket a sensible window even when only the
 *     trip duration was visible (Uber summary cards never show start time).
 *   - Missing `endedAt`: derived from `startedAt + durationSec`, falling
 *     back to `startedAt` when neither is known.
 *   - Missing `grossEgp`: falls back to `receivedEgp` (Uber summary cards
 *     show only الدخل, not الأجرة) so the create request still validates.
 *   - Missing distance: defaults to 0 (the trip is still createable; the
 *     driver can edit later).
 */
export function buildCreateTripFromOcr(opts: {
  parsed: OcrParsedTripDto;
  vehicleId: string;
  driverAppId: string;
  areaId?: string | null;
  imageHashes: string[];
  /** Optional per-trip suffix appended to the clientMutationId so that
   * batch-creating N trips from the same screenshots doesn't collide on the
   * idempotency key. */
  index?: number;
}): CreateTripInput {
  const { parsed, vehicleId, driverAppId, areaId, imageHashes, index } = opts;
  const now = new Date();

  let startedAt: Date;
  let endedAt: Date;
  if (parsed.startedAt) {
    startedAt = new Date(parsed.startedAt);
    endedAt = parsed.endedAt
      ? new Date(parsed.endedAt)
      : parsed.durationSec != null
      ? new Date(startedAt.getTime() + parsed.durationSec * 1000)
      : new Date(startedAt.getTime() + 60_000);
  } else if (parsed.durationSec != null) {
    // No start time on the screen — anchor the trip to "now ends".
    endedAt = now;
    startedAt = new Date(now.getTime() - parsed.durationSec * 1000);
  } else {
    startedAt = new Date(now.getTime() - 10 * 60_000); // assume 10 min trip
    endedAt = now;
  }
  if (endedAt.getTime() <= startedAt.getTime()) {
    endedAt = new Date(startedAt.getTime() + 60_000);
  }

  const grossEgp = parsed.grossEgp ?? parsed.receivedEgp ?? 0;
  const totalKm = parsed.totalKm ?? parsed.paidKm ?? 0;
  const paidKm = parsed.paidKm ?? parsed.totalKm ?? 0;

  const notesParts: string[] = [];
  if (imageHashes.length > 0) {
    const tag = index != null ? `ocrImageHashes=${imageHashes.join(',')};card=${index + 1}` : `ocrImageHashes=${imageHashes.join(',')}`;
    notesParts.push(tag);
  }
  if (parsed.pickup) notesParts.push(`from: ${parsed.pickup}`);
  if (parsed.destination) notesParts.push(`to: ${parsed.destination}`);
  const notes = notesParts.length > 0 ? notesParts.join('\n').slice(0, 500) : null;

  return {
    vehicleId,
    driverAppId,
    areaId: areaId ?? undefined,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    grossPiastres: toPiastres(grossEgp),
    receivedPiastres: parsed.receivedEgp != null ? toPiastres(parsed.receivedEgp) : undefined,
    tipPiastres: parsed.tipEgp != null ? toPiastres(parsed.tipEgp) : 0,
    commissionPiastres: parsed.commissionEgp != null ? toPiastres(parsed.commissionEgp) : 0,
    tollPiastres: parsed.tollEgp != null ? toPiastres(parsed.tollEgp) : 0,
    parkingPiastres: parsed.parkingEgp != null ? toPiastres(parsed.parkingEgp) : 0,
    totalKmMeters: Math.max(0, Math.round(totalKm * 1000)),
    paidKmMeters: Math.max(0, Math.round(paidKm * 1000)),
    notes,
  };
}

/**
 * Resolves which of the driver's connected apps best matches the OCR-detected
 * platform. Falls back to the first enabled app when no clean match exists
 * so the batch create still has a driverAppId to attach.
 */
export function findDriverAppForPlatform(
  apps: DriverApp[],
  platform: OcrPlatform | null,
): DriverApp | null {
  const enabled = apps.filter((a) => a.enabled !== false);
  if (enabled.length === 0) return null;
  if (!platform) return enabled[0];

  // appSource.name typically looks like "Uber", "inDrive", "DiDi", "Careem".
  // We accept either an exact (case-insensitive) match or a substring hit,
  // and also tolerate the user-provided customName ("My Uber").
  const wanted = platform.toLowerCase().replace(/\s+/g, '');
  const score = (a: DriverApp): number => {
    const sourceName = (a.appSource?.name ?? '').toLowerCase().replace(/\s+/g, '');
    const customName = (a.customName ?? '').toLowerCase().replace(/\s+/g, '');
    if (sourceName === wanted || customName === wanted) return 3;
    if (sourceName.includes(wanted) || customName.includes(wanted)) return 2;
    // Indrive shows up as "inDrive" → lowercase "indrive" matches "indrive".
    return 0;
  };
  const ranked = enabled.map((a) => ({ a, s: score(a) })).sort((x, y) => y.s - x.s);
  if (ranked[0]?.s > 0) return ranked[0].a;
  return enabled[0];
}

function toPiastres(egp: number): number {
  if (!Number.isFinite(egp)) return 0;
  return Math.max(0, Math.round(egp * 100));
}

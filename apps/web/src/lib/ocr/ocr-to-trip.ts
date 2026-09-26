import { CreateTripSchema, ocrConfirmationTripSchema, TripPaymentMethod, type OcrConfirmationFailure } from '@ehsbha/api-contracts';
import type { CreateTripInput, DriverApp } from '@/lib/api/endpoints';
import type { OcrPlatform, OcrTripResultDto } from '@/lib/api/ocr.api';
import { resolveTripFinancials } from '@ehsbha/shared-types';

export interface OcrSelectedTrip {
  candidate: OcrTripResultDto;
  vehicleId: string;
  driverAppId: string;
}

export interface OcrSaveOutcome { savedCandidateIds: string[]; failedCandidateIds: string[]; failures?: OcrConfirmationFailure[] }
export interface OcrTripValidation { input: CreateTripInput | null; issueKeys: string[] }

/** Validate evidence before conversion. Missing money, dates and distance stay missing. */
export function validateOcrTrip(selection: OcrSelectedTrip): OcrTripValidation {
  const { candidate, vehicleId, driverAppId } = selection;
  const parsed = candidate.parsed;
  const issues: string[] = [];
  if (!vehicleId) issues.push('vehicleRequired');
  if (!driverAppId) issues.push('appRequired');
  if (!candidate.evidence?.id) issues.push('sourceRequired');
  if (!parsed.startedAt || !parsed.endedAt) issues.push('timesRequired');
  if (parsed.totalKm == null || parsed.paidKm == null) issues.push('distanceRequired');
  const numericValues = [parsed.grossEgp, parsed.earningsEgp, parsed.receivedEgp, parsed.commissionEgp, parsed.tipEgp, parsed.tollEgp, parsed.parkingEgp, parsed.waitingFeeEgp, parsed.totalKm, parsed.paidKm, parsed.durationSec];
  if (numericValues.some((value) => value != null && (!Number.isFinite(value) || value < 0))) issues.push('inconsistentValues');
  if (parsed.grossEgp != null && parsed.commissionEgp != null && parsed.commissionEgp > parsed.grossEgp) issues.push('inconsistentValues');
  if (parsed.startedAt && parsed.endedAt && parsed.durationSec != null) {
    const elapsed = (Date.parse(parsed.endedAt) - Date.parse(parsed.startedAt)) / 1000;
    if (parsed.durationSec <= 0 || Math.abs(elapsed - parsed.durationSec) > 60) issues.push('durationMismatch');
  }
  if (issues.length) return { input: null, issueKeys: issues };
  const input: CreateTripInput = {
    vehicleId, driverAppId, clientMutationId: candidate.evidence?.id,
    startedAt: parsed.startedAt ?? '', endedAt: parsed.endedAt ?? '',
    grossPiastres: parsed.grossEgp == null ? null : piastres(parsed.grossEgp),
    commissionPiastres: parsed.commissionEgp == null ? null : piastres(parsed.commissionEgp),
    earningsPiastres: parsed.earningsEgp == null ? null : piastres(parsed.earningsEgp),
    receivedPiastres: parsed.receivedEgp == null ? null : piastres(parsed.receivedEgp),
    tipPiastres: piastres(parsed.tipEgp), tollPiastres: piastres(parsed.tollEgp), parkingPiastres: piastres(parsed.parkingEgp),
    totalKmMeters: Math.round((parsed.totalKm ?? 0) * 1000), paidKmMeters: Math.round((parsed.paidKm ?? 0) * 1000),
    notes: parsed.notes, pickup: parsed.pickup, destination: parsed.destination,
    paymentMethod: Object.values(TripPaymentMethod).find((method) => method === parsed.paymentMethod) ?? TripPaymentMethod.Unknown,
    waitingFeePiastres: parsed.waitingFeeEgp == null ? null : piastres(parsed.waitingFeeEgp),
  };
  if (!resolveTripFinancials({ ...input, commissionPiastres: input.commissionPiastres ?? null, tipPiastres: input.tipPiastres ?? 0 })) return { input: null, issueKeys: ['financialConflict'] };
  if (!CreateTripSchema.safeParse(input).success) return { input: null, issueKeys: ['inconsistentValues'] };
  const { clientMutationId: _mutationId, ...confirmation } = input;
  if (!ocrConfirmationTripSchema.safeParse(confirmation).success) return { input: null, issueKeys: ['financialConflict'] };
  return { input, issueKeys: [] };
}

/** A matching source is required; an arbitrary first app can corrupt analytics. */
export function findDriverAppForPlatform(apps: DriverApp[], platform: OcrPlatform | null): DriverApp | null {
  if (!platform) return null;
  const wanted = platform.toLowerCase().replace(/\s+/g, '');
  const matches = apps.filter((app) => app.enabled &&
    (app.appSource?.name ?? app.customName ?? '').toLowerCase().replace(/\s+/g, '') === wanted);
  return matches.length === 1 ? matches[0] : null;
}

function piastres(value: number | null): number {
  return Math.round((value ?? 0) * 100);
}

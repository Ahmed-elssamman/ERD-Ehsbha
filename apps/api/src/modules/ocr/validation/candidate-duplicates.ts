import { OcrCandidateStatus, type OcrTripResult } from '@ehsbha/api-contracts';

/** Conservative overlap matching. Equal fares alone never identify a trip. */
export function markCandidateDuplicates(trips: OcrTripResult[]): void {
  const seen = new Map<string, string>();
  for (const trip of trips) {
    const evidence = trip.evidence;
    const parsed = trip.parsed;
    if (!evidence?.platform || !parsed.startedAt || (trip.fieldConfidences.startedAt ?? 0) < 0.8) continue;
    const amount = parsed.grossEgp ?? parsed.receivedEgp;
    const amountField = parsed.grossEgp == null ? 'receivedEgp' : 'grossEgp';
    if (amount == null || (trip.fieldConfidences[amountField] ?? 0) < 0.8) continue;
    if (parsed.paidKm == null || (trip.fieldConfidences.paidKm ?? 0) < 0.8) continue;
    const key = JSON.stringify([evidence.platform, parsed.startedAt, parsed.endedAt, amountField, amount, parsed.paidKm, parsed.pickup, parsed.destination]);
    const duplicateOf = seen.get(key);
    if (duplicateOf) {
      evidence.status = OcrCandidateStatus.Duplicate;
      evidence.duplicateOf = duplicateOf;
      evidence.warnings.push('OCR_DUPLICATE_TRIP');
    } else seen.set(key, evidence.id);
  }
}

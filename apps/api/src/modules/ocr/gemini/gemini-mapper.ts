import { createHash } from 'node:crypto';
import { OcrCandidateStatus, type OcrDocumentResult, type OcrPlatform, type OcrStructuredTrip } from '@ehsbha/api-contracts';
import { localDateTimeToUtc } from '@ehsbha/shared-types';
import { EMPTY_PARSED, type OcrTripResultDto } from '../dto/ocr.dto';
import { TripValidator } from '../validation/trip-validator';
import { GEMINI_PLATFORM_MAP } from './gemini-mapper.control';

export function mapGeminiTrip(
  trip: OcrStructuredTrip, document: OcrDocumentResult, index: number,
  hint: OcrPlatform | null, validator: TripValidator,
): OcrTripResultDto {
  const platform = GEMINI_PLATFORM_MAP[trip.platform];
  const fare = trip.fare_details;
  const metrics = trip.trip_metrics;
  const egp = fare.currency === 'EGP';
  const startedAt = metrics.trip_date && metrics.trip_time
    ? localDateTimeToUtc(`${metrics.trip_date}T${metrics.trip_time}`) : null;
  const durationSec = metrics.duration_minutes === null ? null : Math.round(metrics.duration_minutes * 60);
  const end = startedAt && durationSec !== null ? new Date(new Date(startedAt).getTime() + durationSec * 1000) : null;
  const parsed = {
    ...EMPTY_PARSED, appHint: platform, startedAt,
    endedAt: end && Number.isFinite(end.getTime()) ? end.toISOString() : null, durationSec,
    grossEgp: egp ? fare.total_fare : null,
    earningsEgp: egp ? fare.net_earnings : null,
    receivedEgp: egp ? fare.cash_collected : null,
    commissionEgp: egp ? fare.app_commission : null,
    tipEgp: egp ? fare.tip : null, tollEgp: egp ? fare.toll_fees : null,
    // Screenshot trip distance does not establish the driver's total distance including pickup.
    paidKm: metrics.distance_km,
    pickup: trip.route.pickup_location, destination: trip.route.dropoff_location,
  };
  const warnings = ['OCR_EXTRACTED_REVIEW', ...validator.validate(parsed)];
  if (!platform) warnings.push('OCR_PLATFORM_UNKNOWN');
  if (platform && hint && platform !== hint) warnings.push('OCR_PLATFORM_HINT_CONFLICT');
  if (!egp) warnings.push('OCR_CURRENCY_REVIEW');
  const fieldConfidences: Record<string, number> = {};
  for (const [field, value] of Object.entries(parsed)) {
    if (value !== null && value !== 'unknown') fieldConfidences[field] = trip.confidence_score;
  }
  return {
    parsed, fieldConfidences,
    evidence: {
      id: createHash('sha256').update(`${document.imageHash}:${index + 1}`).digest('hex'),
      platform, platformConfidence: trip.confidence_score, status: OcrCandidateStatus.Review,
      duplicateOf: null, warnings: [...new Set(warnings)], rawText: document.rawText,
      extractions: [trip],
      sources: [{ documentId: document.id, imageHash: document.imageHash, lineStart: 0, lineEnd: document.rawText.split('\n').length }],
    },
  };
}

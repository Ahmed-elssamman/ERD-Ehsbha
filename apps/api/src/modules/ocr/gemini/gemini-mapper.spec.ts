import { OcrCandidateStatus, OcrDocumentStatus, ocrTripResultSchema, ocrStructuredTripSchema } from '@ehsbha/api-contracts';
import { mapGeminiTrip } from './gemini-mapper';
import { GEMINI_TEST_DOCUMENT, GEMINI_TEST_TRIP } from './gemini-test.data';
import { TripValidator } from '../validation/trip-validator';
import { MultiScreenshotMerger } from '../merge/multi-screenshot.merger';

describe('Gemini trip financial and evidence mapping', () => {
  const document = {
    id: 'document-1', imageHash: 'a'.repeat(64), index: 0, status: OcrDocumentStatus.Completed,
    duplicateOf: null, errorCode: null, rawText: GEMINI_TEST_DOCUMENT.raw_text, candidateIds: [],
  };
  const map = (trip = GEMINI_TEST_TRIP) => mapGeminiTrip(trip, document, 0, null, new TripValidator());

  it('keeps passenger fare, net earnings, cash and commission separate', () => {
    const result = map();
    expect(result.parsed).toMatchObject({ grossEgp: 24.4, earningsEgp: 20.96, receivedEgp: 20, commissionEgp: 3.44, tipEgp: null });
    expect(result.evidence?.extractions?.[0]).toEqual(GEMINI_TEST_TRIP);
    expect(result.evidence?.status).toBe(OcrCandidateStatus.Review);
    expect(ocrTripResultSchema.safeParse(result).success).toBe(true);
  });

  it('uses Cairo daylight saving rules, converts seconds and does not invent pickup distance', () => {
    expect(map().parsed).toMatchObject({ startedAt: '2026-05-16T17:09:00.000Z', endedAt: '2026-05-16T17:18:02.000Z', durationSec: 542, paidKm: 2.8, totalKm: null });
  });

  it('does not import foreign or unconfirmed currency as EGP', () => {
    for (const currency of ['USD', null]) {
      const trip = structuredClone(GEMINI_TEST_TRIP);
      trip.fare_details.currency = currency;
      const result = map(trip);
      expect(result.parsed).toMatchObject({ grossEgp: null, earningsEgp: null, receivedEgp: null, commissionEgp: null });
      expect(result.evidence?.warnings).toContain('OCR_CURRENCY_REVIEW');
      expect(result.evidence?.extractions?.[0].fare_details.total_fare).toBe(24.4);
    }
  });

  it('leaves absent dates, fares and cash empty even when net earnings are visible', () => {
    const trip = structuredClone(GEMINI_TEST_TRIP);
    trip.trip_metrics.trip_date = null;
    trip.fare_details.total_fare = null;
    trip.fare_details.cash_collected = null;
    expect(map(trip).parsed).toMatchObject({ startedAt: null, endedAt: null, grossEgp: null, receivedEgp: null, earningsEgp: 20.96 });
  });

  it('preserves net earnings while merging partial screenshots', () => {
    const first = map();
    const merged = new MultiScreenshotMerger().merge([
      { fields: first.parsed, perField: first.fieldConfidences, warnings: [] },
      { fields: { pickup: 'Cairo' }, perField: { pickup: 0.9 }, warnings: [] },
    ]);
    expect(merged.parsed).toMatchObject({ grossEgp: 24.4, earningsEgp: 20.96, receivedEgp: 20 });
  });

  it('rejects impossible dates, nonfinite values and unsupported platform values', () => {
    const trip = structuredClone(GEMINI_TEST_TRIP);
    trip.trip_metrics.trip_date = '2026-02-30';
    expect(ocrStructuredTripSchema.safeParse(trip).success).toBe(false);
    expect(ocrStructuredTripSchema.safeParse({ ...GEMINI_TEST_TRIP, confidence_score: Infinity }).success).toBe(false);
    expect(ocrStructuredTripSchema.safeParse({ ...GEMINI_TEST_TRIP, platform: 'invented' }).success).toBe(false);
  });
});

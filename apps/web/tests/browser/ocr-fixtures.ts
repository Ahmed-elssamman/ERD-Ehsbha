import { OcrCandidateStatus, OcrDocumentStatus, type OcrExtractResponse, type OcrParsedTrip, type OcrTripResult } from '@ehsbha/api-contracts';

export const browserDriver = { id: 'test-driver-user', driverId: 'test-driver', phone: '+201000000001', locale: 'en', timezone: 'Africa/Cairo' };
export const browserVehicles = [{ id: 'vehicle-1', type: 'CAR', make: 'Test', model: 'Car', fuelType: 'PETROL_92', tankLiters: 40, baselineKmPerLiter: 12, odometerMeters: 1000, odometerSource: 'MANUAL', odometerVersion: 1, odometerSourceId: null, odometerAsOf: null, isActive: true }];
export const browserApps = [{ id: 'app-uber', appSourceId: 'uber', customName: null, color: null, commissionPct: 15, enabled: true, appSource: { id: 'uber', name: 'Uber', defaultCommissionPct: 15 } }];
export const browserImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

export function responseEnvelope<T>(data: T) {
  return { data, meta: { requestId: 'browser-request-000001', serverTime: '2026-09-17T00:00:00.000Z', apiVersion: 'v1', contractVersion: '2.0.0' } };
}

export function browserCandidate(index: number): OcrTripResult {
  const parsed: OcrParsedTrip = {
    vehicleType: null, appHint: 'Uber', startedAt: '2026-09-16T14:00:00.000Z', endedAt: '2026-09-16T14:20:00.000Z',
    durationSec: 1200, grossEgp: 100, receivedEgp: 85, commissionEgp: 15, tipEgp: null, tollEgp: null,
    parkingEgp: null, waitingFeeEgp: null, totalKm: 10, paidKm: 10, pickup: null, destination: null, paymentMethod: 'cash', notes: null,
  };
  return { parsed, fieldConfidences: { grossEgp: 0.99 }, evidence: {
    id: index.toString(16).padStart(64, '0'), platform: 'UBER', platformConfidence: 1,
    status: OcrCandidateStatus.Ready, duplicateOf: null, warnings: [], rawText: 'Uber\nGross 100 EGP\nCommission 15 EGP', sources: [],
  } };
}

export function browserExtraction(trips: OcrTripResult[] = [browserCandidate(1), browserCandidate(2)]): OcrExtractResponse {
  return {
    mode: 'auto', platform: 'UBER', platformConfidence: 1, trips,
    parsed: trips[0].parsed, fieldConfidences: {}, warnings: [], imageHashes: ['a'.repeat(64)],
    rawTextLengths: [20], ocrMeanConfidence: 0.99,
    documents: [{ id: 'doc-1', imageHash: 'a'.repeat(64), index: 0, status: OcrDocumentStatus.Completed, errorCode: null, duplicateOf: null, rawText: 'test receipt', candidateIds: trips.map((trip) => trip.evidence?.id ?? '') }],
  };
}

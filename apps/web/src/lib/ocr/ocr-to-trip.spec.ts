import { describe, expect, it } from 'vitest';
import { OcrCandidateStatus, ocrParsedTripSchema } from '@ehsbha/api-contracts';
import { findDriverAppForPlatform, validateOcrTrip, type OcrSelectedTrip } from './ocr-to-trip';
import type { DriverApp } from '@/lib/api/endpoints';

function selection(): OcrSelectedTrip {
  const parsed = ocrParsedTripSchema.parse({
    vehicleType: null, appHint: null, startedAt: '2026-05-16T14:30:00.000Z', endedAt: '2026-05-16T15:00:00.000Z',
    durationSec: 1800, grossEgp: 100.25, receivedEgp: 85.25, tipEgp: null, commissionEgp: 15,
    tollEgp: null, parkingEgp: null, waitingFeeEgp: null, totalKm: 12.5, paidKm: 10,
    pickup: null, destination: null, paymentMethod: 'cash', notes: null,
  });
  return { vehicleId: 'vehicle-1', driverAppId: 'app-1', candidate: { parsed, fieldConfidences: {}, evidence: {
    id: 'a'.repeat(64), platform: 'UBER', platformConfidence: 1, status: OcrCandidateStatus.Review,
    duplicateOf: null, sources: [], warnings: [], rawText: '',
  } } };
}

describe('OCR save integrity', () => {
  it('converts money and distance without changing the evidence or mutation ID', () => {
    const result = validateOcrTrip(selection());
    expect(result.issueKeys).toEqual([]);
    expect(result.input).toMatchObject({ grossPiastres: 10025, receivedPiastres: 8525, commissionPiastres: 1500, totalKmMeters: 12500, paidKmMeters: 10000, clientMutationId: 'a'.repeat(64) });
  });
  it.each(['startedAt', 'endedAt', 'totalKm', 'paidKm'] as const)('blocks a missing %s instead of making one up', (field) => {
    const draft = selection();
    draft.candidate.parsed[field] = null;
    expect(validateOcrTrip(draft).input).toBeNull();
  });
  it('rejects inconsistent money, distance and timestamps rather than clamping', () => {
    const draft = selection();
    draft.candidate.parsed.receivedEgp = 200;
    expect(validateOcrTrip(draft).input).toBeNull();
    draft.candidate.parsed.receivedEgp = 85;
    draft.candidate.parsed.paidKm = 50;
    expect(validateOcrTrip(draft).input).toBeNull();
    draft.candidate.parsed.paidKm = 10;
    draft.candidate.parsed.endedAt = draft.candidate.parsed.startedAt;
    expect(validateOcrTrip(draft).input).toBeNull();
  });
  it('does not turn net-only earnings into gross fare or zero commission', () => {
    const draft = selection();
    draft.candidate.parsed.grossEgp = null;
    draft.candidate.parsed.commissionEgp = null;
    draft.candidate.parsed.receivedEgp = null;
    draft.candidate.parsed.earningsEgp = 85;
    draft.candidate.parsed.tipEgp = 5;
    expect(validateOcrTrip(draft).input).toMatchObject({ grossPiastres: null, commissionPiastres: null, earningsPiastres: 8500, tipPiastres: 500 });
  });
  it('rejects missing income and tips greater than the take-home total', () => {
    const draft = selection();
    draft.candidate.parsed.grossEgp = null;
    draft.candidate.parsed.commissionEgp = null;
    draft.candidate.parsed.receivedEgp = null;
    expect(validateOcrTrip(draft).input).toBeNull();
    draft.candidate.parsed.earningsEgp = 5;
    draft.candidate.parsed.tipEgp = 10;
    expect(validateOcrTrip(draft).input).toBeNull();
  });
  it.each(['grossEgp', 'commissionEgp'] as const)('allows deriving %s from explicit remaining facts', (field) => {
    const draft = selection();
    draft.candidate.parsed[field] = null;
    expect(validateOcrTrip(draft).issueKeys).toEqual([]);
  });
  it('rejects an explicit commission that conflicts with received income', () => {
    const draft = selection();
    draft.candidate.parsed.commissionEgp = 14;
    expect(validateOcrTrip(draft).issueKeys).toEqual(['financialConflict']);
  });
  it('preserves route and payment fields without changing fare or packing the route into notes', () => {
    const draft = selection();
    draft.candidate.parsed.pickup = 'Pickup'; draft.candidate.parsed.destination = 'Destination';
    draft.candidate.parsed.waitingFeeEgp = 5; draft.candidate.parsed.notes = 'Driver note';
    expect(validateOcrTrip(draft).input).toMatchObject({ pickup: 'Pickup', destination: 'Destination', paymentMethod: 'cash', waitingFeePiastres: 500, grossPiastres: 10025, notes: 'Driver note' });
  });
  it('rejects tiny negative values before unit rounding can turn them into zero', () => {
    const draft = selection();
    draft.candidate.parsed.commissionEgp = -0.001;
    expect(validateOcrTrip(draft).input).toBeNull();
    draft.candidate.parsed.commissionEgp = 15;
    draft.candidate.parsed.paidKm = -0.0001;
    expect(validateOcrTrip(draft).input).toBeNull();
  });
  it('requires duration and timestamps to agree within source minute precision', () => {
    const draft = selection();
    draft.candidate.parsed.durationSec = 60;
    expect(validateOcrTrip(draft).issueKeys).toContain('durationMismatch');
  });
  it('requires an explicit app and vehicle choice', () => {
    const draft = selection();
    draft.vehicleId = ''; draft.driverAppId = '';
    expect(validateOcrTrip(draft).issueKeys).toEqual(['vehicleRequired', 'appRequired']);
  });
  it('does not choose a first, disabled or ambiguous app', () => {
    const app: DriverApp = { id: '1', appSourceId: null, customName: 'Uber', enabled: true, color: null, commissionPct: 15 };
    expect(findDriverAppForPlatform([app], 'CAREEM')).toBeNull();
    expect(findDriverAppForPlatform([app], null)).toBeNull();
    expect(findDriverAppForPlatform([{ ...app, enabled: false }], 'UBER')).toBeNull();
    expect(findDriverAppForPlatform([app, { ...app, id: '2' }], 'UBER')).toBeNull();
    expect(findDriverAppForPlatform([app], 'UBER')?.id).toBe('1');
  });
});

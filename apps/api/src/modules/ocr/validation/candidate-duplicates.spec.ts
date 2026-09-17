import { OcrCandidateStatus, type OcrTripResult } from '@ehsbha/api-contracts';
import { EMPTY_PARSED } from '../dto/ocr.dto';
import { markCandidateDuplicates } from './candidate-duplicates';

function candidate(id: string): OcrTripResult {
  return {
    parsed: { ...EMPTY_PARSED, grossEgp: 85, startedAt: '2026-05-16T14:00:00.000Z', endedAt: '2026-05-16T14:20:00.000Z', paidKm: 10 },
    fieldConfidences: { grossEgp: 0.9, startedAt: 0.9, paidKm: 0.9 },
    evidence: { id, platform: 'UBER', platformConfidence: 1, status: OcrCandidateStatus.Review, duplicateOf: null, sources: [], warnings: [], rawText: '' },
  };
}

describe('OCR overlap candidates', () => {
  it('marks corroborated duplicates and keeps the evidence available for review', () => {
    const trips = [candidate('first'), candidate('second')];
    markCandidateDuplicates(trips);
    expect(trips[1].evidence).toMatchObject({ status: OcrCandidateStatus.Duplicate, duplicateOf: 'first' });
    expect(trips).toHaveLength(2);
  });

  it('does not deduplicate equal fares without reliable date and distance', () => {
    const trips = [candidate('first'), candidate('second')];
    trips[1].parsed.startedAt = null;
    markCandidateDuplicates(trips);
    expect(trips[1].evidence?.duplicateOf).toBeNull();
    trips[1].parsed.startedAt = trips[0].parsed.startedAt;
    trips[1].fieldConfidences.paidKm = 0.4;
    markCandidateDuplicates(trips);
    expect(trips[1].evidence?.duplicateOf).toBeNull();
  });

  it('keeps different times, platforms and amount semantics separate', () => {
    const trips = [candidate('first'), candidate('second'), candidate('third'), candidate('fourth')];
    trips[1].parsed.startedAt = '2026-05-16T15:00:00.000Z';
    if (trips[2].evidence) trips[2].evidence.platform = 'DIDI';
    trips[3].parsed.grossEgp = null;
    trips[3].parsed.receivedEgp = 85;
    trips[3].fieldConfidences.receivedEgp = 0.9;
    markCandidateDuplicates(trips);
    expect(trips.every((trip) => trip.evidence?.duplicateOf === null)).toBe(true);
  });
});

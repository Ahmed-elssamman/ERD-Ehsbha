import { AnthropicVisionProvider } from './anthropic-vision.provider';

describe('AnthropicVisionProvider.toStructured', () => {
  // Tests the pure tool-input → OcrStructuredResult mapper without hitting the API.
  const provider = new AnthropicVisionProvider('test-key', 'claude-haiku-4-5-20251001');

  const baseInput = {
    platform: 'UBER' as const,
    platformConfidence: 0.95,
    meanConfidence: 0.93,
    vehicleType: 'scooter',
    startedAt: '2026-05-18T22:46:00.000Z',
    endedAt: null,
    durationSec: 701,
    grossEgp: 27.04,
    receivedEgp: 28.0,
    commissionEgp: null,
    tipEgp: null,
    tollEgp: null,
    parkingEgp: null,
    waitingFeeEgp: 0.96,
    totalKm: 5.7,
    paidKm: null,
    pickup: 'Nasr City 4455020 EG',
    destination: 'Ahmed El-Zomor Nasr City 11765 EG',
    paymentMethod: 'cash' as const,
    notes: 'Waiting fee detected',
    fieldConfidences: {
      grossEgp: 0.94,
      receivedEgp: 0.92,
      totalKm: 0.95,
      startedAt: 0.9,
      durationSec: 0.88,
    },
  };

  it('maps tool input to OcrParsedTripDto', () => {
    const r = provider.toStructured(baseInput);
    expect(r.parsed.grossEgp).toBe(27.04);
    expect(r.parsed.receivedEgp).toBe(28.0);
    expect(r.parsed.totalKm).toBe(5.7);
    expect(r.parsed.durationSec).toBe(701);
    expect(r.parsed.startedAt).toBe('2026-05-18T22:46:00.000Z');
    expect(r.parsed.pickup).toBe('Nasr City 4455020 EG');
    expect(r.parsed.paymentMethod).toBe('cash');
  });

  it('defaults paidKm to totalKm when null', () => {
    const r = provider.toStructured(baseInput);
    expect(r.parsed.paidKm).toBe(5.7);
  });

  it('preserves explicit paidKm when provided', () => {
    const r = provider.toStructured({ ...baseInput, paidKm: 4.2 });
    expect(r.parsed.paidKm).toBe(4.2);
  });

  it('extracts platform + confidence', () => {
    const r = provider.toStructured(baseInput);
    expect(r.platform).toBe('UBER');
    expect(r.platformConfidence).toBeCloseTo(0.95, 2);
    expect(r.meanConfidence).toBeCloseTo(0.93, 2);
  });

  it('clamps confidences to [0,1]', () => {
    const r = provider.toStructured({
      ...baseInput,
      platformConfidence: 1.5,
      meanConfidence: -0.2,
      fieldConfidences: { grossEgp: 2.0, totalKm: -0.5 },
    });
    expect(r.platformConfidence).toBe(1);
    expect(r.meanConfidence).toBe(0);
    expect(r.fieldConfidences.grossEgp).toBe(1);
    expect(r.fieldConfidences.totalKm).toBe(0);
  });

  it('serializes a debug-text representation', () => {
    const r = provider.toStructured(baseInput);
    expect(r.text).toContain('gross=27.04 EGP');
    expect(r.text).toContain('received=28 EGP');
    expect(r.text).toContain('distance=5.7 km');
  });

  it('handles all-null input without crashing', () => {
    const r = provider.toStructured({
      platform: null,
      platformConfidence: 0,
      meanConfidence: 0,
      vehicleType: null,
      startedAt: null,
      endedAt: null,
      durationSec: null,
      grossEgp: null,
      receivedEgp: null,
      commissionEgp: null,
      tipEgp: null,
      tollEgp: null,
      parkingEgp: null,
      waitingFeeEgp: null,
      totalKm: null,
      paidKm: null,
      pickup: null,
      destination: null,
      paymentMethod: 'unknown' as const,
      notes: null,
      fieldConfidences: {},
    });
    expect(r.parsed.grossEgp).toBeNull();
    expect(r.parsed.totalKm).toBeNull();
    expect(r.platform).toBeNull();
  });
});

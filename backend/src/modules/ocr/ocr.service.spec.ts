import { OcrService } from './ocr.service';
import { SharpProcessor } from './image-processing/sharp.processor';
import { PlatformDetector } from './detectors/platform.detector';
import { UberParser } from './parsers/uber.parser';
import { IndriveParser } from './parsers/indrive.parser';
import { DidiParser } from './parsers/didi.parser';
import { CareemParser } from './parsers/careem.parser';
import { MultiScreenshotMerger } from './merge/multi-screenshot.merger';
import { ConfidenceScorer } from './confidence/scorer';
import { TripValidator } from './validation/trip-validator';
import { SemanticNormalizer } from './semantic/normalizer';
import { OcrProvider, OcrStructuredResult } from './engines/ocr-provider.interface';

describe('OcrService.assembleStructured', () => {
  const normalizer = new SemanticNormalizer();
  const fakeProvider: OcrProvider = {
    recognize: async () => ({ text: '', words: [], meanConfidence: 0 }),
    warmUp: async () => undefined,
    dispose: async () => undefined,
  };

  const svc = new OcrService(
    fakeProvider,
    new SharpProcessor(),
    new PlatformDetector(normalizer),
    new MultiScreenshotMerger(),
    new ConfidenceScorer(),
    new TripValidator(),
    new UberParser(normalizer),
    new IndriveParser(normalizer),
    new DidiParser(normalizer),
    new CareemParser(normalizer),
  );

  const sample: OcrStructuredResult = {
    text: '',
    parsed: {
      vehicleType: 'scooter',
      appHint: 'UBER',
      startedAt: '2026-05-18T22:46:00.000Z',
      endedAt: null,
      durationSec: 701,
      grossEgp: 27.04,
      receivedEgp: 28.0,
      tipEgp: null,
      commissionEgp: null,
      tollEgp: null,
      parkingEgp: null,
      waitingFeeEgp: 0.96,
      totalKm: 5.7,
      paidKm: 5.7,
      pickup: 'Nasr City 4455020 EG',
      destination: 'Ahmed El-Zomor Nasr City 11765 EG',
      paymentMethod: 'cash',
      notes: 'Waiting fee detected',
    },
    platform: 'UBER',
    platformConfidence: 0.95,
    fieldConfidences: { grossEgp: 0.94, totalKm: 0.95, startedAt: 0.9, receivedEgp: 0.92 },
    meanConfidence: 0.93,
  };

  it('preserves LLM-extracted fields', () => {
    const r = svc.assembleStructured([sample], ['a'.repeat(64)]);
    expect(r.parsed.grossEgp).toBe(27.04);
    expect(r.parsed.receivedEgp).toBe(28.0);
    expect(r.parsed.totalKm).toBe(5.7);
    expect(r.parsed.startedAt).toBe('2026-05-18T22:46:00.000Z');
    expect(r.platform).toBe('UBER');
  });

  it('passes confidences through scorer', () => {
    const r = svc.assembleStructured([sample], ['a'.repeat(64)]);
    expect(r.fieldConfidences.grossEgp).toBeGreaterThan(0.7);
  });

  it('merges multiple structured results', () => {
    const a = { ...sample };
    const b = { ...sample, fieldConfidences: { ...sample.fieldConfidences, grossEgp: 0.99 }, parsed: { ...sample.parsed, grossEgp: 27.04 } };
    const r = svc.assembleStructured([a, b], ['a'.repeat(64), 'b'.repeat(64)]);
    expect(r.parsed.grossEgp).toBe(27.04);
    expect(r.fieldConfidences.grossEgp).toBeGreaterThan(0.85);
  });

  it('flags unknown platform', () => {
    const noPlatform = { ...sample, platform: null, platformConfidence: 0 };
    const r = svc.assembleStructured([noPlatform], ['a'.repeat(64)]);
    expect(r.warnings).toContain('OCR_PLATFORM_UNKNOWN');
  });
});

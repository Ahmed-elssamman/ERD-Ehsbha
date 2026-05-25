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
import { AzureVisionProvider } from './azure/azure-vision.provider';
import type { OcrResult } from './types';
import type { RawParsed } from './parsers/base.parser';

/**
 * Tests `OcrService.assemble` — the pure pipeline stage that receives the
 * per-image evidence array and returns the response DTO. The Azure calls are
 * not exercised here (they're tested in azure-vision.client.spec.ts /
 * azure-document-intelligence.client.spec.ts).
 */
describe('OcrService.assemble', () => {
  const normalizer = new SemanticNormalizer();
  const fakeAzure = {
    analyze: async () => ({ read: emptyRead(), receipt: null }),
  } as unknown as AzureVisionProvider;

  const svc = new OcrService(
    fakeAzure,
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

  function ev(text: string, parsed: Partial<RawParsed>): { read: OcrResult; parsed: RawParsed } {
    const read: OcrResult = {
      text,
      lines: text.split('\n').map((t) => ({
        text: t,
        bbox: { x: 0, y: 0, w: 100, h: 20 },
        words: [],
        meanConfidence: 0.92,
      })),
      words: [],
      meanConfidence: 0.92,
    };
    return {
      read,
      parsed: {
        fields: parsed.fields ?? {},
        perField: parsed.perField ?? {},
        warnings: parsed.warnings ?? [],
      },
    };
  }

  it('returns the platform and confidence-scored fields from a single image', () => {
    const r = svc.assemble(
      [
        ev('Uber\nالأجرة 31.81\nالدخل 27.04', {
          fields: { grossEgp: 31.81, receivedEgp: 27.04, totalKm: 5.7 },
          perField: { grossEgp: 0.94, receivedEgp: 0.93, totalKm: 0.95 },
        }),
      ],
      ['a'.repeat(64)],
    );
    expect(r.platform).toBe('UBER');
    expect(r.parsed.grossEgp).toBe(31.81);
    expect(r.parsed.receivedEgp).toBe(27.04);
    expect(r.fieldConfidences.grossEgp).toBeGreaterThan(0.7);
  });

  it('merges multiple screenshots with the same fields', () => {
    const a = ev('Uber\nالأجرة 31.81', {
      fields: { grossEgp: 31.81 },
      perField: { grossEgp: 0.9 },
    });
    const b = ev('Uber\nالأجرة 31.81', {
      fields: { grossEgp: 31.81 },
      perField: { grossEgp: 0.95 },
    });
    const r = svc.assemble([a, b], ['a'.repeat(64), 'b'.repeat(64)]);
    expect(r.parsed.grossEgp).toBe(31.81);
    expect(r.fieldConfidences.grossEgp).toBeGreaterThan(0.8);
  });

  it('emits OCR_PLATFORM_UNKNOWN when the brand cannot be identified', () => {
    const r = svc.assemble(
      [ev('mystery app\n42.00', { fields: { grossEgp: 42 }, perField: { grossEgp: 0.5 } })],
      ['a'.repeat(64)],
    );
    expect(r.platform).toBeNull();
    expect(r.warnings).toContain('OCR_PLATFORM_UNKNOWN');
  });
});

function emptyRead(): OcrResult {
  return { text: '', lines: [], words: [], meanConfidence: 0 };
}

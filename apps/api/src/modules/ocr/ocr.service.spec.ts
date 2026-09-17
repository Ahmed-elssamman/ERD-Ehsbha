import { OcrCandidateStatus, OcrDocumentStatus, ocrExtractResponseSchema } from '@ehsbha/api-contracts';
import { OcrService, OcrImageUpload } from './ocr.service';
import { SharpProcessor } from './image-processing/sharp.processor';
import { PlatformDetector } from './detectors/platform.detector';
import { UberParser } from './parsers/uber.parser';
import { IndriveParser } from './parsers/indrive.parser';
import { DidiParser } from './parsers/didi.parser';
import { CareemParser } from './parsers/careem.parser';
import { MultiScreenshotMerger } from './merge/multi-screenshot.merger';
import { MultiTripSplitter } from './merge/multi-trip.splitter';
import { ConfidenceScorer } from './confidence/scorer';
import { TripValidator } from './validation/trip-validator';
import { SemanticNormalizer } from './semantic/normalizer';
import { OcrRecognitionProvider } from './ocr-recognition.provider';
import { OcrWorkLimiter } from './ocr-work-limiter';
import type { ImageSignals } from './types';

class TestImageProcessor extends SharpProcessor {
  override async prepare(buffer: Buffer): Promise<Buffer> { return buffer; }
}

class TestRecognitionProvider extends OcrRecognitionProvider {
  calls = 0;
  active = 0;
  peak = 0;
  override async recognize(image: Buffer): Promise<ImageSignals> {
    this.calls += 1;
    this.active += 1;
    this.peak = Math.max(this.peak, this.active);
    await new Promise<void>((resolve) => setImmediate(resolve));
    this.active -= 1;
    const text = image.toString().split('\n').slice(1).join('\n');
    if (text === 'FAIL') throw new Error('Private upstream response must not escape');
    const lines = text.split('\n').map((value, index) => ({
      text: value, meanConfidence: 0.98, bbox: { x: 0, y: index * 20, w: 100, h: 20 },
      words: [{ text: value, confidence: 0.98, bbox: { x: 0, y: index * 20, w: 100, h: 20 } }],
    }));
    return { read: { text, lines, words: lines.flatMap((line) => line.words), meanConfidence: 0.98 }, receipt: null };
  }
}

function upload(text: string, identity = 'image'): OcrImageUpload {
  const buffer = Buffer.from(`${identity}\n${text}`);
  return { buffer, size: buffer.length, mimetype: 'image/png' };
}

describe('OCR document capture', () => {
  let provider: TestRecognitionProvider;
  let service: OcrService;
  beforeEach(() => {
    const normalizer = new SemanticNormalizer();
    provider = new TestRecognitionProvider();
    service = new OcrService(
      provider, new TestImageProcessor(), new PlatformDetector(normalizer), new MultiScreenshotMerger(),
      new MultiTripSplitter(), new ConfidenceScorer(), new TripValidator(), new UberParser(normalizer),
      new IndriveParser(normalizer), new DidiParser(normalizer), new CareemParser(normalizer), new OcrWorkLimiter(),
    );
  });

  it('detects a platform independently for each image without a hint', async () => {
    const result = await service.extract([upload('Uber\nالأجرة 85.00 ج.م.'), upload('Careem\ncustomer pays EGP 100.00')]);
    expect(result.mode).toBe('auto');
    expect(result.platform).toBeNull();
    expect(result.trips.map((trip) => trip.evidence?.platform)).toEqual(['UBER', 'CAREEM']);
    expect(result.trips.map((trip) => trip.parsed.grossEgp)).toEqual([85, 100]);
    expect(ocrExtractResponseSchema.safeParse(result).success).toBe(true);
  });

  it('retains unknown-platform text without assigning another platform parser', async () => {
    const result = await service.extract([upload('unfamiliar receipt\n85.00 EGP')]);
    expect(result.trips[0].evidence).toMatchObject({ platform: null, status: OcrCandidateStatus.Review, rawText: 'unfamiliar receipt\n85.00 EGP' });
    expect(result.trips[0].parsed.grossEgp).toBeNull();
    expect(result.warnings).toContain('OCR_PLATFORM_UNKNOWN');
  });

  it('preserves successful documents and safe error codes after provider failure', async () => {
    const result = await service.extract([upload('FAIL'), upload('Uber\nالأجرة 85.00 ج.م.')]);
    expect(result.documents?.map((document) => document.status)).toEqual([OcrDocumentStatus.Failed, OcrDocumentStatus.Completed]);
    expect(result.documents?.[0].errorCode).toBe('OCR_FAILED');
    expect(result.trips).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('Private upstream');
  });

  it('returns empty recognition as an actionable document failure', async () => {
    const result = await service.extract([upload('')]);
    expect(result.documents?.[0].errorCode).toBe('OCR_NO_TEXT');
    expect(result.trips).toHaveLength(0);
  });

  it('recognizes an identical image only once and links the duplicate', async () => {
    const file = upload('Uber\nالأجرة 85.00 ج.م.');
    const result = await service.extract([file, file]);
    expect(provider.calls).toBe(1);
    expect(result.trips).toHaveLength(1);
    expect(result.documents?.[1]).toMatchObject({ status: OcrDocumentStatus.Duplicate, duplicateOf: result.documents?.[0].id, candidateIds: result.documents?.[0].candidateIds });
  });

  it('keeps candidate identity when file order changes', async () => {
    const a = upload('Uber\n85.00 EGP');
    const b = upload('Careem\n100.00 EGP');
    const first = await service.extract([a, b]);
    const second = await service.extract([b, a]);
    expect(first.trips[0].evidence?.id).toBe(second.trips[1].evidence?.id);
  });

  it('accepts twenty images with at most two concurrent provider calls', async () => {
    const result = await service.extract(Array.from({ length: 20 }, (_, index) => upload('Uber\n85.00 EGP', String(index))));
    expect(result.documents).toHaveLength(20);
    expect(result.trips).toHaveLength(20);
    expect(provider.peak).toBe(2);
  });
  it('retains other documents and raw text when an image exceeds the candidate limit', async () => {
    const cards = Array.from({ length: 201 }, () => '85.00 ج.م.\n00\n5:32 PM\n4.0 km').join('\n');
    const overloaded = upload(`Uber\nملخص الدخل\n16 مايو 2026\n${cards}`);
    const result = await service.extract([upload('Careem\n100.00 EGP'), overloaded, overloaded]);
    expect(result.trips).toHaveLength(1);
    expect(result.documents?.[1]).toMatchObject({ status: OcrDocumentStatus.Failed, errorCode: 'OCR_TOO_MANY_TRIPS', candidateIds: [] });
    expect(result.documents?.[1].rawText).toContain('ملخص الدخل');
    expect(result.documents?.[2]).toMatchObject({ status: OcrDocumentStatus.Failed, errorCode: 'OCR_TOO_MANY_TRIPS', candidateIds: [] });
  });

  it('rejects invalid batch limits before contacting a provider', async () => {
    await expect(service.extract([])).rejects.toMatchObject({ response: { code: 'OCR_NO_IMAGES' } });
    await expect(service.extract(Array.from({ length: 21 }, () => upload('Uber')))).rejects.toMatchObject({ response: { code: 'OCR_TOO_MANY_IMAGES' } });
    const large = { ...upload('Uber'), buffer: Buffer.alloc(5 * 1024 * 1024) };
    await expect(service.extract(Array.from({ length: 9 }, () => large))).rejects.toMatchObject({ response: { code: 'OCR_BATCH_TOO_LARGE' } });
    expect(provider.calls).toBe(0);
  });

  it('checks actual bytes and MIME per file without losing other images', async () => {
    const result = await service.extract([
      { ...upload('Uber'), mimetype: 'image/svg+xml' },
      { ...upload('Uber'), buffer: Buffer.alloc(5 * 1024 * 1024 + 1), size: 1 },
      upload('Careem'),
    ]);
    expect(result.documents?.map((document) => document.errorCode)).toEqual(['OCR_UNSUPPORTED_MIME', 'OCR_IMAGE_TOO_LARGE', null]);
    expect(provider.calls).toBe(1);
  });

  it('uses an optional platform hint only when recognition cannot identify the platform', async () => {
    const result = await service.extract([upload('Careem'), upload('85.00 EGP')], { mode: 'auto', platform: 'UBER' });
    expect(result.trips.map((trip) => trip.evidence?.platform)).toEqual(['CAREEM', 'UBER']);
    expect(result.trips[0].evidence?.warnings).toContain('OCR_PLATFORM_HINT_CONFLICT');
    expect(result.trips[1].evidence?.platformConfidence).toBeLessThan(1);
  });

  it('splits a summary while keeping each clock and Cairo date independent', async () => {
    const result = await service.extract([upload('Uber\nملخص الدخل\n16 مايو 2026\n85.00 ج.م.\n00\n5:32 PM\n4.0 km\n95.00 ج.م.\n00\n6:10 PM\n5.0 km')]);
    expect(result.trips).toHaveLength(2);
    expect(result.trips.map((trip) => trip.parsed.startedAt)).toEqual(['2026-05-16T14:32:00.000Z', '2026-05-16T15:10:00.000Z']);
    expect(result.trips.map((trip) => trip.parsed.receivedEgp)).toEqual([85, 95]);
    expect(result.trips.every((trip) => trip.parsed.grossEgp === null && trip.parsed.commissionEgp === null)).toBe(true);
  });

  it('does not invent a year or AM/PM for summary cards', async () => {
    const result = await service.extract([upload('Uber\nملخص الدخل\n16 مايو\n85.00 ج.م.\n00\n~ 5:32\n4.0 km\n95.00 ج.م.\n00\n~ 6:10\n5.0 km')]);
    expect(result.trips).toHaveLength(2);
    expect(result.trips.every((trip) => trip.parsed.startedAt === null)).toBe(true);
  });

  it('does not split the two clocks on an inDrive trip', async () => {
    const result = await service.extract([upload('inDrive\n16 مايو 2026\n5:32 PM\n6:10 PM\n4.0 km')]);
    expect(result.trips).toHaveLength(1);
    expect(result.parsed.startedAt).toBe('2026-05-16T14:32:00.000Z');
    expect(result.parsed.endedAt).toBe('2026-05-16T15:10:00.000Z');
  });

  it('requires review for explicit same-trip merges and refuses mixed-platform merges', async () => {
    const merged = await service.extract([upload('Uber\n85.00 EGP'), upload('Uber\n4.0 km')], { mode: 'single', platform: null });
    expect(merged.trips).toHaveLength(1);
    expect(merged.trips[0].evidence?.sources).toHaveLength(2);
    expect(merged.trips[0].evidence?.status).toBe(OcrCandidateStatus.Review);
    const mixed = await service.extract([upload('Uber'), upload('Careem')], { mode: 'single', platform: null });
    expect(mixed.trips).toHaveLength(2);
    expect(mixed.warnings).toContain('OCR_MERGE_CONFLICT');
  });
});

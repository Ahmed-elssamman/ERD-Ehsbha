import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  OCR_ALLOWED_MIME, OCR_MAX_BATCH_BYTES, OCR_MAX_IMAGE_BYTES, OCR_MAX_IMAGES,
  OcrCandidateStatus, OcrDocumentStatus, type OcrDocumentResult,
} from '@ehsbha/api-contracts';
import { EMPTY_PARSED, OcrExtractRequestHints, OcrExtractResponseDto, OcrPlatform, OcrTripResultDto } from './dto/ocr.dto';
import { SharpProcessor } from './image-processing/sharp.processor';
import { OcrRecognitionProvider } from './ocr-recognition.provider';
import { OcrWorkLimiter } from './ocr-work-limiter';
import { PlatformDetector } from './detectors/platform.detector';
import { UberParser } from './parsers/uber.parser';
import { IndriveParser } from './parsers/indrive.parser';
import { DidiParser } from './parsers/didi.parser';
import { CareemParser } from './parsers/careem.parser';
import { MultiScreenshotMerger } from './merge/multi-screenshot.merger';
import { MultiTripSplitter, TripSlice } from './merge/multi-trip.splitter';
import { ConfidenceScorer } from './confidence/scorer';
import { TripValidator } from './validation/trip-validator';
import { BaseParser, RawParsed } from './parsers/base.parser';
import { ImageSignals } from './types';
import { normalizeNumeric } from './semantic/digit-normalizer';
import {
  OCR_MAX_CANDIDATES, OCR_MAX_TEXT_LENGTH, OCR_READY_CONFIDENCE,
  OCR_REQUIRED_FIELDS, OCR_SUMMARY_HEADER,
} from './ocr.control';
import { markCandidateDuplicates } from './validation/candidate-duplicates';
import { mapGeminiTrip } from './gemini/gemini-mapper';

export interface OcrImageUpload { buffer: Buffer; mimetype: string; size: number; originalname?: string }
export interface DocumentExtraction { document: OcrDocumentResult; trips: OcrTripResultDto[]; meanConfidence: number }

/** Provider-independent orchestration. A bad image cannot discard other documents. */
@Injectable()
export class OcrService {
  private parserMap: Record<OcrPlatform, BaseParser>;

  constructor(
    private provider: OcrRecognitionProvider,
    private sharp: SharpProcessor,
    private detector: PlatformDetector,
    private merger: MultiScreenshotMerger,
    private splitter: MultiTripSplitter,
    private scorer: ConfidenceScorer,
    private validator: TripValidator,
    uber: UberParser,
    indrive: IndriveParser,
    didi: DidiParser,
    careem: CareemParser,
    private limiter: OcrWorkLimiter,
  ) {
    this.parserMap = { UBER: uber, INDRIVE: indrive, DIDI: didi, CAREEM: careem };
  }

  async extract(files: OcrImageUpload[], hints?: OcrExtractRequestHints): Promise<OcrExtractResponseDto> {
    this.validateBatch(files);
    const mode = hints?.mode ?? 'auto';
    const hashes = files.map((file) => hash(file.buffer));
    const unique = new Map<string, Promise<DocumentExtraction>>();
    const pending = files.map((file, index) => {
      const imageHash = hashes[index];
      const previous = unique.get(imageHash);
      if (previous) {
        return previous.then((result): DocumentExtraction => ({
          ...result, trips: [],
          document: {
            ...result.document, id: `${imageHash}:${index}`, index,
            status: result.document.status === OcrDocumentStatus.Failed ? OcrDocumentStatus.Failed : OcrDocumentStatus.Duplicate,
            duplicateOf: result.document.id,
          },
        }));
      }
      const task = this.extractDocument(file, imageHash, index, hints?.platform ?? null, mode === 'multi');
      unique.set(imageHash, task);
      return task;
    });
    const extracted = await Promise.all(pending);
    return this.assembleDocuments(extracted, hints);
  }

  assembleDocuments(results: DocumentExtraction[], hints?: OcrExtractRequestHints): OcrExtractResponseDto {
    // Assembly annotates candidates; never mutate the persisted extraction evidence.
    const extracted = structuredClone(results);
    const mode = hints?.mode ?? 'auto';
    const hashes = extracted.map((result) => result.document.imageHash);
    let candidateCount = 0;
    for (const result of extracted) {
      if (candidateCount + result.trips.length > OCR_MAX_CANDIDATES) {
        result.document.status = OcrDocumentStatus.Failed;
        result.document.errorCode = 'OCR_TOO_MANY_TRIPS';
        result.document.candidateIds = [];
        result.trips = [];
      } else candidateCount += result.trips.length;
    }
    const documents = extracted.map((result) => result.document);
    let trips = extracted.flatMap((result) => result.trips);
    const warnings: string[] = [];
    if (mode === 'single' && trips.length > 1) {
      if (this.canMerge(trips)) trips = [this.mergeCandidates(trips)];
      else warnings.push('OCR_MERGE_CONFLICT');
    }
    markCandidateDuplicates(trips);
    for (const document of documents) {
      if (document.duplicateOf) {
        const original = documents.find((source) => source.id === document.duplicateOf);
        if (original?.status === OcrDocumentStatus.Failed) {
          document.status = OcrDocumentStatus.Failed;
          document.errorCode = original.errorCode;
          document.candidateIds = [];
        }
      }
      if (document.status === OcrDocumentStatus.Failed) warnings.push(document.errorCode ?? 'OCR_FAILED');
      if (document.status === OcrDocumentStatus.Duplicate) warnings.push('OCR_DUPLICATE_IMAGE');
      if (mode === 'single' && trips.length === 1 && trips[0].evidence) {
        const candidate = trips[0];
        if (candidate.evidence?.sources.some((source) => source.imageHash === document.imageHash)) {
          document.candidateIds = [candidate.evidence.id];
        }
      }
    }
    for (const trip of trips) warnings.push(...(trip.evidence?.warnings ?? []));
    const platforms = new Set(trips.map((trip) => trip.evidence?.platform ?? null));
    const platform = platforms.size === 1 ? trips[0]?.evidence?.platform ?? null : null;
    const first = trips[0];
    const completed = extracted.filter((result) => result.document.status === OcrDocumentStatus.Completed);
    return {
      platform, platformConfidence: platform ? Math.min(...trips.map((trip) => trip.evidence?.platformConfidence ?? 0)) : 0,
      mode, parsed: first?.parsed ?? { ...EMPTY_PARSED }, fieldConfidences: first?.fieldConfidences ?? {},
      trips, warnings: [...new Set(warnings)], imageHashes: hashes, documents,
      rawTextLengths: documents.map((document) => document.rawText.length),
      ocrMeanConfidence: completed.length ? completed.reduce((sum, result) => sum + result.meanConfidence, 0) / completed.length : 0,
    };
  }

  async extractDocument(
    file: OcrImageUpload, imageHash: string, index: number, hint: OcrPlatform | null, forceMulti: boolean,
  ): Promise<DocumentExtraction> {
    const document: OcrDocumentResult = {
      id: `${imageHash}:${index}`, imageHash, index, status: OcrDocumentStatus.Completed,
      duplicateOf: null, errorCode: null, rawText: '', candidateIds: [],
    };
    try {
      if (!OCR_ALLOWED_MIME.test(file.mimetype)) throw new BadRequestException({ code: 'OCR_UNSUPPORTED_MIME' });
      if (file.buffer.length > OCR_MAX_IMAGE_BYTES) throw new BadRequestException({ code: 'OCR_IMAGE_TOO_LARGE' });
      const signals = await this.limiter.run(async () => this.provider.recognize(await this.sharp.prepare(file.buffer)));
      document.rawText = signals.read.text.slice(0, OCR_MAX_TEXT_LENGTH);
      if (!document.rawText.trim()) throw new BadRequestException({ code: 'OCR_NO_TEXT' });
      const trips = this.parseDocument(signals, document, hint, forceMulti);
      document.candidateIds = trips.flatMap((trip) => trip.evidence ? [trip.evidence.id] : []);
      return { document, trips, meanConfidence: signals.read.meanConfidence };
    } catch (error) {
      document.status = OcrDocumentStatus.Failed;
      document.errorCode = documentErrorCode(error instanceof Error ? error : new Error());
      return { document, trips: [], meanConfidence: 0 };
    }
  }

  private parseDocument(signals: ImageSignals, document: OcrDocumentResult, hint: OcrPlatform | null, forceMulti: boolean): OcrTripResultDto[] {
    if (signals.structuredTrips) {
      return signals.structuredTrips.map((trip, index) => mapGeminiTrip(trip, document, index, hint, this.validator));
    }
    const { read, receipt } = signals;
    const detection = this.detector.detect([read.text]);
    const platform = detection.platform ?? hint;
    const confidence = detection.platform ? detection.confidence : hint ? 0.7 : 0;
    const warnings: string[] = [];
    if (!platform) warnings.push('OCR_PLATFORM_UNKNOWN');
    if (hint && detection.platform && detection.platform !== hint) warnings.push('OCR_PLATFORM_HINT_CONFLICT');
    if (read.text.length > OCR_MAX_TEXT_LENGTH) warnings.push('OCR_TEXT_TRUNCATED');
    const potentialSummary = platform === 'UBER' && (forceMulti || OCR_SUMMARY_HEADER.test(read.text));
    const split = potentialSummary ? this.splitter.split(read) : [];
    const summary = potentialSummary && (OCR_SUMMARY_HEADER.test(read.text) || split.length > 1);
    const slices = summary ? split : [{ index: 1, text: read.text, lines: read.lines }];
    if (slices.length > OCR_MAX_CANDIDATES) throw new BadRequestException({ code: 'OCR_TOO_MANY_TRIPS' });
    return slices.map((slice) => {
      const start = read.lines.indexOf(slice.lines[0]);
      const words = slice.lines.flatMap((line) => line.words);
      const raw: RawParsed = platform
        ? this.parserMap[platform].parse(slice.text, words, {
          lines: slice.lines, receipt: summary ? null : receipt,
          dateText: summary ? read.lines.slice(0, Math.max(0, start))
            .map((line) => normalizeNumeric(line.text))
            .filter((line) => !line.includes(':') && /(?:19|20)\d{2}/.test(line)).at(-1) ?? '' : '',
        })
        : { fields: {}, perField: {}, warnings: [] };
      if (summary) this.applySummaryIncome(slice, raw);
      const parsed = { ...EMPTY_PARSED, ...raw.fields };
      const scored = this.scorer.score(raw.perField, confidence, read.meanConfidence);
      const candidateWarnings = [...new Set([...warnings, ...raw.warnings, ...scored.warnings, ...this.validator.validate(parsed)])];
      const ready = platform && candidateWarnings.length === 0 && OCR_REQUIRED_FIELDS.every((field) =>
        parsed[field] != null && (scored.final[field] ?? 0) >= OCR_READY_CONFIDENCE);
      return {
        parsed, fieldConfidences: scored.final,
        evidence: {
          id: hash(`${document.imageHash}:${slice.index}`), platform, platformConfidence: confidence,
          status: ready ? OcrCandidateStatus.Ready : OcrCandidateStatus.Review,
          duplicateOf: null, warnings: candidateWarnings, rawText: slice.text.slice(0, OCR_MAX_TEXT_LENGTH),
          sources: [{ documentId: document.id, imageHash: document.imageHash, lineStart: Math.max(0, start), lineEnd: Math.max(0, start) + slice.lines.length }],
        },
      };
    });
  }

  private applySummaryIncome(slice: TripSlice, raw: RawParsed): void {
    raw.fields.grossEgp = null;
    raw.perField.grossEgp = 0;
    raw.fields.commissionEgp = null;
    raw.perField.commissionEgp = 0;
    // The first decimal above the time marker is only a suggestion. The income
    // screen does not establish a gross fare or imply zero commission.
    for (const line of slice.lines.slice(0, 2)) {
      const match = normalizeNumeric(line.text).match(/(?:^|\s)(\d+\.\d{2})(?=\s|$)/);
      if (!match) continue;
      raw.fields.receivedEgp = Number(match[1]);
      raw.perField.receivedEgp = 0.65;
      break;
    }
    raw.warnings.push('OCR_SUMMARY_NET_ONLY');
  }

  private canMerge(trips: OcrTripResultDto[]): boolean {
    const platforms = new Set(trips.map((trip) => trip.evidence?.platform ?? null));
    const starts = new Set(trips.flatMap((trip) => trip.parsed.startedAt ? [trip.parsed.startedAt] : []));
    const ends = new Set(trips.flatMap((trip) => trip.parsed.endedAt ? [trip.parsed.endedAt] : []));
    const documents = trips.flatMap((trip) => trip.evidence?.sources.map((source) => source.documentId) ?? []);
    return platforms.size === 1 && !platforms.has(null) && starts.size <= 1 && ends.size <= 1 && new Set(documents).size === trips.length;
  }

  private mergeCandidates(trips: OcrTripResultDto[]): OcrTripResultDto {
    const merged = this.merger.merge(trips.map((trip) => ({
      fields: trip.parsed, perField: trip.fieldConfidences, warnings: trip.evidence?.warnings ?? [],
    })));
    const sources = trips.flatMap((trip) => trip.evidence?.sources ?? []);
    return {
      parsed: merged.parsed, fieldConfidences: merged.perField,
      evidence: {
        id: hash(trips.map((trip) => trip.evidence?.id ?? '').sort().join(':')),
        platform: trips[0].evidence?.platform ?? null,
        platformConfidence: Math.min(...trips.map((trip) => trip.evidence?.platformConfidence ?? 0)),
        status: OcrCandidateStatus.Review, duplicateOf: null, sources,
        extractions: trips.flatMap((trip) => trip.evidence?.extractions ?? []),
        warnings: [...new Set([...merged.warnings, 'OCR_MERGED_REVIEW'])],
        rawText: trips.map((trip) => trip.evidence?.rawText ?? '').join('\n\n').slice(0, OCR_MAX_TEXT_LENGTH),
      },
    };
  }

  private validateBatch(files: OcrImageUpload[]): void {
    if (!files.length) throw new BadRequestException({ code: 'OCR_NO_IMAGES' });
    if (files.length > OCR_MAX_IMAGES) throw new BadRequestException({ code: 'OCR_TOO_MANY_IMAGES' });
    if (files.reduce((sum, file) => sum + file.buffer.length, 0) > OCR_MAX_BATCH_BYTES) {
      throw new BadRequestException({ code: 'OCR_BATCH_TOO_LARGE' });
    }
  }
}

function hash(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function documentErrorCode(error: Error): string {
  let code = 'OCR_FAILED';
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'object' && 'code' in response && typeof response.code === 'string') code = response.code;
  } else if ('code' in error && typeof error.code === 'string') code = error.code;
  return /^(?:OCR_(?:UNSUPPORTED_MIME|IMAGE_TOO_LARGE|IMAGE_INVALID|NO_TEXT|TOO_MANY_TRIPS|BUSY|TIMEOUT|AUTH|FAILED)|RATE_LIMITED)$/.test(code) ? code : 'OCR_FAILED';
}

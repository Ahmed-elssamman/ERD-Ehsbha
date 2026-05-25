import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';

import {
  EMPTY_PARSED,
  OcrExtractResponseDto,
  OcrPlatform,
} from './dto/ocr.dto';
import { SharpProcessor } from './image-processing/sharp.processor';
import { AzureVisionProvider, AzureAnalyzeResult } from './azure/azure-vision.provider';
import { PlatformDetector } from './detectors/platform.detector';
import { UberParser } from './parsers/uber.parser';
import { IndriveParser } from './parsers/indrive.parser';
import { DidiParser } from './parsers/didi.parser';
import { CareemParser } from './parsers/careem.parser';
import { MultiScreenshotMerger } from './merge/multi-screenshot.merger';
import { ConfidenceScorer } from './confidence/scorer';
import { TripValidator } from './validation/trip-validator';
import { BaseParser, RawParsed } from './parsers/base.parser';
import { OcrLine, OcrResult, OcrWord, ParseContext } from './types';
import { AzureLine, AzureReadResult } from './azure/types';

const ALLOWED_MIME = /^image\/(png|jpe?g|webp|heic|heif)$/i;
const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

interface ImageEvidence {
  read: OcrResult;
  parsed: RawParsed;
}

/**
 * The end-to-end OCR pipeline. For each uploaded screenshot:
 *
 *   sharp preprocess
 *      ↓
 *   Azure Image Analysis Read (lines+words+bboxes+confidence) ─┐
 *   Azure Document Intelligence prebuilt-receipt (optional)   ─┘  parallel
 *      ↓
 *   PlatformDetector.detect(lines)         → choose parser
 *      ↓
 *   Parser.parse(text, words, {lines, receipt})
 *      ↓                                                   one ImageEvidence per file
 *   MultiScreenshotMerger.merge(all)
 *      ↓
 *   ConfidenceScorer.score(...)
 *      ↓
 *   TripValidator.validate(...)
 *      ↓
 *   OcrExtractResponseDto
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly parserMap: Record<OcrPlatform, BaseParser>;

  constructor(
    private readonly azure: AzureVisionProvider,
    private readonly sharp: SharpProcessor,
    private readonly detector: PlatformDetector,
    private readonly merger: MultiScreenshotMerger,
    private readonly scorer: ConfidenceScorer,
    private readonly validator: TripValidator,
    uber: UberParser,
    indrive: IndriveParser,
    didi: DidiParser,
    careem: CareemParser,
  ) {
    this.parserMap = { UBER: uber, INDRIVE: indrive, DIDI: didi, CAREEM: careem };
  }

  async extract(
    files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname?: string }>,
  ): Promise<OcrExtractResponseDto> {
    this.validateFiles(files);
    const hashes = files.map((f) => createHash('sha256').update(f.buffer).digest('hex'));

    const evidence: ImageEvidence[] = [];
    for (const file of files) {
      const processed = await this.sharp.prepare(file.buffer);
      const analyzed = await this.callAzure(processed);
      const ocr = azureToOcrResult(analyzed.read);
      const platform = this.detectPlatformForImage(ocr);
      const parser = this.parserMap[platform];
      const parsed = parser.parse(ocr.text, ocr.words, {
        lines: ocr.lines,
        receipt: analyzed.receipt,
      });
      evidence.push({ read: ocr, parsed });
    }

    return this.assemble(evidence, hashes);
  }

  /**
   * Pure assembly path — exposed so integration tests can stub the per-image
   * evidence array and exercise merge/scorer/validator without making real
   * Azure calls.
   */
  assemble(evidence: ImageEvidence[], hashes: string[]): OcrExtractResponseDto {
    const ocrMean = evidence.length
      ? evidence.reduce((a, e) => a + e.read.meanConfidence, 0) / evidence.length
      : 0;
    const detection = this.detector.detect(evidence.map((e) => e.read.text));

    const merged = this.merger.merge(evidence.map((e) => e.parsed));

    const scored = this.scorer.score(merged.perField, detection.confidence, ocrMean);
    const validatorWarnings = this.validator.validate(merged.parsed);
    const detectorWarning: string[] = detection.platform == null ? ['OCR_PLATFORM_UNKNOWN'] : [];

    // App-shown distance is paidKm; the parser already approximates totalKm
    // to paidKm. Keep the merged values; only fill EMPTY_PARSED defaults.
    const parsed = { ...EMPTY_PARSED, ...merged.parsed };

    return {
      platform: detection.platform,
      platformConfidence: Number(detection.confidence.toFixed(3)),
      parsed,
      fieldConfidences: scored.final,
      warnings: Array.from(
        new Set([
          ...merged.warnings,
          ...scored.warnings,
          ...validatorWarnings,
          ...detectorWarning,
        ]),
      ),
      imageHashes: hashes,
      rawTextLengths: evidence.map((e) => e.read.text.length),
      ocrMeanConfidence: Number(ocrMean.toFixed(3)),
    };
  }

  private async callAzure(processed: Buffer): Promise<AzureAnalyzeResult> {
    try {
      return await this.azure.analyze(processed);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === 'OCR_BUSY') {
        throw new ServiceUnavailableException({ code: 'OCR_BUSY', message: 'OCR server busy' });
      }
      if (code === 'OCR_TIMEOUT') {
        throw new ServiceUnavailableException({ code: 'OCR_TIMEOUT', message: 'OCR took too long' });
      }
      if (code === 'OCR_AUTH') {
        throw new ServiceUnavailableException({ code: 'OCR_AUTH', message: 'OCR service not authorized' });
      }
      if (code === 'OCR_IMAGE_INVALID') {
        throw new BadRequestException({ code: 'OCR_IMAGE_INVALID', message: 'Unable to decode the uploaded image' });
      }
      this.logger.error(`Azure OCR error: ${(err as Error).message}`);
      throw new ServiceUnavailableException({ code: 'OCR_FAILED', message: 'OCR recognition failed' });
    }
  }

  /**
   * Detect the platform for a single image; falls back to UBER (with
   * confidence retained) when nothing matches — the merge/scorer layer will
   * still emit OCR_PLATFORM_UNKNOWN when the cross-image detector also fails.
   */
  private detectPlatformForImage(ocr: OcrResult): OcrPlatform {
    const r = this.detector.detect([ocr.text]);
    return r.platform ?? 'UBER';
  }

  private validateFiles(files: Array<{ buffer: Buffer; mimetype: string; size: number }>): void {
    if (!files || files.length === 0) {
      throw new BadRequestException({ code: 'OCR_NO_IMAGES', message: 'At least one image is required' });
    }
    if (files.length > MAX_FILES) {
      throw new BadRequestException({
        code: 'OCR_TOO_MANY_IMAGES',
        message: `Max ${MAX_FILES} images per request`,
      });
    }
    for (const f of files) {
      if (!ALLOWED_MIME.test(f.mimetype)) {
        throw new BadRequestException({
          code: 'OCR_UNSUPPORTED_MIME',
          message: `Unsupported mimetype: ${f.mimetype}`,
        });
      }
      if (f.size > MAX_BYTES) {
        throw new BadRequestException({
          code: 'OCR_IMAGE_TOO_LARGE',
          message: `Image exceeds ${MAX_BYTES} bytes`,
        });
      }
    }
  }
}

/**
 * Bridges the Azure-native `AzureReadResult` into our domain `OcrResult` so
 * parsers don't need to know about Azure-specific shapes.
 */
export function azureToOcrResult(read: AzureReadResult): OcrResult {
  const lines: OcrLine[] = read.lines.map(toOcrLine);
  const words: OcrWord[] = lines.flatMap((l) => l.words);
  return {
    text: read.text,
    lines,
    words,
    meanConfidence: read.meanConfidence,
  };
}

function toOcrLine(line: AzureLine): OcrLine {
  return {
    text: line.text,
    bbox: line.bbox,
    meanConfidence: line.meanConfidence,
    words: line.words.map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
    })),
  };
}

export type { ImageEvidence, ParseContext };

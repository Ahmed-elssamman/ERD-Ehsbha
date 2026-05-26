import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';

import {
  EMPTY_PARSED,
  OcrExtractMode,
  OcrExtractRequestHints,
  OcrExtractResponseDto,
  OcrPlatform,
  OcrTripResultDto,
} from './dto/ocr.dto';
import { SharpProcessor } from './image-processing/sharp.processor';
import { filterChromeLines } from './image-processing/chrome-filter';
import { AzureVisionProvider, AzureAnalyzeResult } from './azure/azure-vision.provider';
import { PlatformDetector } from './detectors/platform.detector';
import { UberParser } from './parsers/uber.parser';
import { IndriveParser } from './parsers/indrive.parser';
import { DidiParser } from './parsers/didi.parser';
import { CareemParser } from './parsers/careem.parser';
import { MultiScreenshotMerger } from './merge/multi-screenshot.merger';
import { MultiTripSplitter } from './merge/multi-trip.splitter';
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
    private readonly splitter: MultiTripSplitter,
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
    hints?: OcrExtractRequestHints,
  ): Promise<OcrExtractResponseDto> {
    this.validateFiles(files);
    const hashes = files.map((f) => createHash('sha256').update(f.buffer).digest('hex'));
    const mode: OcrExtractMode = hints?.mode ?? 'single';
    const platformHint = hints?.platform ?? null;

    // Run preprocessing + OCR for each uploaded image, applying the chrome
    // filter so downstream parsing never sees the status bar / nav row.
    const perFile = await Promise.all(
      files.map(async (file) => {
        const processed = await this.sharp.prepare(file.buffer);
        const analyzed = await this.callAzure(processed);
        const cleaned = filterChromeLines(analyzed.read);
        const ocr = azureToOcrResult(cleaned);
        return { ocr, receipt: analyzed.receipt };
      }),
    );

    if (mode === 'multi') {
      return this.assembleMulti(perFile, platformHint, hashes);
    }
    return this.assembleSingle(perFile, platformHint, hashes);
  }

  private assembleSingle(
    perFile: Array<{ ocr: OcrResult; receipt: AzureAnalyzeResult['receipt'] }>,
    platformHint: OcrPlatform | null,
    hashes: string[],
  ): OcrExtractResponseDto {
    const evidence: ImageEvidence[] = perFile.map(({ ocr, receipt }) => {
      const platform = platformHint ?? this.detectPlatformForImage(ocr);
      const parser = this.parserMap[platform];
      const parsed = parser.parse(ocr.text, ocr.words, { lines: ocr.lines, receipt });
      return { read: ocr, parsed };
    });
    return this.assemble(evidence, hashes, 'single', platformHint);
  }

  /**
   * Splits each uploaded image into per-trip cards (Uber's "ملخص الدخل"
   * summary screen layout) and parses each card independently. Cards from
   * across all uploaded images are concatenated in OCR order — typically
   * the UI only sends one image but the contract allows several.
   */
  private assembleMulti(
    perFile: Array<{ ocr: OcrResult; receipt: AzureAnalyzeResult['receipt'] }>,
    platformHint: OcrPlatform | null,
    hashes: string[],
  ): OcrExtractResponseDto {
    const tripResults: OcrTripResultDto[] = [];
    const warnings: string[] = [];
    let ocrMean = 0;
    let ocrCount = 0;

    for (const { ocr, receipt } of perFile) {
      const platform = platformHint ?? this.detectPlatformForImage(ocr);
      const parser = this.parserMap[platform];
      const slices = this.splitter.split(ocr);
      for (const slice of slices) {
        const words = slice.lines.flatMap((l) => l.words);
        const meanConf = words.length
          ? words.reduce((a, w) => a + w.confidence, 0) / words.length
          : 0;
        ocrMean += meanConf;
        ocrCount += 1;

        const parsed = parser.parse(slice.text, words, { lines: slice.lines, receipt });

        // In Uber's multi-trip summary the only fare value visible per card
        // is the driver's income ("الدخل"). The base parser's "first amount
        // = grossEgp" fallback misattributes the cash-collected line to
        // grossEgp; correct that by re-extracting the prominent amount from
        // the top of the card slice and storing it as receivedEgp.
        if (platform === 'UBER') {
          applyMultiTripAmountFix(slice, parsed);
        }

        const scored = this.scorer.score(parsed.perField, 1, meanConf);
        const validatorWarnings = this.validator.validate({ ...EMPTY_PARSED, ...parsed.fields });
        warnings.push(
          ...parsed.warnings.map((w) => `card${slice.index}:${w}`),
          ...scored.warnings.map((w) => `card${slice.index}:${w}`),
          ...validatorWarnings.map((w) => `card${slice.index}:${w}`),
        );
        tripResults.push({
          parsed: { ...EMPTY_PARSED, ...parsed.fields },
          fieldConfidences: scored.final,
        });
      }
    }

    if (tripResults.length === 0) {
      // Defensive fallback: behave like single mode if splitting failed.
      return this.assembleSingle(perFile, platformHint, hashes);
    }

    const meanOverall = ocrCount > 0 ? ocrMean / ocrCount : 0;
    return {
      platform: platformHint,
      platformConfidence: platformHint ? 1 : 0,
      mode: 'multi',
      parsed: tripResults[0].parsed,
      fieldConfidences: tripResults[0].fieldConfidences,
      trips: tripResults,
      warnings: Array.from(new Set(warnings)),
      imageHashes: hashes,
      rawTextLengths: perFile.map(({ ocr }) => ocr.text.length),
      ocrMeanConfidence: Number(meanOverall.toFixed(3)),
    };
  }

  /**
   * Pure assembly path — exposed so integration tests can stub the per-image
   * evidence array and exercise merge/scorer/validator without making real
   * Azure calls.
   */
  assemble(
    evidence: ImageEvidence[],
    hashes: string[],
    mode: OcrExtractMode = 'single',
    platformHint: OcrPlatform | null = null,
  ): OcrExtractResponseDto {
    const ocrMean = evidence.length
      ? evidence.reduce((a, e) => a + e.read.meanConfidence, 0) / evidence.length
      : 0;
    const detection = this.detector.detect(evidence.map((e) => e.read.text));
    const platform = platformHint ?? detection.platform;
    const platformConfidence = platformHint ? 1 : detection.confidence;

    const merged = this.merger.merge(evidence.map((e) => e.parsed));

    const scored = this.scorer.score(merged.perField, platformConfidence, ocrMean);
    const validatorWarnings = this.validator.validate(merged.parsed);
    const detectorWarning: string[] = platform == null ? ['OCR_PLATFORM_UNKNOWN'] : [];

    // App-shown distance is paidKm; the parser already approximates totalKm
    // to paidKm. Keep the merged values; only fill EMPTY_PARSED defaults.
    const parsed = { ...EMPTY_PARSED, ...merged.parsed };

    return {
      platform,
      platformConfidence: Number(platformConfidence.toFixed(3)),
      mode,
      parsed,
      fieldConfidences: scored.final,
      trips: [{ parsed, fieldConfidences: scored.final }],
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

/**
 * Uber's summary screen renders each card's prominent number ("الدخل") on
 * its own line 2-3 entries above the time stamp. OCR may mangle the
 * accompanying "ج.م." into ".P.@" / ".P.c" glyph noise — so findCurrencyOnLine
 * can't see it — but the bare decimal value still survives. Pull the first
 * decimal out of the top 4 lines of the slice and write it to receivedEgp;
 * clear the grossEgp that the base fallback may have mis-set to the
 * cash-collected line.
 */
function applyMultiTripAmountFix(
  slice: import('./merge/multi-trip.splitter').TripSlice,
  parsed: RawParsed,
): void {
  const head = slice.lines.slice(0, 4);
  for (const l of head) {
    const m = l.text.match(/(\d+\.\d{2})/);
    if (!m) continue;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0 || n >= 10000) continue;
    parsed.fields.receivedEgp = n;
    parsed.perField.receivedEgp = 0.85;
    // Unconditional clear: Uber's "ملخص الدخل" summary cards NEVER show the
    // gross fare (الأجرة) — only the post-commission income (الدخل) is
    // displayed prominently. Whatever the base parser found for grossEgp on
    // this slice is therefore noise (commonly the cash-collected line, or
    // the surge banner "زادت قيمة الأجرة" matching the fare label).
    parsed.fields.grossEgp = undefined;
    parsed.perField.grossEgp = undefined;
    return;
  }
}

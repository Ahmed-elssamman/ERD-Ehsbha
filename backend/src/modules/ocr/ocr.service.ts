import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EMPTY_PARSED, OcrExtractResponseDto, OcrParsedTripDto, OcrPlatform } from './dto/ocr.dto';
import { SharpProcessor } from './image-processing/sharp.processor';
import { OcrProvider, OcrResult, OcrStructuredResult, OCR_PROVIDER } from './engines/ocr-provider.interface';
import { PlatformDetector } from './detectors/platform.detector';
import { UberParser } from './parsers/uber.parser';
import { IndriveParser } from './parsers/indrive.parser';
import { DidiParser } from './parsers/didi.parser';
import { CareemParser } from './parsers/careem.parser';
import { MultiScreenshotMerger } from './merge/multi-screenshot.merger';
import { ConfidenceScorer } from './confidence/scorer';
import { TripValidator } from './validation/trip-validator';
import { BaseParser, RawParsed } from './parsers/base.parser';

const ALLOWED_MIME = /^image\/(png|jpe?g|webp|heic|heif)$/i;
const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly parserMap: Record<OcrPlatform, BaseParser>;

  constructor(
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
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

  async extract(files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname?: string }>): Promise<OcrExtractResponseDto> {
    this.validateFiles(files);
    const hashes = files.map((f) => createHash('sha256').update(f.buffer).digest('hex'));

    if (this.ocr.recognizeStructured) {
      return this.extractStructured(files, hashes);
    }
    return this.extractWithParsing(files, hashes);
  }

  private async extractStructured(
    files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname?: string }>,
    hashes: string[],
  ): Promise<OcrExtractResponseDto> {
    const recognizer = this.ocr.recognizeStructured!.bind(this.ocr);
    const results: OcrStructuredResult[] = [];
    for (const file of files) {
      const processed = await this.sharp.prepare(file.buffer);
      try {
        results.push(await recognizer(processed));
      } catch (err) {
        const code = (err as Error & { code?: string }).code;
        if (code === 'OCR_BUSY') throw new ServiceUnavailableException({ code: 'OCR_BUSY', message: 'OCR server busy' });
        this.logger.error(`Vision OCR error: ${(err as Error).message}`);
        throw new ServiceUnavailableException({ code: 'OCR_FAILED', message: 'OCR recognition failed' });
      }
    }
    return this.assembleStructured(results, hashes);
  }

  private async extractWithParsing(
    files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname?: string }>,
    hashes: string[],
  ): Promise<OcrExtractResponseDto> {
    const ocrResults: OcrResult[] = [];
    for (const file of files) {
      const processed = await this.sharp.prepare(file.buffer);
      try {
        ocrResults.push(await this.ocr.recognize(processed));
      } catch (err) {
        const code = (err as Error & { code?: string }).code;
        if (code === 'OCR_TIMEOUT') throw new ServiceUnavailableException({ code: 'OCR_TIMEOUT', message: 'OCR took too long' });
        if (code === 'OCR_BUSY') throw new ServiceUnavailableException({ code: 'OCR_BUSY', message: 'OCR server busy' });
        if (code === 'OCR_NOT_READY') throw new ServiceUnavailableException({ code: 'OCR_NOT_READY', message: 'OCR engine not ready' });
        this.logger.error(`Unexpected OCR error: ${(err as Error).message}`);
        throw new ServiceUnavailableException({ code: 'OCR_FAILED', message: 'OCR recognition failed' });
      }
    }
    return this.assemble(ocrResults, hashes);
  }

  /**
   * Pure assembly path for regex-based parsing — exposed so integration tests
   * can stub the OCR provider with pre-recognized OcrResult[].
   */
  assemble(ocrResults: OcrResult[], hashes: string[]): OcrExtractResponseDto {
    const texts = ocrResults.map((r) => r.text);
    const ocrMean = ocrResults.length
      ? ocrResults.reduce((a, r) => a + r.meanConfidence, 0) / ocrResults.length
      : 0;
    const detection = this.detector.detect(texts);

    const platform: OcrPlatform = detection.platform ?? 'UBER';
    const parser = this.parserMap[platform];
    const rawParsed: RawParsed[] = ocrResults.map((r) => parser.parse(r.text, r.words));
    const merged = this.merger.merge(rawParsed);

    const scored = this.scorer.score(merged.perField, detection.confidence, ocrMean);
    const validatorWarnings = this.validator.validate(merged.parsed);
    const detectorWarning: string[] = detection.platform == null ? ['OCR_PLATFORM_UNKNOWN'] : [];

    return {
      platform: detection.platform,
      platformConfidence: Number(detection.confidence.toFixed(3)),
      parsed: merged.parsed,
      fieldConfidences: scored.final,
      warnings: Array.from(new Set([
        ...merged.warnings,
        ...scored.warnings,
        ...validatorWarnings,
        ...detectorWarning,
      ])),
      imageHashes: hashes,
      rawTextLengths: texts.map((t) => t.length),
      ocrMeanConfidence: Number(ocrMean.toFixed(3)),
    };
  }

  /**
   * Assembly path for vision-LLM providers that return already-parsed trip
   * data. Skips platform-detection + regex parsing, then runs the same
   * merger/scorer/validator so multi-image merge and warnings still work.
   */
  assembleStructured(results: OcrStructuredResult[], hashes: string[]): OcrExtractResponseDto {
    const texts = results.map((r) => r.text);
    const ocrMean = results.length
      ? results.reduce((a, r) => a + r.meanConfidence, 0) / results.length
      : 0;
    const platformVotes: Record<OcrPlatform, number> = { UBER: 0, INDRIVE: 0, DIDI: 0, CAREEM: 0 };
    let topPlatform: OcrPlatform | null = null;
    let topPlatformConf = 0;
    for (const r of results) {
      if (r.platform) {
        platformVotes[r.platform] += 1;
        if (r.platformConfidence > topPlatformConf) {
          topPlatform = r.platform;
          topPlatformConf = r.platformConfidence;
        }
      }
    }

    const rawParsed: RawParsed[] = results.map((r) => ({
      fields: { ...r.parsed },
      perField: r.fieldConfidences as Partial<Record<keyof OcrParsedTripDto, number>>,
      warnings: [],
    }));
    const merged = this.merger.merge(rawParsed);

    const scored = this.scorer.score(merged.perField, topPlatformConf, ocrMean);
    const validatorWarnings = this.validator.validate(merged.parsed);
    const platformWarning: string[] = topPlatform == null ? ['OCR_PLATFORM_UNKNOWN'] : [];

    // Bypass the "default-to-Uber" behavior of regex parsing — keep null when LLM said null.
    const parsed: OcrParsedTripDto = { ...EMPTY_PARSED, ...merged.parsed };

    // Derive endedAt = startedAt + durationSec when only startedAt is present.
    // The regex-parser path does this inside parse(); the vision path skips
    // parse(), so we replicate it here.
    if (!parsed.endedAt && parsed.startedAt && parsed.durationSec != null) {
      const start = new Date(parsed.startedAt);
      if (!Number.isNaN(start.getTime())) {
        parsed.endedAt = new Date(start.getTime() + parsed.durationSec * 1000).toISOString();
      }
    }

    // App-shown distance is paidKm (with passenger). totalKm is unknown to the
    // app — we approximate it to paidKm so the form has a valid starting
    // value; the driver can edit to add empty km on the review screen.
    const extraWarnings: string[] = [];
    if (parsed.totalKm == null && parsed.paidKm != null) {
      parsed.totalKm = parsed.paidKm;
      extraWarnings.push('OCR_DISTANCE_IS_PAID_KM');
    }

    return {
      platform: topPlatform,
      platformConfidence: Number(topPlatformConf.toFixed(3)),
      parsed,
      fieldConfidences: scored.final,
      warnings: Array.from(new Set([
        ...merged.warnings,
        ...scored.warnings,
        ...validatorWarnings,
        ...platformWarning,
        ...extraWarnings,
      ])),
      imageHashes: hashes,
      rawTextLengths: texts.map((t) => t.length),
      ocrMeanConfidence: Number(ocrMean.toFixed(3)),
    };
  }

  private validateFiles(files: Array<{ buffer: Buffer; mimetype: string; size: number }>): void {
    if (!files || files.length === 0) {
      throw new BadRequestException({ code: 'OCR_NO_IMAGES', message: 'At least one image is required' });
    }
    if (files.length > MAX_FILES) {
      throw new BadRequestException({ code: 'OCR_TOO_MANY_IMAGES', message: `Max ${MAX_FILES} images per request` });
    }
    for (const f of files) {
      if (!ALLOWED_MIME.test(f.mimetype)) {
        throw new BadRequestException({ code: 'OCR_UNSUPPORTED_MIME', message: `Unsupported mimetype: ${f.mimetype}` });
      }
      if (f.size > MAX_BYTES) {
        throw new BadRequestException({ code: 'OCR_IMAGE_TOO_LARGE', message: `Image exceeds ${MAX_BYTES} bytes` });
      }
    }
  }
}

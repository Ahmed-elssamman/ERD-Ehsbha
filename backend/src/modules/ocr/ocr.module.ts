import { Logger, Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { SharpProcessor } from './image-processing/sharp.processor';
import { TesseractPool } from './engines/tesseract-pool';
import { TesseractOcrProvider } from './engines/tesseract.provider';
import { AnthropicVisionProvider } from './engines/anthropic-vision.provider';
import { OCR_PROVIDER, OcrProvider } from './engines/ocr-provider.interface';
import { PlatformDetector } from './detectors/platform.detector';
import { UberParser } from './parsers/uber.parser';
import { IndriveParser } from './parsers/indrive.parser';
import { DidiParser } from './parsers/didi.parser';
import { CareemParser } from './parsers/careem.parser';
import { SemanticNormalizer } from './semantic/normalizer';
import { MultiScreenshotMerger } from './merge/multi-screenshot.merger';
import { ConfidenceScorer } from './confidence/scorer';
import { TripValidator } from './validation/trip-validator';
import { loadEnv } from '../../config/env';

const ocrProviderFactory = {
  provide: OCR_PROVIDER,
  useFactory: (pool: TesseractPool): OcrProvider => {
    const env = loadEnv();
    const log = new Logger('OcrProviderFactory');
    const preferAnthropic =
      env.OCR_PROVIDER === 'anthropic' ||
      (env.OCR_PROVIDER === 'auto' && !!env.ANTHROPIC_API_KEY);
    if (preferAnthropic) {
      if (!env.ANTHROPIC_API_KEY) {
        log.warn('OCR_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing — falling back to tesseract');
      } else {
        log.log(`OCR provider: anthropic (${env.OCR_ANTHROPIC_MODEL})`);
        return new AnthropicVisionProvider(env.ANTHROPIC_API_KEY, env.OCR_ANTHROPIC_MODEL);
      }
    }
    log.log('OCR provider: tesseract');
    // Fire-and-forget warm-up so the first request doesn't pay the ~2s
    // download cost. Failures are logged inside warmUp() but never thrown.
    void pool.warmUp();
    return new TesseractOcrProvider(pool);
  },
  inject: [TesseractPool],
};

@Module({
  controllers: [OcrController],
  providers: [
    OcrService,
    SharpProcessor,
    TesseractPool,
    ocrProviderFactory,
    PlatformDetector,
    SemanticNormalizer,
    UberParser,
    IndriveParser,
    DidiParser,
    CareemParser,
    MultiScreenshotMerger,
    ConfidenceScorer,
    TripValidator,
  ],
})
export class OcrModule {}

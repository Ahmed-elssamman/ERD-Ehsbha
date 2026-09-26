import { GeminiTransport } from './gemini/gemini.transport';
import { GeminiExtractionService } from './gemini/gemini-extraction.service';
import { GeminiProvider } from './gemini/gemini.provider';
import { Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { SharpProcessor } from './image-processing/sharp.processor';
import { PlatformDetector } from './detectors/platform.detector';
import { UberParser } from './parsers/uber.parser';
import { IndriveParser } from './parsers/indrive.parser';
import { DidiParser } from './parsers/didi.parser';
import { CareemParser } from './parsers/careem.parser';
import { SemanticNormalizer } from './semantic/normalizer';
import { MultiScreenshotMerger } from './merge/multi-screenshot.merger';
import { MultiTripSplitter } from './merge/multi-trip.splitter';
import { ConfidenceScorer } from './confidence/scorer';
import { TripValidator } from './validation/trip-validator';
import { OcrRecognitionProvider } from './ocr-recognition.provider';
import { OcrWorkLimiter } from './ocr-work-limiter';
import { OcrAdmissionGuard } from './ocr-admission.guard';
import { OcrImportController } from './imports/ocr-import.controller';
import { OcrImportStore } from './imports/ocr-import-store.service';
import { OcrImportWorker } from './imports/ocr-import.worker';
import { OcrImportUploadGuard } from './imports/ocr-import-upload.guard';
import { OcrConfirmationService } from './imports/ocr-confirmation.service';
import { TripsModule } from '../trips/trips.module';

/** Gemini structured extraction with persistent import recovery and manual review. */
@Module({
  imports: [TripsModule],
  controllers: [OcrController, OcrImportController],
  providers: [
    OcrService,
    OcrImportStore,
    OcrConfirmationService,
    OcrImportWorker,
    OcrImportUploadGuard,
    SharpProcessor,
    GeminiTransport,
    GeminiExtractionService,
    GeminiProvider,
    { provide: OcrRecognitionProvider, useExisting: GeminiProvider },
    OcrWorkLimiter,
    OcrAdmissionGuard,
    PlatformDetector,
    SemanticNormalizer,
    UberParser,
    IndriveParser,
    DidiParser,
    CareemParser,
    MultiScreenshotMerger,
    MultiTripSplitter,
    ConfidenceScorer,
    TripValidator,
  ],
})
export class OcrModule {}

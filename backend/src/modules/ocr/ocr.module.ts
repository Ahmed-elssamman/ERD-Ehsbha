import { Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { SharpProcessor } from './image-processing/sharp.processor';
import { AzureVisionClient } from './azure/azure-vision.client';
import { AzureDocumentIntelligenceClient } from './azure/azure-document-intelligence.client';
import { AzureVisionProvider } from './azure/azure-vision.provider';
import { PlatformDetector } from './detectors/platform.detector';
import { UberParser } from './parsers/uber.parser';
import { IndriveParser } from './parsers/indrive.parser';
import { DidiParser } from './parsers/didi.parser';
import { CareemParser } from './parsers/careem.parser';
import { SemanticNormalizer } from './semantic/normalizer';
import { MultiScreenshotMerger } from './merge/multi-screenshot.merger';
import { ConfidenceScorer } from './confidence/scorer';
import { TripValidator } from './validation/trip-validator';

/**
 * OCR feature module — Azure AI Vision-backed pipeline.
 *
 * Components:
 *   - SharpProcessor:                 image preprocessing
 *   - AzureVisionClient:              Image Analysis 4.0 Read OCR
 *   - AzureDocumentIntelligenceClient prebuilt-receipt structured fields
 *   - AzureVisionProvider:            orchestrator (Read + DI in parallel)
 *   - SemanticNormalizer + dictionary letter/digit/synonym folding
 *   - PlatformDetector:               brand + label heuristics
 *   - Platform parsers (UBER/INDRIVE/DIDI/CAREEM):
 *                                     positional + receipt-aware extraction
 *   - MultiScreenshotMerger:          fuse across uploaded screenshots
 *   - ConfidenceScorer:               OCR × platform × parser confidence
 *   - TripValidator:                  sanity-check parsed values
 */
@Module({
  controllers: [OcrController],
  providers: [
    OcrService,
    SharpProcessor,
    AzureVisionClient,
    AzureDocumentIntelligenceClient,
    AzureVisionProvider,
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

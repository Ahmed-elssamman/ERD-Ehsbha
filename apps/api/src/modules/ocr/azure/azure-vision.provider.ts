import { Injectable, Logger } from '@nestjs/common';
import { AzureVisionClient } from './azure-vision.client';
import { AzureDocumentIntelligenceClient } from './azure-document-intelligence.client';
import type { AzureDocReceiptResult, AzureReadResult } from './types';

export interface AzureAnalyzeResult {
  read: AzureReadResult;
  /** null when Document Intelligence is disabled or returned an error. */
  receipt: AzureDocReceiptResult | null;
}

/**
 * Orchestrates the two Azure OCR primitives:
 *
 *  - `AzureVisionClient`   — Image Analysis 4.0 Read OCR (positional lines).
 *  - `AzureDocumentIntelligenceClient` — prebuilt-receipt structured fields.
 *
 * Both calls fire in parallel; the DI call is treated as best-effort. If DI
 * fails or is disabled (`AZURE_DOC_INTELLIGENCE_ENABLED=false`), the pipeline
 * continues with Read-only output — accuracy degrades gracefully rather than
 * failing the request.
 */
@Injectable()
export class AzureVisionProvider {
  private readonly logger = new Logger(AzureVisionProvider.name);

  constructor(
    private readonly read: AzureVisionClient,
    private readonly di: AzureDocumentIntelligenceClient,
  ) {}

  async analyze(image: Buffer): Promise<AzureAnalyzeResult> {
    const readPromise = this.read.read(image);
    const receiptPromise = this.di.isEnabled()
      ? this.di.analyzeReceipt(image).catch((err) => {
          this.logger.warn(`DI receipt fell back to null: ${(err as Error).message}`);
          return null;
        })
      : Promise.resolve(null);

    const [readResult, receiptResult] = await Promise.all([readPromise, receiptPromise]);
    return { read: readResult, receipt: receiptResult };
  }
}

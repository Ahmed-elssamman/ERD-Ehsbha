import { Injectable, Logger } from '@nestjs/common';
import DocumentIntelligence, {
  isUnexpected,
  getLongRunningPoller,
  type DocumentIntelligenceClient,
  type AnalyzeOperationOutput,
  type DocumentFieldOutput,
} from '@azure-rest/ai-document-intelligence';
import { loadEnv } from '../../../config/env';
import type { AzureDocReceiptResult } from './types';

/**
 * Calls Document Intelligence's prebuilt-receipt model.
 *
 * Ride-hailing summary screenshots aren't classic receipts, so the model
 * sometimes mis-classifies them — but when it works, it returns crisp values
 * for total / subtotal / transaction-date that we can cross-check against the
 * Read OCR + semantic-parser output. The merge layer prefers DI when its
 * confidence > Read parser's confidence for the same field.
 *
 * The prebuilt-receipt analyze call is an async LRO (returns 202 + Operation
 * Location), so we poll via the SDK's `getLongRunningPoller` helper.
 */
@Injectable()
export class AzureDocumentIntelligenceClient {
  private readonly logger = new Logger(AzureDocumentIntelligenceClient.name);
  private readonly client: DocumentIntelligenceClient | null;
  private readonly enabled: boolean;

  constructor() {
    const env = loadEnv();
    this.enabled = env.AZURE_DOC_INTELLIGENCE_ENABLED;
    // Fall back to the Vision endpoint/key when DI-specific ones aren't set
    // — works only when the underlying resource is "Azure AI services"
    // multi-service. A standalone Computer Vision resource will 401 here, in
    // which case the operator should either disable DI or provision a
    // dedicated Document Intelligence resource and set the *_DOC_*_ env vars.
    const endpoint = env.AZURE_DOC_INTELLIGENCE_ENDPOINT ?? env.AZURE_VISION_ENDPOINT;
    const key = env.AZURE_DOC_INTELLIGENCE_KEY ?? env.AZURE_VISION_KEY;
    this.client = this.enabled ? DocumentIntelligence(endpoint, { key }) : null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async analyzeReceipt(image: Buffer): Promise<AzureDocReceiptResult | null> {
    if (!this.client) return null;
    let initial;
    try {
      initial = await this.client
        .path('/documentModels/{modelId}:analyze', 'prebuilt-receipt')
        .post({
          contentType: 'application/octet-stream',
          body: image,
          queryParameters: { stringIndexType: 'utf16CodeUnit' },
        });
    } catch (err) {
      // DI failures must NOT take down the OCR request; Read OCR is the
      // primary signal. We log and degrade silently.
      this.logger.warn(`DI receipt analyze transport failure: ${(err as Error).message}`);
      return null;
    }

    if (isUnexpected(initial)) {
      this.logger.warn(
        `DI receipt analyze service error: ${initial.status} ${initial.body?.error?.code ?? ''}`,
      );
      return null;
    }

    try {
      const poller = getLongRunningPoller(this.client, initial, { intervalInMs: 800 });
      const final = await poller.pollUntilDone();
      if (isUnexpected(final)) {
        this.logger.warn(`DI receipt poll error: ${final.status}`);
        return null;
      }
      const operation = final.body as AnalyzeOperationOutput;
      if (operation.status !== 'succeeded') {
        this.logger.warn(`DI receipt operation status: ${operation.status}`);
        return null;
      }
      const doc = operation.analyzeResult?.documents?.[0];
      const fields = doc?.fields;
      if (!fields) return { ...emptyFields(), isReceipt: false };
      return extractReceiptFields(fields);
    } catch (err) {
      this.logger.warn(`DI receipt LRO failure: ${(err as Error).message}`);
      return null;
    }
  }
}

function emptyFields(): AzureDocReceiptResult {
  return {
    total: null,
    subtotal: null,
    tip: null,
    tax: null,
    transactionDate: null,
    transactionTime: null,
    merchantName: null,
    meanConfidence: 0,
    isReceipt: false,
  };
}

/**
 * Reads relevant fields off the prebuilt-receipt document and returns a flat,
 * normalized shape. Exported for unit-test consumption of fake field maps.
 */
export function extractReceiptFields(
  fields: Record<string, DocumentFieldOutput>,
): AzureDocReceiptResult {
  const total = readNumber(fields.Total);
  const subtotal = readNumber(fields.Subtotal);
  const tip = readNumber(fields.Tip);
  const tax = readNumber(fields.TotalTax);
  const merchantName = readString(fields.MerchantName);
  const transactionDate = readDate(fields.TransactionDate);
  const transactionTime = readTime(fields.TransactionTime);

  const confs = [
    fields.Total?.confidence,
    fields.Subtotal?.confidence,
    fields.Tip?.confidence,
    fields.TotalTax?.confidence,
    fields.MerchantName?.confidence,
    fields.TransactionDate?.confidence,
    fields.TransactionTime?.confidence,
  ].filter((c): c is number => typeof c === 'number');
  const meanConfidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;

  return {
    total,
    subtotal,
    tip,
    tax,
    transactionDate,
    transactionTime,
    merchantName,
    meanConfidence,
    isReceipt:
      total != null || subtotal != null || merchantName != null || transactionDate != null,
  };
}

function readNumber(field: DocumentFieldOutput | undefined): number | null {
  if (!field) return null;
  if (field.valueCurrency && typeof field.valueCurrency.amount === 'number') {
    return field.valueCurrency.amount;
  }
  if (typeof field.valueNumber === 'number') return field.valueNumber;
  return null;
}

function readString(field: DocumentFieldOutput | undefined): string | null {
  if (!field) return null;
  if (typeof field.valueString === 'string' && field.valueString.trim()) {
    return field.valueString.trim();
  }
  if (typeof field.content === 'string' && field.content.trim()) {
    return field.content.trim();
  }
  return null;
}

function readDate(field: DocumentFieldOutput | undefined): string | null {
  if (!field) return null;
  // Azure returns ISO YYYY-MM-DD strings for valueDate.
  if (typeof field.valueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(field.valueDate)) {
    return field.valueDate;
  }
  return null;
}

function readTime(field: DocumentFieldOutput | undefined): string | null {
  if (!field) return null;
  if (typeof field.valueTime === 'string') return field.valueTime;
  return null;
}

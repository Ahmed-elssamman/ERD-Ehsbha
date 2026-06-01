/**
 * Position-aware OCR data structures. Azure Image Analysis 4.0 returns lines
 * and words with bounding polygons (4-point quadrilaterals in pixel space);
 * we flatten those to axis-aligned bounding boxes (AABB) so downstream parsers
 * can reason about "label is to the left of value" or "value is on the line
 * directly below the label" without re-implementing geometry math everywhere.
 */
export interface BoundingBox {
  /** Top-left X in pixels. */
  x: number;
  /** Top-left Y in pixels. */
  y: number;
  /** Width in pixels. */
  w: number;
  /** Height in pixels. */
  h: number;
}

export interface AzureWord {
  text: string;
  /** 0..1 from Azure Read. */
  confidence: number;
  bbox: BoundingBox;
}

export interface AzureLine {
  text: string;
  /** Mean word confidence on this line. */
  meanConfidence: number;
  bbox: BoundingBox;
  words: AzureWord[];
  /** Detected language (ISO code) if Azure reports one; null otherwise. */
  language: string | null;
}

export interface AzureReadResult {
  /** All recognized text joined with newlines, in reading order. */
  text: string;
  lines: AzureLine[];
  /** 0..1 mean across all words. */
  meanConfidence: number;
  /** Image pixel dimensions returned by Azure. */
  imageWidth: number;
  imageHeight: number;
  /** Mix of detected languages, sorted by frequency. */
  languages: string[];
}

/**
 * A subset of Document Intelligence prebuilt-receipt fields we use. The full
 * payload has many more (Items, MerchantAddress, Tax, …) but for ride-hailing
 * screenshots the most useful are total / subtotal / transaction date.
 */
export interface DocReceiptFields {
  total: number | null;
  subtotal: number | null;
  tip: number | null;
  tax: number | null;
  transactionDate: string | null;
  transactionTime: string | null;
  merchantName: string | null;
  /** 0..1 — geometric mean of Azure's per-field confidences. */
  meanConfidence: number;
}

export interface AzureDocReceiptResult extends DocReceiptFields {
  /** True when DI couldn't classify the image as a receipt. */
  isReceipt: boolean;
}

import type { OcrStructuredTrip } from '@ehsbha/api-contracts';

/** Provider-neutral evidence consumed by extraction, merging and review. */
export interface ReceiptSignals {
  total: number | null;
  subtotal: number | null;
  tip: number | null;
  tax: number | null;
  transactionDate: string | null;
  transactionTime: string | null;
  merchantName: string | null;
  meanConfidence: number;
  isReceipt: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OcrWord {
  text: string;
  /** 0..1 confidence supplied by the text provider. */
  confidence: number;
  bbox: BoundingBox;
}

export interface OcrLine {
  text: string;
  bbox: BoundingBox;
  words: OcrWord[];
  /** Mean of word confidences on this line. */
  meanConfidence: number;
}

export interface OcrResult {
  /** Lines joined by '\n' in reading order. */
  text: string;
  lines: OcrLine[];
  words: OcrWord[];
  /** Mean confidence across all words. */
  meanConfidence: number;
}

/** Bundle of every signal extracted from a single image. */
export interface ImageSignals {
  read: OcrResult;
  receipt: ReceiptSignals | null;
  structuredTrips?: OcrStructuredTrip[];
}

export interface ParseContext {
  dateText?: string;
  text: string;
  words: OcrWord[];
  lines: OcrLine[];
  receipt: ReceiptSignals | null;
}

/**
 * Central OCR types used across the pipeline. These shapes are produced by
 * `AzureVisionClient.read()` and consumed by parsers, the platform detector,
 * the merger, and the confidence scorer.
 */
import type { AzureDocReceiptResult } from './azure/types';

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OcrWord {
  text: string;
  /** 0..1 confidence from Azure Read. */
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
  receipt: AzureDocReceiptResult | null;
}

export interface ParseContext {
  text: string;
  words: OcrWord[];
  lines: OcrLine[];
  receipt: AzureDocReceiptResult | null;
}

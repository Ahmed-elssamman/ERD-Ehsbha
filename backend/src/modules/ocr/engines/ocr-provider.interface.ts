import type { OcrParsedTripDto, OcrPlatform } from '../dto/ocr.dto';

export const OCR_PROVIDER = Symbol('OCR_PROVIDER');

export interface OcrWord {
  text: string;
  confidence: number;
  bbox?: { x: number; y: number; w: number; h: number };
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
  meanConfidence: number;
}

/**
 * Structured extraction result. Providers that can return semantically
 * parsed trip data (e.g. vision LLMs) implement `recognizeStructured` —
 * the OcrService uses it directly, bypassing regex parsing for much
 * higher accuracy on Arabic / mixed-language / stylized-font screenshots.
 */
export interface OcrStructuredResult {
  text: string;
  parsed: OcrParsedTripDto;
  platform: OcrPlatform | null;
  platformConfidence: number;
  fieldConfidences: Record<string, number>;
  meanConfidence: number;
}

export interface OcrProvider {
  /** Cheap text-only extraction. All providers must implement this. */
  recognize(buf: Buffer): Promise<OcrResult>;
  /** Optional: returns a fully-parsed trip directly. Preferred when available. */
  recognizeStructured?(buf: Buffer): Promise<OcrStructuredResult>;
  warmUp(): Promise<void>;
  dispose(): Promise<void>;
}

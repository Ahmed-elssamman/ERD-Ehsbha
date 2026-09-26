import { z } from 'zod';
import { ocrStructuredTripSchema, type OcrStructuredTrip } from '@ehsbha/api-contracts';
import { OCR_MAX_CANDIDATES, OCR_MAX_TEXT_LENGTH } from '../ocr.control';

export interface GeminiDocument {
  raw_text: string;
  trips: OcrStructuredTrip[];
}

export const geminiDocumentSchema: z.ZodType<GeminiDocument> = z.object({
  raw_text: z.string().max(OCR_MAX_TEXT_LENGTH),
  trips: z.array(ocrStructuredTripSchema).max(OCR_MAX_CANDIDATES),
}).strict();

export interface GeminiRetryResponse {
  error?: { details?: { retryDelay?: string }[] };
}

export const geminiRetryResponseSchema: z.ZodType<GeminiRetryResponse> = z.object({
  error: z.object({
    details: z.array(z.object({ retryDelay: z.string().regex(/^\d+(?:\.\d+)?s$/).optional() })).optional(),
  }).optional(),
});

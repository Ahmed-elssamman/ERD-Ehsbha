import { BadRequestException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ApiError } from '@google/genai';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { ZodError } from 'zod';
import type { OcrStructuredTrip } from '@ehsbha/api-contracts';
import { SharpProcessor } from '../image-processing/sharp.processor';
import { GeminiTransport } from './gemini.transport';
import { geminiDocumentSchema, geminiRetryResponseSchema, type GeminiDocument } from './gemini.model';
import {
  GEMINI_ATTEMPT_TIMEOUT_MS, GEMINI_DEFAULT_MODEL, GEMINI_DOCUMENT_JSON_SCHEMA,
  GEMINI_EXTRACTION_PROMPT, GEMINI_MAX_ATTEMPTS, GEMINI_RETRY_DELAY_MS, GEMINI_TOTAL_TIMEOUT_MS,
} from './gemini.control';

@Injectable()
export class GeminiExtractionService {
  constructor(private transport: GeminiTransport, private sharp: SharpProcessor) {}

  async extractTrip(image: Buffer | string): Promise<OcrStructuredTrip> {
    const document = await this.extractDocument(image);
    const trip = document.trips[0];
    if (!trip) throw new BadRequestException({ code: 'OCR_NO_TEXT' });
    if (document.trips.length !== 1) throw new BadRequestException({ code: 'OCR_TOO_MANY_TRIPS' });
    return trip;
  }

  async extractDocument(image: Buffer | string): Promise<GeminiDocument> {
    const buffer = typeof image === 'string' ? await readFile(image) : image;
    return this.extractPreparedImage(await this.sharp.prepare(buffer));
  }

  async extractPreparedImage(image: Buffer): Promise<GeminiDocument> {
    const apiKey = process.env.GEMINI_API_KEY?.trim() ?? '';
    if (!apiKey || process.env.OCR_SUBSTITUTE_MODE === 'true') {
      throw new ServiceUnavailableException({ code: 'OCR_AUTH' });
    }
    const abort = new AbortController();
    const deadline = Date.now() + GEMINI_TOTAL_TIMEOUT_MS;
    const timer = setTimeout(() => abort.abort(), GEMINI_TOTAL_TIMEOUT_MS);
    try {
      for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt++) {
        try {
          const response = await this.transport.generate(apiKey, {
            model: process.env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL,
            contents: [{ role: 'user', parts: [
              { text: 'Extract every visible trip from this screenshot using the required schema.' },
              { inlineData: { mimeType: 'image/png', data: image.toString('base64') } },
            ] }],
            config: {
              systemInstruction: GEMINI_EXTRACTION_PROMPT, responseMimeType: 'application/json',
              responseJsonSchema: GEMINI_DOCUMENT_JSON_SCHEMA, temperature: 0,
              maxOutputTokens: 16384, abortSignal: abort.signal,
              httpOptions: { timeout: GEMINI_ATTEMPT_TIMEOUT_MS, retryOptions: { attempts: 1 } },
            },
          });
          if (abort.signal.aborted) throw new ServiceUnavailableException({ code: 'OCR_TIMEOUT' });
          const result = geminiDocumentSchema.parse(JSON.parse(response.text ?? ''));
          if (!result.trips.length || !result.raw_text.trim()) throw new BadRequestException({ code: 'OCR_NO_TEXT' });
          return result;
        } catch (error) {
          if (error instanceof HttpException) throw error;
          const status = error instanceof ApiError ? error.status : 0;
          const invalid = error instanceof SyntaxError || error instanceof ZodError;
          const timeout = abort.signal.aborted || status === 408 || status === 504 || error instanceof Error && /abort|timeout|timed out/i.test(error.name + error.message);
          const network = error instanceof TypeError && /fetch failed|network/i.test(error.message);
          const retryable = invalid || timeout || network || status === 429 || status >= 500;
          if (retryable && !abort.signal.aborted && attempt + 1 < GEMINI_MAX_ATTEMPTS) {
            const waitMs = error instanceof ApiError ? retryDelay(error) : GEMINI_RETRY_DELAY_MS;
            if (Date.now() + waitMs + GEMINI_ATTEMPT_TIMEOUT_MS < deadline) {
              try { await delay(waitMs, null, { signal: abort.signal }); }
              catch { throw new ServiceUnavailableException({ code: 'OCR_TIMEOUT' }); }
              continue;
            }
          }
          const code = status === 401 || status === 403 ? 'OCR_AUTH'
            : status === 429 ? 'RATE_LIMITED' : timeout ? 'OCR_TIMEOUT' : 'OCR_FAILED';
          throw new ServiceUnavailableException({ code });
        }
      }
      throw new ServiceUnavailableException({ code: 'OCR_FAILED' });
    } finally {
      clearTimeout(timer);
    }
  }
}

function retryDelay(error: ApiError): number {
  try {
    const parsed = geminiRetryResponseSchema.safeParse(JSON.parse(error.message));
    if (parsed.success) {
      const delays = parsed.data.error?.details?.flatMap((detail) => detail.retryDelay ? [Number.parseFloat(detail.retryDelay) * 1000] : []) ?? [];
      return Math.max(GEMINI_RETRY_DELAY_MS, ...delays);
    }
  } catch { /* Some network errors have no JSON body. */ }
  return GEMINI_RETRY_DELAY_MS;
}

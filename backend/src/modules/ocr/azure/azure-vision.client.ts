import { Injectable, Logger } from '@nestjs/common';
import ImageAnalysisClient, {
  isUnexpected,
  type ImageAnalysisClient as IImageAnalysisClient,
  type ImageAnalysisResultOutput,
  type DetectedTextLineOutput,
  type DetectedTextWordOutput,
  type ImagePointOutput,
} from '@azure-rest/ai-vision-image-analysis';
import { AzureKeyCredential } from '@azure/core-auth';
import { loadEnv } from '../../../config/env';
import {
  type AzureLine,
  type AzureReadResult,
  type AzureWord,
  type BoundingBox,
} from './types';

/**
 * Thin wrapper around Azure Image Analysis 4.0's Read (OCR) feature.
 *
 *  - Sends the preprocessed image buffer once; Azure performs detection,
 *    grouping, and confidence scoring server-side.
 *  - Flattens 4-point bounding polygons into axis-aligned boxes — downstream
 *    parsers don't care about rotation skew, only "left-of / above" relations.
 *  - Sorts lines top-to-bottom, then left-to-right (in LTR coords). For RTL
 *    UIs this means "first character on the line" is the right-most word; the
 *    line.text returned by Azure already preserves reading order so we don't
 *    re-shuffle words inside a line.
 *  - Maps service errors to our internal codes (OCR_BUSY / OCR_FAILED) so the
 *    OcrService can translate them into HTTP 503 + a stable error code.
 */
@Injectable()
export class AzureVisionClient {
  private readonly logger = new Logger(AzureVisionClient.name);
  private readonly client: IImageAnalysisClient;

  constructor() {
    const env = loadEnv();
    this.client = ImageAnalysisClient(
      env.AZURE_VISION_ENDPOINT,
      new AzureKeyCredential(env.AZURE_VISION_KEY),
    );
  }

  async read(image: Buffer): Promise<AzureReadResult> {
    let response;
    try {
      response = await this.client.path('/imageanalysis:analyze').post({
        body: image,
        queryParameters: { features: ['read'] },
        contentType: 'application/octet-stream',
      });
    } catch (err) {
      throw wrapNetworkError(err);
    }
    if (isUnexpected(response)) {
      throw wrapServiceError(response);
    }
    return parseImageAnalysisResult(response.body);
  }
}

/**
 * Converts an `ImageAnalysisResultOutput` payload into our normalized
 * `AzureReadResult`. Exposed (export, not inside the class) so unit tests can
 * call it with stubbed payloads without needing to mock the HTTP transport.
 */
export function parseImageAnalysisResult(body: ImageAnalysisResultOutput): AzureReadResult {
  const lines: AzureLine[] = [];
  const blockLines = body.readResult?.blocks?.[0]?.lines ?? [];
  for (const line of blockLines) {
    lines.push(toAzureLine(line));
  }
  lines.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);

  // Mean confidence across every word — used by the confidence engine as the
  // "extraction" component of the per-field confidence stack.
  let total = 0;
  let count = 0;
  for (const l of lines) {
    for (const w of l.words) {
      total += w.confidence;
      count += 1;
    }
  }
  const meanConfidence = count > 0 ? total / count : 0;

  const text = lines.map((l) => l.text).join('\n');

  return {
    text,
    lines,
    meanConfidence,
    imageWidth: body.metadata?.width ?? 0,
    imageHeight: body.metadata?.height ?? 0,
    // The Read API doesn't report language detection per-line in the v4
    // response; we infer broad script categories elsewhere if needed.
    languages: [],
  };
}

function toAzureLine(line: DetectedTextLineOutput): AzureLine {
  const words: AzureWord[] = (line.words ?? []).map(toAzureWord);
  const lineBbox = polygonToBbox(line.boundingPolygon);
  const meanConfidence = words.length
    ? words.reduce((a, w) => a + w.confidence, 0) / words.length
    : 0;
  return {
    text: line.text,
    meanConfidence,
    bbox: lineBbox,
    words,
    language: null,
  };
}

function toAzureWord(word: DetectedTextWordOutput): AzureWord {
  return {
    text: word.text,
    confidence: typeof word.confidence === 'number' ? word.confidence : 0,
    bbox: polygonToBbox(word.boundingPolygon),
  };
}

export function polygonToBbox(polygon: ImagePointOutput[] | undefined): BoundingBox {
  if (!polygon || polygon.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

interface AzureHttpError {
  status: string;
  body?: { error?: { code?: string; message?: string } };
  headers?: Record<string, string | undefined>;
}

function wrapServiceError(response: unknown): Error & { code: string } {
  const r = response as AzureHttpError;
  const status = r.status;
  const inner = r.body?.error;
  const innerCode = inner?.code ?? '';
  const innerMsg = inner?.message ?? '';
  let code = 'OCR_FAILED';
  if (status === '429') code = 'OCR_BUSY';
  else if (status === '408' || status === '504') code = 'OCR_TIMEOUT';
  else if (status === '401' || status === '403') code = 'OCR_AUTH';
  else if (status === '400' && /InvalidImage|notSupportedImage|InvalidImageSize/i.test(innerCode + innerMsg)) {
    code = 'OCR_IMAGE_INVALID';
  }
  const err = new Error(`Azure Vision ${status}: ${innerCode} ${innerMsg}`.trim()) as Error & { code: string };
  err.code = code;
  return err;
}

function wrapNetworkError(err: unknown): Error & { code: string } {
  const original = err instanceof Error ? err : new Error(String(err));
  const out = new Error(`Azure Vision transport failure: ${original.message}`) as Error & { code: string };
  out.code = 'OCR_FAILED';
  return out;
}

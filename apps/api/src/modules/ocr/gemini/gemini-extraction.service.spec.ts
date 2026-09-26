import { ApiError, GenerateContentResponse, FinishReason } from '@google/genai';
import { GeminiExtractionService } from './gemini-extraction.service';
import { GeminiTransport } from './gemini.transport';
import { SharpProcessor } from '../image-processing/sharp.processor';
import { GEMINI_TEST_DOCUMENT } from './gemini-test.data';
import { GEMINI_DOCUMENT_JSON_SCHEMA, GEMINI_MAX_ATTEMPTS } from './gemini.control';
import { OcrStructuredPlatform } from '@ehsbha/api-contracts';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

jest.mock('node:timers/promises', () => ({ setTimeout: jest.fn().mockResolvedValue(null) }));

function response(text: string): GenerateContentResponse {
  const result = new GenerateContentResponse();
  result.candidates = [{ content: { parts: [{ text }], role: 'model' }, finishReason: FinishReason.STOP }];
  return result;
}

describe('Gemini extraction boundary', () => {
  const transport = new GeminiTransport();
  const sharp = new SharpProcessor();
  const service = new GeminiExtractionService(transport, sharp);
  const originalEnvironment = { ...process.env };
  const image = Buffer.from('prepared-png');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-credential';
    process.env.OCR_SUBSTITUTE_MODE = 'false';
    jest.spyOn(transport, 'generate').mockResolvedValue(response(JSON.stringify(GEMINI_TEST_DOCUMENT)));
    jest.spyOn(sharp, 'prepare').mockResolvedValue(image);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); process.env = { ...originalEnvironment }; });

  it('uses strict JSON mode, schema, image bytes and bounded SDK attempts', async () => {
    expect(await service.extractTrip(image)).toEqual(GEMINI_TEST_DOCUMENT.trips[0]);
    expect(transport.generate).toHaveBeenCalledWith('test-gemini-credential', expect.objectContaining({
      contents: [{ role: 'user', parts: [expect.objectContaining({ text: expect.any(String) }), { inlineData: { mimeType: 'image/png', data: image.toString('base64') } }] }],
      config: expect.objectContaining({ responseMimeType: 'application/json', responseJsonSchema: GEMINI_DOCUMENT_JSON_SCHEMA, httpOptions: { timeout: 25000, retryOptions: { attempts: 1 } } }),
    }));
  });

  it.each(Object.values(OcrStructuredPlatform))('validates platform %s', async (platform) => {
    const document = structuredClone(GEMINI_TEST_DOCUMENT);
    document.trips[0].platform = platform;
    jest.mocked(transport.generate).mockResolvedValue(response(JSON.stringify(document)));
    expect((await service.extractTrip(image)).platform).toBe(platform);
  });

  it('accepts a file path and validates its bytes through image preprocessing', async () => {
    const filename = resolve(__dirname, '../../../../test-fixtures/uber/uber-1Trip-AR-1.jpeg');
    expect(await service.extractTrip(filename)).toEqual(GEMINI_TEST_DOCUMENT.trips[0]);
    expect(sharp.prepare).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it('cancels at the total deadline without another attempt', async () => {
    jest.useFakeTimers();
    jest.mocked(transport.generate).mockImplementation((_key, request) => new Promise<GenerateContentResponse>((_resolve, reject) => {
      request.config?.abortSignal?.addEventListener('abort', () => reject(new Error('AbortError')));
    }));
    const pending = expect(service.extractPreparedImage(image)).rejects.toMatchObject({ response: { code: 'OCR_TIMEOUT' } });
    await jest.advanceTimersByTimeAsync(60000);
    await pending;
    expect(transport.generate).toHaveBeenCalledTimes(1);
  });

  it('retries a transient network failure', async () => {
    jest.mocked(transport.generate).mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(service.extractDocument(image)).resolves.toEqual(GEMINI_TEST_DOCUMENT);
    expect(transport.generate).toHaveBeenCalledTimes(2);
  });

  it('retains all trips and refuses silent truncation in the single-trip method', async () => {
    const document = { ...GEMINI_TEST_DOCUMENT, trips: [...GEMINI_TEST_DOCUMENT.trips, ...GEMINI_TEST_DOCUMENT.trips] };
    jest.mocked(transport.generate).mockResolvedValue(response(JSON.stringify(document)));
    expect((await service.extractDocument(image)).trips).toHaveLength(2);
    await expect(service.extractTrip(image)).rejects.toMatchObject({ response: { code: 'OCR_TOO_MANY_TRIPS' } });
  });

  it.each(['not JSON', '{"trips":[]}', JSON.stringify({ ...GEMINI_TEST_DOCUMENT, extra: true })])('retries invalid JSON or schema once', async (text) => {
    jest.mocked(transport.generate).mockResolvedValueOnce(response(text));
    expect((await service.extractDocument(image)).trips).toHaveLength(1);
    expect(transport.generate).toHaveBeenCalledTimes(2);
  });

  it('rejects repeated invalid output without exposing its contents', async () => {
    jest.mocked(transport.generate).mockResolvedValue(response('private provider text'));
    await expect(service.extractDocument(image)).rejects.toMatchObject({ response: { code: 'OCR_FAILED' } });
    expect(transport.generate).toHaveBeenCalledTimes(GEMINI_MAX_ATTEMPTS);
  });

  it.each([408, 429, 500, 503])('retries transient HTTP %s', async (status) => {
    jest.mocked(transport.generate).mockRejectedValueOnce(new ApiError({ status, message: 'private provider text' }));
    await expect(service.extractDocument(image)).resolves.toEqual(GEMINI_TEST_DOCUMENT);
    expect(transport.generate).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403])('does not retry authorization error %s', async (status) => {
    jest.mocked(transport.generate).mockRejectedValue(new ApiError({ status, message: 'private provider text' }));
    await expect(service.extractDocument(image)).rejects.toMatchObject({ response: { code: 'OCR_AUTH' } });
    expect(transport.generate).toHaveBeenCalledTimes(1);
  });

  it('keeps rate limiting actionable after bounded retries', async () => {
    jest.mocked(transport.generate).mockRejectedValue(new ApiError({ status: 429, message: 'quota details' }));
    await expect(service.extractDocument(image)).rejects.toMatchObject({ response: { code: 'RATE_LIMITED' } });
    expect(transport.generate).toHaveBeenCalledTimes(2);
  });

  it('honors server retry delays and does not retry beyond the total budget', async () => {
    jest.mocked(transport.generate).mockRejectedValueOnce(new ApiError({ status: 429, message: JSON.stringify({ error: { details: [{ retryDelay: '10s' }] } }) }));
    await expect(service.extractPreparedImage(image)).resolves.toEqual(GEMINI_TEST_DOCUMENT);
    expect(delay).toHaveBeenCalledWith(10000, null, { signal: expect.any(AbortSignal) });
    jest.mocked(transport.generate).mockClear().mockRejectedValue(new ApiError({ status: 429, message: JSON.stringify({ error: { details: [{ retryDelay: '120s' }] } }) }));
    await expect(service.extractPreparedImage(image)).rejects.toMatchObject({ response: { code: 'RATE_LIMITED' } });
    expect(transport.generate).toHaveBeenCalledTimes(1);
  });

  it('does not call the provider in substitute mode or without a key', async () => {
    process.env.OCR_SUBSTITUTE_MODE = 'true';
    await expect(service.extractDocument(image)).rejects.toMatchObject({ response: { code: 'OCR_AUTH' } });
    process.env.OCR_SUBSTITUTE_MODE = 'false';
    process.env.GEMINI_API_KEY = '';
    await expect(service.extractDocument(image)).rejects.toMatchObject({ response: { code: 'OCR_AUTH' } });
    expect(transport.generate).not.toHaveBeenCalled();
  });

  it('returns actionable no-text errors for unrelated or unreadable images without a retry', async () => {
    jest.mocked(transport.generate).mockResolvedValue(response('{"raw_text":"unreadable","trips":[]}'));
    await expect(service.extractDocument(image)).rejects.toMatchObject({ response: { code: 'OCR_NO_TEXT' } });
    expect(transport.generate).toHaveBeenCalledTimes(1);
  });

  it('rejects image decode failures before sending bytes', async () => {
    jest.mocked(sharp.prepare).mockRejectedValue(new Error('invalid image'));
    await expect(service.extractDocument(image)).rejects.toThrow('invalid image');
    expect(transport.generate).not.toHaveBeenCalled();
  });
});

import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { HttpException } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { OcrStructuredPlatform } from '@ehsbha/api-contracts';
import { GeminiExtractionService } from '../src/modules/ocr/gemini/gemini-extraction.service';
import { GeminiTransport } from '../src/modules/ocr/gemini/gemini.transport';
import { GEMINI_DEFAULT_MODEL, GEMINI_EXTRACTION_PROMPT } from '../src/modules/ocr/gemini/gemini.control';
import { geminiDocumentSchema, type GeminiDocument } from '../src/modules/ocr/gemini/gemini.model';
import { SharpProcessor } from '../src/modules/ocr/image-processing/sharp.processor';

interface FixtureResult {
  filename: string;
  sha256: string;
  platform: string;
  fare: string;
  passed: boolean;
  durationMs: number;
  failures: string[];
  document: GeminiDocument | null;
}

enum FixtureScope { Representative = 'representative', All = 'all' }

const expectationsSchema = z.object({
  images: z.array(z.object({
    file: z.string(), platform: z.nativeEnum(OcrStructuredPlatform),
    tripCount: z.number().int().positive(), totalFares: z.array(z.number().nullable()),
    netEarnings: z.array(z.number().nullable()), cashCollected: z.array(z.number().nullable()),
    representative: z.boolean(), coverage: z.string(),
  })),
});
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif']);

async function imageFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await imageFiles(filename));
    else if (entry.isFile() && imageExtensions.has(extname(entry.name).toLowerCase())) files.push(filename);
  }
  return files.sort();
}

async function main(): Promise<void> {
  const fixtureDirectory = resolve(__dirname, '..', 'test-fixtures');
  const outputDirectory = resolve(__dirname, '../../../verification-output/ocr-gemini');
  const expectations = expectationsSchema.parse(JSON.parse(await readFile(join(fixtureDirectory, 'gemini-expectations.json'), 'utf8')));
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--all' && arg !== '--list')) throw new Error('Unsupported fixture argument');
  const scope = args.includes('--all') ? FixtureScope.All : FixtureScope.Representative;
  const selected = expectations.images.filter((entry) => scope === FixtureScope.All || entry.representative);
  if (scope === FixtureScope.Representative && (selected.length < 5 || selected.length > 10)) {
    throw new Error('Representative batch must contain 5 to 10 images');
  }
  const inventory = await imageFiles(fixtureDirectory);
  const files = inventory.filter((file) => scope === FixtureScope.All || selected.some((entry) => entry.file === relative(fixtureDirectory, file).replaceAll('\\', '/')));
  const intervalMs = z.coerce.number().int().min(0).max(60000).parse(process.env.GEMINI_FIXTURE_DELAY_MS ?? 10000);
  if (!files.length) throw new Error('No image fixtures found');
  if (args.includes('--list')) {
    for (const entry of selected) process.stdout.write(`${entry.file} | ${entry.platform} | ${entry.coverage}\n`);
    process.stdout.write(`${selected.length} selected from ${inventory.length} image fixtures (${scope}); no API calls made.\n`);
    if (files.length !== selected.length) process.exitCode = 1;
    return;
  }
  const service = new GeminiExtractionService(new GeminiTransport(), new SharpProcessor());
  const results: FixtureResult[] = [];
  process.stdout.write(`Live Gemini fixture verification: ${process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL}, ${files.length}/${inventory.length} images (${scope})\n`);
  process.stdout.write('Filename | Platform | Fare / earnings | Result\n');
  for (const filename of files) {
    if (results.length) await delay(intervalMs);
    const name = relative(fixtureDirectory, filename).replaceAll('\\', '/');
    const expected = expectations.images.find((entry) => entry.file === name);
    const buffer = await readFile(filename);
    const started = Date.now();
    const result: FixtureResult = {
      filename: name, sha256: createHash('sha256').update(buffer).digest('hex'),
      platform: '-', fare: '-', passed: false, durationMs: 0, failures: [], document: null,
    };
    try {
      const document = geminiDocumentSchema.parse(await service.extractDocument(buffer));
      result.document = document;
      result.platform = [...new Set(document.trips.map((trip) => trip.platform))].join(',');
      result.fare = document.trips.map((trip) => String(trip.fare_details.total_fare ?? trip.fare_details.net_earnings ?? '-')).join(',');
      if (!expected) result.failures.push('Fixture expectation missing');
      else if (document.trips.length !== expected.tripCount) result.failures.push('Trip count differs from visible cards');
      document.trips.forEach((trip, index) => {
        if (expected && trip.platform !== expected.platform) result.failures.push(`Trip ${index + 1}: incorrect platform`);
        const fare = trip.fare_details;
        if (fare.total_fare === null && fare.net_earnings === null) result.failures.push(`Trip ${index + 1}: missing fare and earnings`);
        const expectedFare = expected?.totalFares[index];
        if (expectedFare != null && (fare.total_fare === null || Math.abs(fare.total_fare - expectedFare) > 0.011)) {
          result.failures.push(`Trip ${index + 1}: passenger fare differs from fixture`);
        }
        if (expectedFare === null && fare.total_fare !== null) result.failures.push(`Trip ${index + 1}: invented gross fare on earnings summary`);
        if (expected) {
          const expectedNet = expected.netEarnings[index] ?? null;
          const expectedCash = expected.cashCollected[index] ?? null;
          if (!equalAmount(fare.net_earnings, expectedNet)) result.failures.push(`Trip ${index + 1}: net earnings differ from visible income`);
          if (!equalAmount(fare.cash_collected, expectedCash)) result.failures.push(`Trip ${index + 1}: cash collection differs from payment evidence`);
        }
      });
      result.passed = result.failures.length === 0;
    } catch (error) {
      // Provider errors may include sensitive headers or image data; emit governed codes only.
      let code = 'EXTRACTION_FAILED';
      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === 'object' && 'code' in response && typeof response.code === 'string') code = response.code;
      }
      result.failures.push(code);
    }
    result.durationMs = Date.now() - started;
    results.push(result);
    process.stdout.write(`${result.filename} | ${result.platform} | ${result.fare} | ${result.passed ? 'PASS' : 'FAIL: ' + result.failures.join('; ')}\n`);
    if (result.failures.includes('RATE_LIMITED') || result.failures.includes('OCR_AUTH')) break;
  }
  const unprocessedFiles = selected.filter((expected) => !results.some((result) => result.filename === expected.file));
  const passed = results.filter((result) => result.passed).length;
  const report = {
    completedAt: new Date().toISOString(), model: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
    live: true, scope, fixtureInventory: inventory.length, total: selected.length,
    attempted: results.length, passed, failed: results.length - passed,
    promptHash: createHash('sha256').update(GEMINI_EXTRACTION_PROMPT).digest('hex'),
    unprocessedFiles: unprocessedFiles.map((entry) => entry.file), results,
  };
  await mkdir(outputDirectory, { recursive: true });
  const reportPath = join(outputDirectory, `fixtures-${Date.now()}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`${passed}/${selected.length} images passed; ${unprocessedFiles.length} unprocessed fixtures. Report: ${reportPath}\n`);
  if (passed !== selected.length || unprocessedFiles.length || results.some((result) => !result.passed)) process.exitCode = 1;
}

function equalAmount(actual: number | null, expected: number | null): boolean {
  if (actual === null || expected === null) return actual === expected;
  return Math.abs(actual - expected) <= 0.011;
}

main().catch(() => {
  process.stderr.write('Fixture runner setup failed. Check environment, fixture manifest and filesystem access.\n');
  process.exitCode = 1;
});

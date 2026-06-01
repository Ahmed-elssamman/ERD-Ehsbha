/**
 * OCR pipeline benchmark — runs the production OCR stack against the curated
 * test fixtures under `backend/test-fixtures/` and diffs the parsed output
 * against hand-written golden JSON files.
 *
 *   $ npm --workspace backend run benchmark:ocr
 *
 * The script loads `test-fixtures/cases.json`, processes each case through the
 * same pipeline the HTTP controller uses (sharp → Azure Vision → platform
 * parser → multi-screenshot merge → confidence scorer → validator), then
 * compares to the golden. Multi-trip cases are flagged as "skipped" until the
 * Uber summary-screen splitter is implemented.
 *
 * Output:
 *   - Console: per-case pass/fail with mismatch details + summary table.
 *   - JSON:    `test-fixtures/results/baseline-{ISO-timestamp}.json` with the
 *              raw OCR text, parsed output, and field-level diff per case.
 *              Useful for diffing after each iteration of the pipeline.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

import { SharpProcessor } from '../src/modules/ocr/image-processing/sharp.processor';
import { AzureVisionClient } from '../src/modules/ocr/azure/azure-vision.client';
import { AzureDocumentIntelligenceClient } from '../src/modules/ocr/azure/azure-document-intelligence.client';
import { AzureVisionProvider } from '../src/modules/ocr/azure/azure-vision.provider';
import { PlatformDetector } from '../src/modules/ocr/detectors/platform.detector';
import { SemanticNormalizer } from '../src/modules/ocr/semantic/normalizer';
import { UberParser } from '../src/modules/ocr/parsers/uber.parser';
import { IndriveParser } from '../src/modules/ocr/parsers/indrive.parser';
import { DidiParser } from '../src/modules/ocr/parsers/didi.parser';
import { CareemParser } from '../src/modules/ocr/parsers/careem.parser';
import { MultiScreenshotMerger } from '../src/modules/ocr/merge/multi-screenshot.merger';
import { MultiTripSplitter } from '../src/modules/ocr/merge/multi-trip.splitter';
import { ConfidenceScorer } from '../src/modules/ocr/confidence/scorer';
import { TripValidator } from '../src/modules/ocr/validation/trip-validator';
import { OcrService, azureToOcrResult } from '../src/modules/ocr/ocr.service';
import { OcrExtractResponseDto, OcrPlatform } from '../src/modules/ocr/dto/ocr.dto';

interface Case {
  id: string;
  platform: OcrPlatform;
  kind: 'single-trip' | 'multi-trip';
  files: string[];
  golden: string;
}

interface Manifest {
  cases: Case[];
}

interface GoldenSingleTrip {
  platform: OcrPlatform;
  grossEgp: number | null;
  receivedEgp: number | null;
  commissionEgp: number | null;
  tipEgp: number | null;
  waitingFeeEgp: number | null;
  paidKm: number | null;
  totalKm: number | null;
  durationSec: number | null;
  startedAt: string | null;
  endedAt: string | null;
  paymentMethod: 'cash' | 'card' | 'wallet' | 'unknown';
  vehicleType: string | null;
  pickup: string | null;
  destination: string | null;
}

interface GoldenMultiTrip {
  platform: OcrPlatform;
  kind: 'multi-trip';
  trips: Array<Omit<GoldenSingleTrip, 'platform'>>;
}

interface FieldDiff {
  field: string;
  expected: unknown;
  actual: unknown;
  status: 'match' | 'mismatch' | 'missing' | 'extra';
}

interface CaseResult {
  caseId: string;
  platform: OcrPlatform;
  kind: 'single-trip' | 'multi-trip';
  files: string[];
  status: 'pass' | 'fail' | 'skipped' | 'error';
  reason?: string;
  rawText: string[];
  parsed: OcrExtractResponseDto | null;
  detectedPlatform: OcrPlatform | null;
  diffs: FieldDiff[];
  fieldsPassed: number;
  fieldsTotal: number;
  meanConfidence: number;
  warnings: string[];
}

const FIXTURES_DIR = resolve(__dirname, '..', 'test-fixtures');
const RESULTS_DIR = join(FIXTURES_DIR, 'results');

const NUMERIC_TOL = 0.011;
const SCALAR_FIELDS: Array<keyof GoldenSingleTrip> = [
  'grossEgp',
  'receivedEgp',
  'commissionEgp',
  'tipEgp',
  'waitingFeeEgp',
  'paidKm',
  'totalKm',
  'durationSec',
];

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= NUMERIC_TOL;
}

function isoEqual(a: string | null, b: string | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a === b;
  return Math.abs(ta - tb) <= 60_000;
}

function normalizeString(s: string | null | undefined): string {
  if (s == null) return '';
  return s.replace(/[\s‎‏]+/g, ' ').trim().toLowerCase();
}

function stringSimilar(expected: string, actual: string): boolean {
  const e = normalizeString(expected);
  const a = normalizeString(actual);
  if (!e && !a) return true;
  if (!e || !a) return false;
  if (e === a) return true;
  return a.includes(e) || e.includes(a);
}

function diffCase(golden: GoldenSingleTrip, parsed: OcrExtractResponseDto): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const p = parsed.parsed;

  if (golden.platform !== parsed.platform) {
    diffs.push({
      field: 'platform',
      expected: golden.platform,
      actual: parsed.platform,
      status: parsed.platform == null ? 'missing' : 'mismatch',
    });
  } else {
    diffs.push({ field: 'platform', expected: golden.platform, actual: parsed.platform, status: 'match' });
  }

  for (const f of SCALAR_FIELDS) {
    const exp = golden[f] as number | null;
    const act = (p as Record<string, unknown>)[f] as number | null;
    if (exp == null && act == null) {
      diffs.push({ field: f, expected: exp, actual: act, status: 'match' });
    } else if (exp == null && act != null) {
      diffs.push({ field: f, expected: exp, actual: act, status: 'extra' });
    } else if (exp != null && act == null) {
      diffs.push({ field: f, expected: exp, actual: act, status: 'missing' });
    } else {
      diffs.push({
        field: f,
        expected: exp,
        actual: act,
        status: approxEqual(exp as number, act as number) ? 'match' : 'mismatch',
      });
    }
  }

  diffs.push({
    field: 'startedAt',
    expected: golden.startedAt,
    actual: p.startedAt,
    status: isoEqual(golden.startedAt, p.startedAt ?? null) ? 'match' : (p.startedAt ? 'mismatch' : 'missing'),
  });
  diffs.push({
    field: 'endedAt',
    expected: golden.endedAt,
    actual: p.endedAt,
    status: isoEqual(golden.endedAt, p.endedAt ?? null) ? 'match' : (p.endedAt ? 'mismatch' : 'missing'),
  });

  diffs.push({
    field: 'paymentMethod',
    expected: golden.paymentMethod,
    actual: p.paymentMethod,
    status: golden.paymentMethod === p.paymentMethod ? 'match' : 'mismatch',
  });

  for (const sf of ['vehicleType', 'pickup', 'destination'] as const) {
    const exp = (golden as unknown as Record<string, unknown>)[sf] as string | null;
    const act = (p as Record<string, unknown>)[sf] as string | null;
    if (exp == null && act == null) {
      diffs.push({ field: sf, expected: exp, actual: act, status: 'match' });
    } else if (exp == null && act != null) {
      diffs.push({ field: sf, expected: exp, actual: act, status: 'extra' });
    } else if (exp != null && act == null) {
      diffs.push({ field: sf, expected: exp, actual: act, status: 'missing' });
    } else {
      diffs.push({
        field: sf,
        expected: exp,
        actual: act,
        status: stringSimilar(exp as string, act as string) ? 'match' : 'mismatch',
      });
    }
  }

  return diffs;
}

class BenchmarkRunner {
  private readonly ocr: OcrService;
  private readonly visionClient: AzureVisionClient;
  private readonly sharp: SharpProcessor;

  constructor() {
    this.sharp = new SharpProcessor();
    this.visionClient = new AzureVisionClient();
    const diClient = new AzureDocumentIntelligenceClient();
    const azureProvider = new AzureVisionProvider(this.visionClient, diClient);
    const normalizer = new SemanticNormalizer();
    const detector = new PlatformDetector(normalizer);
    const uber = new UberParser(normalizer);
    const indrive = new IndriveParser(normalizer);
    const didi = new DidiParser(normalizer);
    const careem = new CareemParser(normalizer);
    const merger = new MultiScreenshotMerger();
    const splitter = new MultiTripSplitter();
    const scorer = new ConfidenceScorer();
    const validator = new TripValidator();
    this.ocr = new OcrService(azureProvider, this.sharp, detector, merger, splitter, scorer, validator, uber, indrive, didi, careem);
  }

  /**
   * Multi-trip cases: the golden has a `trips: [...]` array, the response
   * has `trips: [{ parsed, fieldConfidences }, ...]`. We diff trip-by-trip,
   * tagging each field path with its 1-based card index so downstream output
   * shows where a mismatch is. A trip-count mismatch surfaces as its own
   * pseudo-field so it dominates the report.
   */
  private diffMultiTrip(
    c: Case,
    parsed: OcrExtractResponseDto | null,
    parseError: string | null,
    rawTexts: string[],
  ): CaseResult {
    if (parseError || !parsed) {
      return {
        caseId: c.id,
        platform: c.platform,
        kind: c.kind,
        files: c.files,
        status: 'error',
        reason: parseError ?? 'no parsed output',
        rawText: rawTexts,
        parsed: null,
        detectedPlatform: null,
        diffs: [],
        fieldsPassed: 0,
        fieldsTotal: 0,
        meanConfidence: 0,
        warnings: [],
      };
    }

    const golden = JSON.parse(
      readFileSync(join(FIXTURES_DIR, c.golden), 'utf-8'),
    ) as GoldenMultiTrip;
    const goldenTrips = golden.trips ?? [];
    const actualTrips = parsed.trips ?? [];

    const allDiffs: FieldDiff[] = [];
    if (goldenTrips.length !== actualTrips.length) {
      allDiffs.push({
        field: 'tripCount',
        expected: goldenTrips.length,
        actual: actualTrips.length,
        status: 'mismatch',
      });
    }

    const pairCount = Math.min(goldenTrips.length, actualTrips.length);
    for (let i = 0; i < pairCount; i++) {
      const expandedExpected: GoldenSingleTrip = {
        platform: c.platform,
        ...goldenTrips[i],
      } as GoldenSingleTrip;
      const tripResponse: OcrExtractResponseDto = {
        ...parsed,
        platform: c.platform,
        parsed: actualTrips[i].parsed,
        fieldConfidences: actualTrips[i].fieldConfidences,
      };
      const tripDiffs = diffCase(expandedExpected, tripResponse);
      for (const d of tripDiffs) {
        allDiffs.push({ ...d, field: `trip${i + 1}.${d.field}` });
      }
    }

    const fieldsPassed = allDiffs.filter((d) => d.status === 'match').length;
    const fieldsTotal = allDiffs.length;
    const allMatch = fieldsTotal > 0 && fieldsPassed === fieldsTotal;

    return {
      caseId: c.id,
      platform: c.platform,
      kind: c.kind,
      files: c.files,
      status: allMatch ? 'pass' : 'fail',
      rawText: rawTexts,
      parsed,
      detectedPlatform: parsed.platform,
      diffs: allDiffs,
      fieldsPassed,
      fieldsTotal,
      meanConfidence: parsed.ocrMeanConfidence,
      warnings: parsed.warnings,
    };
  }

  async runCase(c: Case): Promise<CaseResult> {
    const files = await Promise.all(
      c.files.map(async (rel) => ({
        rel,
        buffer: await readFile(join(FIXTURES_DIR, rel)),
      })),
    );

    const rawTexts: string[] = [];
    for (const f of files) {
      try {
        const prepared = await this.sharp.prepare(f.buffer);
        const read = await this.visionClient.read(prepared);
        rawTexts.push(read.text);
      } catch (err) {
        rawTexts.push(`<<RAW_OCR_FAILED: ${(err as Error).message}>>`);
      }
    }

    let parsed: OcrExtractResponseDto | null = null;
    let parseError: string | null = null;
    try {
      parsed = await this.ocr.extract(
        files.map((f) => ({
          buffer: f.buffer,
          mimetype: 'image/jpeg',
          size: f.buffer.byteLength,
          originalname: f.rel,
        })),
        {
          mode: c.kind === 'multi-trip' ? 'multi' : 'single',
          platform: c.platform,
        },
      );
    } catch (err) {
      parseError = (err as Error).message;
    }

    if (c.kind === 'multi-trip') {
      return this.diffMultiTrip(c, parsed, parseError, rawTexts);
    }

    if (parseError || !parsed) {
      return {
        caseId: c.id,
        platform: c.platform,
        kind: c.kind,
        files: c.files,
        status: 'error',
        reason: parseError ?? 'no parsed output',
        rawText: rawTexts,
        parsed: null,
        detectedPlatform: null,
        diffs: [],
        fieldsPassed: 0,
        fieldsTotal: 0,
        meanConfidence: 0,
        warnings: [],
      };
    }

    const goldenRaw = JSON.parse(await readFile(join(FIXTURES_DIR, c.golden), 'utf-8')) as GoldenSingleTrip;
    const diffs = diffCase(goldenRaw, parsed);
    const fieldsPassed = diffs.filter((d) => d.status === 'match').length;
    const fieldsTotal = diffs.length;
    const allMatch = fieldsPassed === fieldsTotal;

    return {
      caseId: c.id,
      platform: c.platform,
      kind: c.kind,
      files: c.files,
      status: allMatch ? 'pass' : 'fail',
      rawText: rawTexts,
      parsed,
      detectedPlatform: parsed.platform,
      diffs,
      fieldsPassed,
      fieldsTotal,
      meanConfidence: parsed.ocrMeanConfidence,
      warnings: parsed.warnings,
    };
  }
}

function formatStatus(s: CaseResult['status']): string {
  const colors: Record<string, string> = { pass: '\x1b[32m', fail: '\x1b[31m', skipped: '\x1b[33m', error: '\x1b[31m' };
  const reset = '\x1b[0m';
  const c = colors[s] ?? '';
  return `${c}${s.toUpperCase()}${reset}`;
}

function printSummary(results: CaseResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('BENCHMARK SUMMARY');
  console.log('='.repeat(80));

  const byPlatform: Record<string, CaseResult[]> = {};
  for (const r of results) {
    (byPlatform[r.platform] ??= []).push(r);
  }

  for (const [platform, list] of Object.entries(byPlatform)) {
    const pass = list.filter((r) => r.status === 'pass').length;
    const fail = list.filter((r) => r.status === 'fail').length;
    const skipped = list.filter((r) => r.status === 'skipped').length;
    const errored = list.filter((r) => r.status === 'error').length;
    const totalFields = list.reduce((a, r) => a + r.fieldsTotal, 0);
    const passedFields = list.reduce((a, r) => a + r.fieldsPassed, 0);
    const accuracy = totalFields > 0 ? ((passedFields / totalFields) * 100).toFixed(1) : 'n/a';
    console.log(`\n${platform}:`);
    console.log(`  cases:  ${pass} pass · ${fail} fail · ${skipped} skipped · ${errored} error  (${list.length} total)`);
    console.log(`  fields: ${passedFields}/${totalFields} matched  (${accuracy}% accuracy)`);
  }

  const allDiffs = results.flatMap((r) => r.diffs);
  const mismatchesByField: Record<string, number> = {};
  for (const d of allDiffs) {
    if (d.status !== 'match') {
      mismatchesByField[d.field] = (mismatchesByField[d.field] ?? 0) + 1;
    }
  }
  const sortedFields = Object.entries(mismatchesByField).sort((a, b) => b[1] - a[1]);
  if (sortedFields.length > 0) {
    console.log('\nTop failing fields:');
    for (const [field, count] of sortedFields.slice(0, 12)) {
      console.log(`  · ${field.padEnd(20)} ${count} failures`);
    }
  }

  const totalFields = allDiffs.length;
  const totalPassed = allDiffs.filter((d) => d.status === 'match').length;
  const overall = totalFields > 0 ? ((totalPassed / totalFields) * 100).toFixed(1) : 'n/a';
  console.log('\n' + '-'.repeat(80));
  console.log(`OVERALL: ${totalPassed}/${totalFields} fields matched (${overall}% accuracy)`);
  console.log('='.repeat(80));
}

function printCaseDetail(r: CaseResult): void {
  console.log(`\n[${formatStatus(r.status)}] ${r.caseId}  (${r.platform}, ${r.kind})`);
  console.log(`  files:   ${r.files.join(', ')}`);
  console.log(`  detected:${r.detectedPlatform ?? 'none'}  meanConf=${r.meanConfidence.toFixed(3)}`);
  if (r.reason) console.log(`  reason:  ${r.reason}`);
  if (r.warnings.length > 0) console.log(`  warnings:${r.warnings.join(', ')}`);
  const failed = r.diffs.filter((d) => d.status !== 'match');
  if (failed.length > 0) {
    console.log(`  mismatches (${failed.length}/${r.fieldsTotal}):`);
    for (const d of failed) {
      const exp = d.expected == null ? 'null' : JSON.stringify(d.expected);
      const act = d.actual == null ? 'null' : JSON.stringify(d.actual);
      console.log(`    · ${d.field.padEnd(18)} [${d.status}]  exp=${exp}  got=${act}`);
    }
  }
}

async function main(): Promise<void> {
  const manifestPath = join(FIXTURES_DIR, 'cases.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing manifest: ${manifestPath}`);
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as Manifest;

  console.log(`Loaded ${manifest.cases.length} cases from ${manifestPath}`);
  console.log(`Fixtures dir: ${FIXTURES_DIR}`);
  console.log('Starting benchmark — this calls Azure Vision for each image.\n');

  const runner = new BenchmarkRunner();
  const results: CaseResult[] = [];

  for (const c of manifest.cases) {
    process.stdout.write(`  · ${c.id.padEnd(35)} `);
    const t0 = Date.now();
    let r: CaseResult;
    try {
      r = await runner.runCase(c);
    } catch (err) {
      r = {
        caseId: c.id,
        platform: c.platform,
        kind: c.kind,
        files: c.files,
        status: 'error',
        reason: (err as Error).message,
        rawText: [],
        parsed: null,
        detectedPlatform: null,
        diffs: [],
        fieldsPassed: 0,
        fieldsTotal: 0,
        meanConfidence: 0,
        warnings: [],
      };
    }
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`${formatStatus(r.status)}  ${r.fieldsPassed}/${r.fieldsTotal} fields  ${elapsed}s`);
    results.push(r);
  }

  for (const r of results) {
    if (r.status === 'fail' || r.status === 'error') printCaseDetail(r);
  }

  printSummary(results);

  if (!existsSync(RESULTS_DIR)) {
    await mkdir(RESULTS_DIR, { recursive: true });
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(RESULTS_DIR, `baseline-${ts}.json`);
  await writeFile(outPath, JSON.stringify({ runAt: new Date().toISOString(), cases: results }, null, 2));
  console.log(`\nFull report written to ${outPath}`);
}

main().catch((err) => {
  console.error('[benchmark] FAILED:', err);
  process.exit(1);
});

void azureToOcrResult;

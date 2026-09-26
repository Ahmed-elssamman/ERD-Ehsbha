import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, '../../../specs/001-baseline-governance/contracts/baseline-report.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

async function compileValidator() {
  const { default: Ajv } = await import('ajv');
  const addFormats = (await import('ajv-formats')).default;
  const ajv = new Ajv({ strict: true, allErrors: true, allowMatchingProperties: true, validateSchema: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

function validReport(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    revision: 'abc123',
    branch: 'test',
    startedAt: '2026-06-08T00:00:00.000Z',
    completedAt: '2026-06-08T01:00:00.000Z',
    environment: { os: 'win32', node: '22', npm: '10', postgresql: '16', authoritative: true },
    overallStatus: 'passed',
    steps: [
      { id: 'step-001', group: 'lint', status: 'passed', durationMs: 100, summary: 'OK', artifactPaths: [] },
    ],
    knownLimitations: [],
    artifactMeasurements: [],
    coverageRecords: [],
    ...overrides,
  };
}

describe('Baseline Report Contract', () => {
  let validate;

  before(async () => {
    validate = await compileValidator();
  });

  it('rejects unknown fields', () => {
    const report = validReport({ unknownField: 'should not be here' });
    const valid = validate(report);
    assert.strictEqual(valid, false, 'Should reject unknown fields');
  });

  it('rejects invalid status values', () => {
    const report = validReport({ overallStatus: 'invalid_status' });
    const valid = validate(report);
    assert.strictEqual(valid, false);
  });

  it('rejects missing required arrays', () => {
    const report = validReport();
    delete report.steps;
    const valid = validate(report);
    assert.strictEqual(valid, false);
  });

  it('validates a passed report', () => {
    const report = validReport();
    const valid = validate(report);
    assert.strictEqual(valid, true);
  });

  it('validates a failed report', () => {
    const report = validReport({
      overallStatus: 'failed',
      steps: [
        { id: 'step-001', group: 'lint', status: 'failed', durationMs: 100, summary: 'FAIL', artifactPaths: [] },
      ],
    });
    const valid = validate(report);
    assert.strictEqual(valid, true);
  });
});

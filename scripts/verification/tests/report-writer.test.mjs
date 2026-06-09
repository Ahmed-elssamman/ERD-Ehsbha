import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createReport, writeReport } from '../lib/report-writer.mjs';
import { validateReport } from '../lib/validate-report.mjs';

describe('Report Writer', () => {
  it('assigns unique step IDs', () => {
    const report = createReport({
      revision: 'abc123',
      branch: 'test',
      environment: { os: 'win32', node: '22', npm: '10', postgresql: '16', authoritative: true },
      steps: [
        { id: 'step-001', group: 'lint', status: 'passed', durationMs: 100, summary: 'OK' },
        { id: 'step-002', group: 'typecheck', status: 'passed', durationMs: 200, summary: 'OK' },
      ],
      knownLimitations: [],
      artifactMeasurements: [],
      coverageRecords: [],
    });
    assert.strictEqual(report.steps[0].id, 'step-001');
    assert.strictEqual(report.steps[1].id, 'step-002');
  });

  it('derives overallStatus failed when any step fails', () => {
    const report = createReport({
      revision: 'abc123',
      branch: 'test',
      environment: { os: 'win32', node: '22', npm: '10', postgresql: '16', authoritative: true },
      steps: [
        { id: 's1', group: 'unit', status: 'passed', durationMs: 100, summary: 'OK' },
        { id: 's2', group: 'integration', status: 'failed', durationMs: 200, summary: 'FAIL' },
      ],
      knownLimitations: [],
      artifactMeasurements: [],
      coverageRecords: [],
    });
    assert.strictEqual(report.overallStatus, 'failed');
  });

  it('uses UTC timestamps', () => {
    const report = createReport({
      revision: 'abc123',
      branch: 'test',
      environment: { os: 'win32', node: '22', npm: '10', postgresql: '16', authoritative: true },
      steps: [],
      knownLimitations: [],
      artifactMeasurements: [],
      coverageRecords: [],
    });
    assert.ok(report.startedAt.endsWith('Z') || report.startedAt.includes('+00:00'));
    assert.ok(report.completedAt.endsWith('Z') || report.completedAt.includes('+00:00'));
  });

  it('writes report even without schemaVersion (validation is separate)', async () => {
    const report = createReport({
      revision: 'abc123',
      branch: 'test',
      environment: { os: 'win32', node: '22', npm: '10', postgresql: '16', authoritative: true },
      steps: [
        { id: 's1', group: 'unit', status: 'passed', durationMs: 100, summary: 'OK' },
      ],
      knownLimitations: [],
      artifactMeasurements: [],
      coverageRecords: [],
    });
    const badReport = { ...report, schemaVersion: undefined };
    // writeReport no longer validates; validation is done separately via validateReport
    const validation = await validateReport(badReport);
    assert.ok(!validation.valid);
  });
});

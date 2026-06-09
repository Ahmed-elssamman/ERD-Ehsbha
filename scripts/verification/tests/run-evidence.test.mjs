import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { readCurrentRunArtifact } from '../lib/run-evidence.mjs';

const directories = [];

function context() {
  const absoluteDirectory = resolve(tmpdir(), `ehsbha-evidence-${process.pid}-${directories.length}`);
  mkdirSync(absoluteDirectory, { recursive: true });
  directories.push(absoluteDirectory);
  return {
    runId: 'current-run',
    startedAt: '2026-06-08T00:00:00.000Z',
    absoluteDirectory,
  };
}

afterEach(() => directories.splice(0).forEach((directory) =>
  rmSync(directory, { recursive: true, force: true })));

describe('current run evidence', () => {
  it('rejects a missing artifact', () => {
    assert.throws(() => readCurrentRunArtifact(context(), 'route-audit.json'), /did not produce/);
  });

  it('rejects an artifact from another run', () => {
    const run = context();
    writeFileSync(resolve(run.absoluteDirectory, 'route-audit.json'), JSON.stringify({
      runId: 'old-run',
      generatedAt: '2026-06-08T00:01:00.000Z',
    }));
    assert.throws(() => readCurrentRunArtifact(run, 'route-audit.json'), /belongs to run/);
  });

  it('rejects an artifact older than the run', () => {
    const run = context();
    writeFileSync(resolve(run.absoluteDirectory, 'route-audit.json'), JSON.stringify({
      runId: run.runId,
      generatedAt: '2026-06-07T23:59:59.000Z',
    }));
    assert.throws(() => readCurrentRunArtifact(run, 'route-audit.json'), /predates/);
  });

  it('loads a current artifact', () => {
    const run = context();
    writeFileSync(resolve(run.absoluteDirectory, 'route-audit.json'), JSON.stringify({
      runId: run.runId,
      generatedAt: '2026-06-08T00:01:00.000Z',
      coverageRecords: [],
    }));
    assert.equal(readCurrentRunArtifact(run, 'route-audit.json').runId, run.runId);
  });
});

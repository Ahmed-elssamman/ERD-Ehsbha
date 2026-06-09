import { mkdirSync, writeFileSync, renameSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { repoRoot, reportDir, tempResultDir } from './paths.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

let stepCounter = 0;

function generateId() {
  stepCounter++;
  return `step-${String(stepCounter).padStart(3, '0')}`;
}

export function createReport({ revision, branch, environment, steps, knownLimitations, artifactMeasurements, coverageRecords }) {
  const now = new Date();
  const failedSteps = steps.filter(s => s.status === 'failed');
  const overallStatus = failedSteps.length > 0 ? 'failed' : 'passed';

  return {
    schemaVersion: '1.0.0',
    revision,
    branch,
    startedAt: steps.length > 0 ? steps[0].startedAt : now.toISOString(),
    completedAt: now.toISOString(),
    environment,
    overallStatus,
    steps: steps.map(s => ({
      id: s.id || generateId(),
      group: s.group,
      status: s.status,
      durationMs: s.durationMs,
      summary: s.summary,
      artifactPaths: s.artifactPaths || [],
    })),
    knownLimitations: knownLimitations || [],
    artifactMeasurements: artifactMeasurements || [],
    coverageRecords: coverageRecords || [],
  };
}

export async function writeReport(report) {
  const dir = reportDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const tmpDir = tempResultDir();
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  const tmpPath = resolve(tmpDir, `report-${Date.now()}.tmp.json`);
  const finalPath = resolve(dir, 'baseline-report.json');

  writeFileSync(tmpPath, JSON.stringify(report, null, 2), 'utf-8');
  renameSync(tmpPath, finalPath);

  return finalPath;
}

export default { createReport, writeReport };

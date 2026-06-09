import { existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { repoRoot } from './paths.mjs';

export function createRunContext(now = new Date()) {
  const runId = `${now.toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  const relativeDirectory = `verification-output/runs/${runId}`;
  const absoluteDirectory = resolve(repoRoot(), relativeDirectory);
  mkdirSync(absoluteDirectory, { recursive: true });
  return {
    runId,
    startedAt: now.toISOString(),
    relativeDirectory,
    absoluteDirectory,
  };
}

export function readCurrentRunArtifact(runContext, fileName) {
  const artifactPath = resolve(runContext.absoluteDirectory, fileName);
  if (!existsSync(artifactPath)) {
    throw new Error(`Current run did not produce ${fileName}`);
  }

  const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
  if (artifact.runId !== runContext.runId) {
    throw new Error(`${fileName} belongs to run '${artifact.runId || 'unknown'}', expected '${runContext.runId}'`);
  }
  if (!artifact.generatedAt || Date.parse(artifact.generatedAt) < Date.parse(runContext.startedAt)) {
    throw new Error(`${fileName} predates the current verification run`);
  }
  return artifact;
}

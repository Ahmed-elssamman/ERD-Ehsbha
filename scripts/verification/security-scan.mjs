import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { repoRoot } from './lib/paths.mjs';
import { collectRepositoryScanPaths, scanSensitiveFiles } from './lib/security-scan.mjs';

export function main() {
  const { files, gitStatus } = collectRepositoryScanPaths();
  const findings = scanSensitiveFiles(files);
  const outputDirectory = resolve(repoRoot(), process.env.VERIFICATION_RUN_DIR || 'verification-output');
  mkdirSync(outputDirectory, { recursive: true });
  const artifact = {
    runId: process.env.VERIFICATION_RUN_ID || 'standalone',
    generatedAt: new Date().toISOString(),
    scannedFileCount: files.length,
    gitStatus,
    findings,
  };
  writeFileSync(resolve(outputDirectory, 'security-scan.json'), JSON.stringify(artifact, null, 2), 'utf-8');

  if (findings.length > 0) {
    throw new Error(findings.map((finding) => `${finding.path}: ${finding.type}`).join('\n'));
  }
  console.log(`Security scan passed across ${files.length} tracked, untracked, configuration, generated, and evidence files.`);
  return artifact;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Security scan failed:\n${error.message}`);
    process.exitCode = 1;
  }
}

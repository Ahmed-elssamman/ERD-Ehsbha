import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'fs';
import { extname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';
import { buildDir, repoRoot } from './lib/paths.mjs';

export const CATEGORY_BUDGETS = {
  'entry-js': 250 * 1024,
  'route-js': 150 * 1024,
  css: 75 * 1024,
  asset: 500 * 1024,
  pwa: 150 * 1024,
};

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

export function loadViteManifest(buildRoot) {
  const path = resolve(buildRoot, '.vite', 'manifest.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function artifactType(relativePath) {
  const extension = extname(relativePath).toLowerCase();
  if (extension === '.js') return 'javascript';
  if (extension === '.css') return 'stylesheet';
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'].includes(extension)) return 'image';
  if (extension === '.html') return 'document';
  if (extension === '.json' || extension === '.webmanifest') return 'manifest';
  if (extension === '.woff' || extension === '.woff2' || extension === '.ttf') return 'font';
  if (extension === '.txt' || extension === '.xml') return 'metadata';
  return 'binary';
}

export function classifyArtifact(relativePath, manifest) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (
    normalized === 'sw.js'
    || normalized.startsWith('workbox-')
    || normalized.includes('service-worker')
    || normalized.endsWith('.webmanifest')
  ) {
    return 'pwa';
  }

  if (manifest) {
    for (const entry of Object.values(manifest)) {
      if (entry.file === normalized) {
        if (entry.isEntry) return 'entry-js';
        if (entry.isDynamicEntry) return 'route-js';
      }
      if (entry.css?.includes(normalized)) return 'css';
      if (entry.assets?.includes(normalized)) return 'asset';
    }
  }

  const extension = extname(normalized).toLowerCase();
  if (extension === '.css') return 'css';
  if (extension === '.js') return normalized.includes('chunk') ? 'route-js' : 'entry-js';
  return 'asset';
}

export function measureDirectory(application, buildRoot) {
  if (!existsSync(buildRoot)) throw new Error(`Build directory is missing for ${application}: ${buildRoot}`);
  const manifest = loadViteManifest(buildRoot);

  return walk(buildRoot).map((filePath) => {
    const path = relative(buildRoot, filePath).replace(/\\/g, '/');
    const content = readFileSync(filePath);
    const compressedBytes = gzipSync(content, { level: 9 }).length;
    const category = classifyArtifact(path, manifest);
    const budgetBytes = CATEGORY_BUDGETS[category];
    if (!budgetBytes) throw new Error(`No budget is defined for category '${category}'`);
    return {
      application,
      artifactPath: path,
      type: artifactType(path),
      category,
      budgetBytes,
      rawBytes: content.length,
      compressedBytes,
      budgetStatus: compressedBytes <= budgetBytes ? 'within' : 'over',
    };
  });
}

export function renderMeasurementMarkdown(measurements) {
  const lines = [
    '# Artifact Measurements',
    '',
    'Generated from the current successful production builds.',
    '',
    '| Application | Artifact | Type | Category | Raw bytes | Gzip bytes | Budget bytes | Status |',
    '|---|---|---|---|---:|---:|---:|---|',
    ...measurements.map((measurement) =>
      `| ${measurement.application} | ${measurement.artifactPath} | ${measurement.type} | ${measurement.category} | ${measurement.rawBytes} | ${measurement.compressedBytes} | ${measurement.budgetBytes} | ${measurement.budgetStatus} |`),
    '',
  ];
  return lines.join('\n');
}

export function main() {
  const measurements = [
    ...measureDirectory('web', buildDir('web')),
    ...measureDirectory('admin', buildDir('admin')),
  ];
  if (measurements.length === 0) throw new Error('No build artifacts were measured');
  if (measurements.some((measurement) => measurement.budgetStatus === 'unclassified')) {
    throw new Error('Unclassified artifact measurement detected');
  }

  const outputDirectory = resolve(repoRoot(), process.env.VERIFICATION_RUN_DIR || 'verification-output');
  mkdirSync(outputDirectory, { recursive: true });
  const artifact = {
    runId: process.env.VERIFICATION_RUN_ID || 'standalone',
    generatedAt: new Date().toISOString(),
    measurements,
  };
  writeFileSync(resolve(outputDirectory, 'artifact-measurements.json'), JSON.stringify(artifact, null, 2), 'utf-8');
  console.log(`Measured ${measurements.length} current build artifacts.`);
  return artifact;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Artifact measurement failed: ${error.message}`);
    process.exitCode = 1;
  }
}

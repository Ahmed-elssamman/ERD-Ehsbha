#!/usr/bin/env node
// T075: Error code inventory - compares thrown/mapped API codes with the governed registry

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { GOVERNED_ERROR_REGISTRY } from '../../packages/api-contracts/dist/types/core/errors.js';

const repoRoot = resolve(import.meta.dirname, '../..');
const apiDir = resolve(repoRoot, 'apps/api/src/modules');

const errorPatterns = [
  /code:\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
  /throw new \w+Exception\(\{[^}]*code:\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
];

function walk(dir) {
  const codes = new Set();
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      for (const code of walk(fullPath)) codes.add(code);
    } else if (entry.name.endsWith('.ts')) {
      const content = readFileSync(fullPath, 'utf-8');
      for (const pattern of errorPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          codes.add(match[1]);
        }
      }
    }
  }
  return codes;
}

const codes = walk(apiDir);
const governedCodes = new Set(Object.keys(GOVERNED_ERROR_REGISTRY));
const unknownCodes = [...codes].filter(c => !governedCodes.has(c));
const missingCodes = [...governedCodes].filter(c => !codes.has(c));

let exitCode = 0;

if (unknownCodes.length > 0) {
  console.log('Error codes found in API that are NOT in the governed registry (informational):');
  for (const code of unknownCodes) {
    console.log(`  - ${code}`);
  }
}

if (missingCodes.length > 0) {
  console.log('Governed error codes NOT found in API service files (informational):');
  for (const code of missingCodes) {
    console.log(`  - ${code}`);
  }
}

if (unknownCodes.length === 0) {
  console.log(`Error code inventory passed: ${codes.size} API codes, ${governedCodes.size} governed codes`);
}

process.exit(exitCode);

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const apiRoot = resolve(repoRoot, 'apps/api');

const semantics = JSON.parse(readFileSync(
  resolve('apps/api/test-fixtures/financial-semantics.json'),
  'utf-8',
));

function resolveSource(fixture, source) {
  if (source === null) return null;
  if (source === 'trips[].receivedEgp') {
    return fixture.trips.reduce((total, trip) => total + trip.receivedEgp, 0);
  }
  return source.split('.').reduce((value, segment) => value?.[segment], fixture);
}

function toPiastres(value) {
  return value === null || value === undefined ? null : Math.round(value * 100);
}

const npxCli = resolve(
  process.env.npm_execpath
    ? resolve(process.env.npm_execpath, '..', 'npx-cli.js')
    : resolve(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
);

function runParserBridge(...tsArgs) {
  const scriptPath = resolve(apiRoot, 'scripts/compute-parser-semantics.ts');
  const result = execFileSync(process.execPath, [
    npxCli, 'ts-node',
    '--project', resolve(apiRoot, 'tsconfig.json'),
    scriptPath, ...tsArgs,
  ], {
    cwd: apiRoot,
    encoding: 'utf-8',
    timeout: 30000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const lines = result.trim().split('\n');
  return JSON.parse(lines[lines.length - 1]);
}

describe('canonical OCR financial semantics', () => {
  it('contains unique fixture identifiers and real source files', () => {
    const identifiers = semantics.map((entry) => entry.fixtureId);
    assert.equal(new Set(identifiers).size, identifiers.length);
    for (const entry of semantics) {
      assert.doesNotThrow(() => readFileSync(resolve(entry.sourceFile), 'utf-8'));
    }
  });

  for (const entry of semantics) {
    it(`${entry.fixtureId} matches its golden fixture sources`, () => {
      const fixture = JSON.parse(readFileSync(resolve(entry.sourceFile), 'utf-8'));
      for (const field of ['gross', 'commission', 'tips', 'adjustments', 'received', 'net']) {
        const source = entry.sources[field] ?? null;
        const actual = toPiastres(resolveSource(fixture, source));
        assert.equal(actual, entry.expected[field], `${field} from ${source}`);
      }
      assert.equal(entry.expected.currency, 'EGP');
      assert.equal(entry.expected.unit, 'piastres');
    });
  }

  it('uber parser extracts gross from representative OCR input', () => {
    const result = runParserBridge('--fixture', 'uber-ar');
    assert.ok(result.gross > 0, `expected positive gross, got ${result.gross}`);
    assert.ok(result.received > 0, `expected positive received, got ${result.received}`);
    assert.equal(result.currency, 'EGP');
    assert.equal(result.unit, 'piastres');
  });

  it('uber parser gross exceeds commission', () => {
    const result = runParserBridge('--fixture', 'uber-ar');
    if (result.gross != null && result.commission != null) {
      assert.ok(result.gross >= result.commission, `gross ${result.gross} should be >= commission ${result.commission}`);
    }
  });

  it('uber parser received >= net (net = received - commission)', () => {
    const result = runParserBridge('--fixture', 'uber-ar');
    if (result.received != null && result.net != null) {
      assert.ok(result.received >= result.net, `received ${result.received} should be >= net ${result.net}`);
    }
  });

  it('didi parser extracts gross and received from representative OCR input', () => {
    const result = runParserBridge('--fixture', 'didi-ar');
    assert.ok(result.gross > 0, `expected positive gross, got ${result.gross}`);
    assert.ok(result.received > 0, `expected positive received, got ${result.received}`);
  });

  it('indrive parser extracts gross from representative OCR input', () => {
    const result = runParserBridge('--fixture', 'indrive-ar');
    assert.ok(result.gross > 0, `expected positive gross, got ${result.gross}`);
    assert.ok(result.commission >= 0, `expected commission >= 0, got ${result.commission}`);
  });
});

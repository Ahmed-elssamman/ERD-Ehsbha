import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import {
  CATEGORY_BUDGETS,
  classifyArtifact,
  loadViteManifest,
  measureDirectory,
  renderMeasurementMarkdown,
} from '../measure-builds.mjs';

const directory = resolve(tmpdir(), `ehsbha-measure-${process.pid}`);

describe('production artifact measurement', () => {
  before(() => {
    mkdirSync(resolve(directory, '.vite'), { recursive: true });
    mkdirSync(resolve(directory, 'assets'), { recursive: true });
    writeFileSync(resolve(directory, 'assets/main.js'), 'console.log("entry")');
    writeFileSync(resolve(directory, 'assets/route.js'), 'console.log("route")');
    writeFileSync(resolve(directory, 'assets/main.css'), 'body{color:red}');
    writeFileSync(resolve(directory, 'sw.js'), 'self.addEventListener("fetch",()=>{})');
    writeFileSync(resolve(directory, 'manifest.webmanifest'), '{}');
    writeFileSync(resolve(directory, 'logo.svg'), '<svg/>');
    writeFileSync(resolve(directory, '.vite/manifest.json'), JSON.stringify({
      'src/main.tsx': { file: 'assets/main.js', isEntry: true, css: ['assets/main.css'] },
      'src/pages/route.tsx': { file: 'assets/route.js', isDynamicEntry: true },
    }));
  });

  after(() => rmSync(directory, { recursive: true, force: true }));

  it('classifies manifest entries and PWA artifacts', () => {
    const manifest = loadViteManifest(directory);
    assert.equal(classifyArtifact('assets/main.js', manifest), 'entry-js');
    assert.equal(classifyArtifact('assets/route.js', manifest), 'route-js');
    assert.equal(classifyArtifact('assets/main.css', manifest), 'css');
    assert.equal(classifyArtifact('sw.js', manifest), 'pwa');
    assert.equal(classifyArtifact('manifest.webmanifest', manifest), 'pwa');
  });

  it('assigns type, budget, size, and budget status to every artifact', () => {
    const measurements = measureDirectory('web', directory);
    assert.ok(measurements.length > 0);
    for (const measurement of measurements) {
      assert.ok(measurement.type);
      assert.equal(measurement.budgetBytes, CATEGORY_BUDGETS[measurement.category]);
      assert.ok(measurement.rawBytes >= 0);
      assert.ok(measurement.compressedBytes >= 0);
      assert.ok(['within', 'over'].includes(measurement.budgetStatus));
    }
  });

  it('renders the measured records into Markdown', () => {
    const markdown = renderMeasurementMarkdown(measureDirectory('web', directory));
    assert.match(markdown, /assets\/main\.js/);
    assert.doesNotMatch(markdown, /unclassified/);
  });
});

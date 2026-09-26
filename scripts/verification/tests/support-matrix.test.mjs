import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Support Matrix', () => {
  const matrixPath = resolve('docs/baseline/support-matrix.md');

  it('exists', () => {
    assert.ok(existsSync(matrixPath));
  });

  const requiredRows = ['Node.js', 'npm', 'PostgreSQL', 'Windows', 'Linux'];

  for (const row of requiredRows) {
    it(`contains ${row} row`, () => {
      const content = readFileSync(matrixPath, 'utf-8');
      assert.ok(content.includes(row), `Support matrix must include ${row}`);
    });
  }

  it('declares Windows as authoritative', () => {
    const content = readFileSync(matrixPath, 'utf-8');
    assert.ok(content.includes('Windows'));
  });

  it('declares Linux as deferred', () => {
    const content = readFileSync(matrixPath, 'utf-8');
    assert.ok(content.includes('Deferred'));
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, '../not-applicable.mjs');

describe('Not Applicable Script', () => {
  it('exits with code 2 for valid group', () => {
    const result = spawnSync('node', [scriptPath, 'e2e', 'Not implemented'], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 2);
  });

  it('exits with code 1 for invalid group', () => {
    const result = spawnSync('node', [scriptPath, 'unit', 'Invalid'], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 1);
  });

  it('can report not applicable without failing a standalone command', () => {
    const result = spawnSync('node', [scriptPath, '--exit-zero', 'contract', 'Not implemented'], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /"status":"not_applicable"/);
  });

  it('outputs JSON with status not_applicable', () => {
    const result = spawnSync('node', [scriptPath, 'e2e', 'Test not applicable'], { encoding: 'utf-8' });
    const lines = result.stdout.trim().split('\n');
    const jsonLine = lines.find(l => l.startsWith('{'));
    if (jsonLine) {
      const parsed = JSON.parse(jsonLine);
      assert.strictEqual(parsed.status, 'not_applicable');
      assert.strictEqual(parsed.group, 'e2e');
    }
  });
});

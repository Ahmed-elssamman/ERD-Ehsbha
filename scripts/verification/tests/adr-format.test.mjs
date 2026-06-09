import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('ADR Format Validation', () => {
  const adrDir = resolve('docs/adr');
  const files = readdirSync(adrDir).filter(f => f.match(/^\d{4}-.+\.md$/));

  it('has at least one ADR', () => {
    assert.ok(files.length > 0, 'No ADR files found');
  });

  for (const file of files) {
    it(`${file} has required headings`, () => {
      const content = readFileSync(resolve(adrDir, file), 'utf-8');
      assert.ok(content.includes('# ADR-'), `Missing 'ADR-NNNN: Title' heading in ${file}`);
      assert.ok(content.includes('**Status**'), `Missing Status field in ${file}`);
      assert.ok(content.includes('**Date**'), `Missing Date field in ${file}`);
      assert.ok(content.includes('**Owner**'), `Missing Owner field in ${file}`);
      assert.ok(content.includes('## Context'), `Missing Context section in ${file}`);
      assert.ok(content.includes('## Decision'), `Missing Decision section in ${file}`);
      assert.ok(content.includes('## Alternatives'), `Missing Alternatives section in ${file}`);
      assert.ok(content.includes('## Consequences'), `Missing Consequences section in ${file}`);
    });

    it(`${file} uses valid status`, () => {
      const content = readFileSync(resolve(adrDir, file), 'utf-8');
      const match = content.match(/\*\*Status\*\*:\s*(.+)/);
      if (match) {
        const status = match[1].trim();
        assert.ok(['proposed', 'accepted', 'superseded', 'deprecated'].includes(status),
          `Invalid status '${status}' in ${file}`);
      }
    });

    it(`${file} has ISO date`, () => {
      const content = readFileSync(resolve(adrDir, file), 'utf-8');
      const match = content.match(/\*\*Date\*\*:\s*(.+)/);
      if (match) {
        const date = match[1].trim();
        assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(date), `Invalid date format '${date}' in ${file}`);
      }
    });

    it(`${file} has non-empty owner`, () => {
      const content = readFileSync(resolve(adrDir, file), 'utf-8');
      const match = content.match(/\*\*Owner\*\*:\s*(.+)/);
      if (match) {
        const owner = match[1].trim();
        assert.ok(owner.length > 0, `Empty owner in ${file}`);
      }
    });
  }
});

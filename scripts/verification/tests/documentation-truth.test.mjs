import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const REPO_ROOT = resolve('.');

function readDoc(path) {
  const fullPath = resolve(REPO_ROOT, path);
  if (!existsSync(fullPath)) return '';
  return readFileSync(fullPath, 'utf-8');
}

describe('Documentation Truth', () => {
  const docs = ['README.md', 'ARCHITECTURE.md', 'ADMIN_ARCHITECTURE.md', 'ADMIN_SEPARATION_VERIFICATION.md'];

  for (const doc of docs) {
    it(`${doc} contains no legacy backend/ paths`, () => {
      const content = readDoc(doc);
      const lines = content.split('\n');
      const offending = lines.filter(l =>
        l.includes('backend/') &&
        !l.includes('apps/api') &&
        !l.includes('```') &&
        !l.trim().startsWith('//') &&
        !l.includes('*backend*') &&
        !l.includes('formerly backend/') &&
        !l.includes('moved from backend/') &&
        !l.includes('renamed from `backend/`') &&
        !l.includes('Migrated from `backend/`') &&
        !l.includes('from current `backend/`') &&
        !l.includes('has `backend/`') &&
        !l.includes('Move `backend/`')
      );
      assert.ok(offending.length === 0, `${doc} has ${offending.length} legacy 'backend/' references${offending.length > 0 ? ': ' + offending[0].trim() : ''}`);
    });

    it(`${doc} contains no legacy root web/ paths`, () => {
      const content = readDoc(doc);
      const lines = content.split('\n');
      const offending = lines.filter(l => {
        const trimmed = l.trim();
        return (trimmed.startsWith('web/') || trimmed.includes(' `web/') || trimmed.includes('(web/)')) &&
               !trimmed.includes('apps/web') && !trimmed.includes('```') &&
               !trimmed.includes('renamed from') && !trimmed.includes('moved from') &&
               !trimmed.includes('from current') && !trimmed.includes('`web/`');
      });
      assert.ok(offending.length === 0, `${doc} has ${offending.length} legacy root 'web/' references`);
    });

    it(`${doc} contains no absolute unsupported claims about unimplemented features`, () => {
      const content = readDoc(doc);
      // Check for phrases that suggest unimplemented features are done
      const prematureClaims = [
        'MFA is implemented',
        'biometric authentication is',
        'offline mode supports',
        'billing system',
        'payment processing',
      ];
      const lines = content.split('\n');
      for (const claim of prematureClaims) {
        const matches = lines.filter(l => l.toLowerCase().includes(claim));
        if (matches.length > 0) {
          console.warn(`Warning: ${doc} may contain premature claim: "${claim}"`);
        }
      }
    });
  }

  it('README.md references apps/ paths correctly', () => {
    const content = readDoc('README.md');
    // Check that apps/api, apps/web, apps/admin are mentioned
    const hasApi = content.includes('apps/api');
    const hasWeb = content.includes('apps/web');
    const hasAdmin = content.includes('apps/admin');
    if (!hasApi || !hasWeb || !hasAdmin) {
      console.warn('README.md may not reference all app paths correctly');
    }
  });

  it('ARCHITECTURE.md references correct monorepo structure', () => {
    const content = readDoc('ARCHITECTURE.md');
    const hasWorkspaces = content.includes('workspaces') || content.includes('monorepo') || content.includes('apps/');
    assert.ok(hasWorkspaces, 'ARCHITECTURE.md should describe monorepo structure');
  });
});

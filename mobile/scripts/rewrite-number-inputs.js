#!/usr/bin/env node
// One-shot codemod: rewrite number-input handlers in mobile screens to use
// the shared normalizeNumberInput / normalizeIntInput helpers, which handle
// Arabic + Persian digits, commas, and decimal-separator variants uniformly.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DECIMAL_FILES = [
  'app/trips/new.tsx',
  'app/fuel/new.tsx',
  'app/expenses/new.tsx',
  'app/maintenance/new.tsx',
  'app/maintenance/costs.tsx',
  'app/vehicles/new.tsx',
  'app/goals/index.tsx',
  'app/apps/index.tsx',
];

const INT_FILES = [
  'app/trips/new.tsx',
  'app/fuel/new.tsx',
  'app/maintenance/new.tsx',
  'app/maintenance/costs.tsx',
  'app/vehicles/new.tsx',
  'app/(auth)/reset.tsx',
  'src/ui/DailyOdometerCard.tsx',
];

const DECIMAL_PATTERN = /v\.replace\(\/\[\^\\d\.\]\/g,\s*''\)/g;
const INT_PATTERN = /v\.replace\(\/\[\^\\d\]\/g,\s*''\)/g;

function rewrite(file, isDecimal, isInt) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    console.warn(`  ! missing: ${file}`);
    return;
  }
  let src = fs.readFileSync(full, 'utf8');
  let touched = 0;
  if (isDecimal) {
    src = src.replace(DECIMAL_PATTERN, () => {
      touched++;
      return 'normalizeNumberInput(v)';
    });
  }
  if (isInt) {
    src = src.replace(INT_PATTERN, () => {
      touched++;
      return 'normalizeIntInput(v)';
    });
  }

  // Add import if helpers are used and not yet imported.
  const needsDecimal = /\bnormalizeNumberInput\(/.test(src);
  const needsInt = /\bnormalizeIntInput\(/.test(src);
  const alreadyImports =
    /from\s+'@\/lib\/numbers'/.test(src) || /from\s+"@\/lib\/numbers"/.test(src);

  if ((needsDecimal || needsInt) && !alreadyImports) {
    const imports = [];
    if (needsDecimal) imports.push('normalizeNumberInput');
    if (needsInt) imports.push('normalizeIntInput');
    const importLine = `import { ${imports.join(', ')} } from '@/lib/numbers';\n`;

    // Insert after the last existing import statement.
    const lastImportMatch = [...src.matchAll(/^import\s.*;$/gm)].pop();
    if (lastImportMatch) {
      const at = lastImportMatch.index + lastImportMatch[0].length;
      src = src.slice(0, at) + '\n' + importLine.trimEnd() + src.slice(at);
    } else {
      src = importLine + src;
    }
    touched++;
  }

  if (touched > 0) {
    fs.writeFileSync(full, src, 'utf8');
    console.log(`  ✓ ${file} (${touched} change${touched > 1 ? 's' : ''})`);
  } else {
    console.log(`  · ${file} (no change)`);
  }
}

console.log('Rewriting decimal inputs:');
for (const f of DECIMAL_FILES) rewrite(f, true, INT_FILES.includes(f));

console.log('\nRewriting integer-only inputs in remaining files:');
for (const f of INT_FILES) {
  if (!DECIMAL_FILES.includes(f)) rewrite(f, false, true);
}

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const reportPath = resolve(__dirname, '../../verification-output/baseline-report.json');
  const { validateReport } = await import(pathToFileURL(resolve(__dirname, './lib/validate-report.mjs')).href);
  const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
  const result = await validateReport(report);
  if (!result.valid) {
    console.error('Report validation failed:', result.errors);
    process.exit(1);
  }
  console.log('Report validation passed:', JSON.stringify(result));
}

main().catch((err) => {
  console.error('Report validation crashed:', err);
  process.exit(2);
});

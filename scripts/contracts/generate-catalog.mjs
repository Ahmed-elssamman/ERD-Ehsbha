import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { getAllOperations } from '../../packages/api-contracts/dist/cjs/index.js';
import { buildCatalogData } from './catalog-data.mjs';

const OUTPUT_DIR = resolve(import.meta.dirname, '../../verification-output/contracts');

export async function generateCatalog() {
  const { catalog, routes, consumers, diagnostics } = await buildCatalogData(getAllOperations());
  const blockingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (blockingDiagnostics.length > 0) {
    const details = blockingDiagnostics.map((diagnostic) => `- ${diagnostic.message}`).join('\n');
    throw new Error(`Contract catalog generation failed:\n${details}`);
  }
  const publicCatalog = {
    ...catalog,
    operations: catalog.operations.map(({
      controller: _controller,
      handler: _handler,
      sourceLine: _sourceLine,
      ...operation
    }) => operation),
  };

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(
    resolve(OUTPUT_DIR, 'contract-catalog.json'),
    `${JSON.stringify(publicCatalog, null, 2)}\n`,
    'utf-8',
  );
  writeFileSync(
    resolve(OUTPUT_DIR, 'controller-routes.json'),
    `${JSON.stringify(routes, null, 2)}\n`,
    'utf-8',
  );
  writeFileSync(
    resolve(OUTPUT_DIR, 'consumer-inventory.json'),
    `${JSON.stringify(consumers, null, 2)}\n`,
    'utf-8',
  );
  return publicCatalog;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const catalog = await generateCatalog();
  console.log(`Catalog written with ${catalog.operations.length} operations`);
}

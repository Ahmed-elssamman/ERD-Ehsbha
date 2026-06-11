import { getAllOperations } from '../../packages/api-contracts/dist/cjs/index.js'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

const OUTPUT_DIR = resolve(import.meta.dirname, '../../verification-output/contracts')

const catalog = {
  contractVersion: '1.0.0',
  apiVersion: 'v1',
  generatedAt: new Date().toISOString(),
  operations: getAllOperations().map(op => ({
    operationId: op.operationId,
    transport: op.transport,
    method: op.method,
    path: op.path,
    realm: op.realm,
    lifecycle: op.lifecycle,
    requestSchemas: op.requestSchemas || {},
    successSchema: op.successData || '',
    failureCodes: op.failureCodes || [],
    pagination: op.pagination || null,
    idempotency: op.idempotency || null,
    consumers: (op.consumers || []).map(c => ({
      application: c.application,
      sourcePath: c.sourcePath || null,
      role: c.role,
      migrationStatus: c.migrationStatus || 'shared',
      owner: c.owner,
      followUp: c.followUp || null,
    })),
    compatibility: op.compatibility || 'additive-compatible',
    owner: op.owner || '',
    followUp: op.followUp || null,
  })),
}

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

const catalogPath = resolve(OUTPUT_DIR, 'contract-catalog.json')
writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8')
console.log(`Catalog written to ${catalogPath}`)

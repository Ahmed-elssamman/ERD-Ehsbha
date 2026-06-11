import { getAllOperations } from '../../packages/api-contracts/dist/cjs/index.js'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

const OUTPUT_DIR = resolve(import.meta.dirname, '../../verification-output/contracts')

const operations = getAllOperations()

const paths = {}

for (const op of operations) {
  if (!op.method || !op.path) continue
  const method = op.method.toLowerCase()
  if (!paths[op.path]) paths[op.path] = {}
  paths[op.path][method] = {
    operationId: op.operationId,
    summary: `${op.realm} ${op.operationId}`,
    tags: [op.realm || 'default'],
    responses: {
      '200': {
        description: 'Success',
        content: { 'application/json': { schema: { type: 'object' } } },
      },
    },
    'x-lifecycle': op.lifecycle || 'active',
    'x-realm': op.realm || 'driver',
  }
}

const doc = {
  openapi: '3.1.0',
  info: {
    title: 'Ehsbha API',
    version: '1.0.0',
    description: 'Generated from shared contract registry',
  },
  servers: [{ url: '/api/v1' }],
  paths,
}

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

const openapiPath = resolve(OUTPUT_DIR, 'openapi.json')
writeFileSync(openapiPath, JSON.stringify(doc, null, 2), 'utf-8')
console.log(`OpenAPI written to ${openapiPath}`)

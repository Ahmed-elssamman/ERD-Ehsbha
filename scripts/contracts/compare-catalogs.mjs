import { readFileSync, writeFileSync } from 'fs'
import { getAllOperations } from '../../packages/api-contracts/src/catalog/registry.js'

const [,, basePath, headPath] = process.argv

if (!basePath || !headPath) {
  console.error('Usage: node compare-catalogs.mjs <base-catalog.json> <head-catalog.json>')
  process.exit(1)
}

function loadCatalog(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

const base = loadCatalog(basePath)
const head = loadCatalog(headPath)

if (!base || !head) {
  console.error('Could not load one or both catalog files')
  process.exit(1)
}

const baseOps = new Map(base.operations.map(op => [op.operationId, op]))
const headOps = new Map(head.operations.map(op => [op.operationId, op]))

const added = []
const removed = []
const changed = []

for (const [id, op] of headOps) {
  if (!baseOps.has(id)) {
    added.push(id)
  } else {
    const baseOp = baseOps.get(id)
    if (JSON.stringify(baseOp.request) !== JSON.stringify(op.request) ||
        baseOp.successSchema !== op.successSchema) {
      changed.push(id)
    }
  }
}

for (const [id] of baseOps) {
  if (!headOps.has(id)) {
    removed.push(id)
  }
}

if (added.length === 0 && removed.length === 0 && changed.length === 0) {
  console.log('No contract changes detected')
  process.exit(0)
}

console.log('Contract Changes Detected:')
if (added.length > 0) {
  console.log(`\nAdded operations (${added.length}):`)
  added.forEach(id => console.log(`  + ${id}`))
}
if (removed.length > 0) {
  console.log(`\nRemoved operations (${removed.length}):`)
  removed.forEach(id => console.log(`  - ${id}`))
}
if (changed.length > 0) {
  console.log(`\nChanged operations (${changed.length}):`)
  changed.forEach(id => console.log(`  ~ ${id}`))
}

if (removed.length > 0 || changed.some(id => {
  const headOp = headOps.get(id)
  return headOp.compatibility === 'incompatible' || headOp.compatibility === 'behaviorally-changed'
})) {
  console.error('\nERROR: Breaking changes detected without migration metadata')
  process.exit(1)
}

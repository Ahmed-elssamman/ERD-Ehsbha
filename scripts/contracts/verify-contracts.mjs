import { getAllOperations, getActiveOperations } from '../../packages/api-contracts/dist/cjs/index.js'
import { getErrorDefinition } from '../../packages/api-contracts/dist/cjs/core/errors.js'

let exitCode = 0
const errors = []

const operations = getAllOperations()
const activeOps = getActiveOperations()

if (!operations || operations.length === 0) {
  console.error('Contract verification failed: no operations registered')
  process.exit(1)
}

for (const op of operations) {
  if (!op.operationId) {
    errors.push(`Operation missing operationId`)
    exitCode = 1
    continue
  }
  const ids = new Set()
  if (ids.has(op.operationId)) {
    errors.push(`Duplicate operation ID: ${op.operationId}`)
    exitCode = 1
  }
  ids.add(op.operationId)
}

const seenPaths = new Set()
for (const op of activeOps) {
  if (op.method && op.path) {
    const key = `${op.method} ${op.path}`
    if (seenPaths.has(key)) {
      errors.push(`Duplicate HTTP method/path for active operation: ${key} (${op.operationId})`)
      exitCode = 1
    }
    seenPaths.add(key)
  }
}

for (const op of operations) {
  for (const code of op.failureCodes) {
    const def = getErrorDefinition(code)
    if (!def) {
      errors.push(`Unknown error code "${code}" in operation ${op.operationId}`)
      exitCode = 1
    }
  }
}

for (const op of operations) {
  if (op.lifecycle !== 'active' && !op.followUp) {
    errors.push(`Non-active operation ${op.operationId} (${op.lifecycle}) is missing followUp`)
    exitCode = 1
  }
}

if (!activeOps.some(op => op.consumers?.some(c => c.application === 'api' && c.role === 'producer'))) {
  errors.push('No API producer consumer binding found in any active operation')
  exitCode = 1
}

if (errors.length > 0) {
  console.error('Contract verification failed:')
  for (const err of errors) {
    console.error(`  - ${err}`)
  }
} else {
  console.log(`Contract verification passed: ${operations.length} total, ${activeOps.length} active operations`)
}

process.exit(exitCode)

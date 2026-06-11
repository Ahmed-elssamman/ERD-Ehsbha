import { getAllOperations } from '../../packages/api-contracts/src/catalog/registry.js'

const operations = getAllOperations()
const consumerMap = new Map()

for (const op of operations) {
  for (const consumer of op.consumers) {
    const key = `${consumer.application}:${consumer.role}`
    if (!consumerMap.has(key)) {
      consumerMap.set(key, [])
    }
    consumerMap.get(key).push({
      operationId: op.operationId,
      path: op.path,
      method: op.method,
      migrationStatus: consumer.migrationStatus,
      owner: consumer.owner,
    })
  }
}

console.log('Consumer Inventory:')
for (const [key, ops] of consumerMap) {
  console.log(`\n${key} (${ops.length} operations):`)
  for (const op of ops) {
    console.log(`  ${op.method || 'N/A'} ${op.path || op.operationId} [${op.migrationStatus}] - ${op.owner}`)
  }
}

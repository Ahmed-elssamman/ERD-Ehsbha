import { ContractCatalogEntry } from './types'

const registry = new Map<string, ContractCatalogEntry>()

export function registerOperation(entry: ContractCatalogEntry): void {
  if (registry.has(entry.operationId)) {
    throw new Error(`Duplicate operation ID: ${entry.operationId}`)
  }
  const methodPathKey = entry.method && entry.path ? `${entry.method} ${entry.path}` : null
  if (methodPathKey) {
    for (const existing of registry.values()) {
      if (existing.method === entry.method && existing.path === entry.path) {
        throw new Error(`Duplicate HTTP method/path: ${methodPathKey}`)
      }
    }
  }
  registry.set(entry.operationId, entry)
}

export function getOperation(operationId: string): ContractCatalogEntry | undefined {
  return registry.get(operationId)
}

export function getAllOperations(): ContractCatalogEntry[] {
  return Array.from(registry.values())
}

export function getActiveOperations(): ContractCatalogEntry[] {
  return getAllOperations().filter((op) => op.lifecycle === 'active')
}

export function clearRegistry(): void {
  registry.clear()
}

export function hasOperation(operationId: string): boolean {
  return registry.has(operationId)
}

export function getOperationCount(): number {
  return registry.size
}

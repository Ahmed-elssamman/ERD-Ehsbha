import { getAllOperations } from './registry'

export const allOperations = getAllOperations

export function getOperationIds(): string[] {
  return getAllOperations().map(op => op.operationId)
}

export function validateOperationIds(): string[] {
  const ids = getOperationIds()
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.push(id)
    }
    seen.add(id)
  }
  return duplicates
}

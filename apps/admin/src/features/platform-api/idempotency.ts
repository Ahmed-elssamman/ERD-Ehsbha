import { v4 as uuidv4 } from 'uuid'

export function generateIdempotencyKey(): string {
  return uuidv4()
}

export function getIdempotencyHeader(): string {
  return 'Idempotency-Key'
}

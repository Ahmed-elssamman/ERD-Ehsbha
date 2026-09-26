import { Brand } from './brand'

export type MoneyPiastres = Brand<number, 'MoneyPiastres'>
export type DistanceMeters = Brand<number, 'DistanceMeters'>
export type DurationSeconds = Brand<number, 'DurationSeconds'>

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

export function MoneyPiastres(value: number): MoneyPiastres {
  if (!isSafeInteger(value)) {
    throw new Error(`Invalid MoneyPiastres: ${value} must be a safe integer`)
  }
  return value as unknown as MoneyPiastres
}

export function DistanceMeters(value: number): DistanceMeters {
  if (!isSafeInteger(value)) {
    throw new Error(`Invalid DistanceMeters: ${value} must be a safe integer`)
  }
  return value as unknown as DistanceMeters
}

export function DurationSeconds(value: number): DurationSeconds {
  if (!isSafeInteger(value)) {
    throw new Error(`Invalid DurationSeconds: ${value} must be a safe integer`)
  }
  return value as unknown as DurationSeconds
}

export function isMoneyPiastres(value: unknown): value is MoneyPiastres {
  return isSafeInteger(value)
}

export function isDistanceMeters(value: unknown): value is DistanceMeters {
  return isSafeInteger(value)
}

export function isDurationSeconds(value: unknown): value is DurationSeconds {
  return isSafeInteger(value)
}

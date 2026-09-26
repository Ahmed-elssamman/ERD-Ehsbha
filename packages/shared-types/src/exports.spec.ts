import { describe, it, expect } from 'vitest'
import { brand, isBrand } from './brand'
import { MoneyPiastres, DistanceMeters, DurationSeconds } from './units'

describe('package exports', () => {
  it('exports brand utilities', () => {
    expect(brand).toBeDefined()
    expect(isBrand).toBeDefined()
  })

  it('exports unit types', () => {
    expect(MoneyPiastres).toBeDefined()
    expect(DistanceMeters).toBeDefined()
    expect(DurationSeconds).toBeDefined()
  })

  it('MoneyPiastres is callable', () => {
    expect(MoneyPiastres(100)).toBe(100)
  })
})

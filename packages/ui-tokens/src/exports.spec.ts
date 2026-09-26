import { describe, it, expect } from 'vitest'
import { colors } from './colors'
import { fontFamily, fontSize } from './typography'
import { spacing, radius } from './spacing'
import { duration, easing } from './motion'

describe('package exports', () => {
  it('exports colors', () => {
    expect(colors).toBeDefined()
    expect(colors.primary).toBeDefined()
  })

  it('exports typography tokens', () => {
    expect(fontFamily).toBeDefined()
    expect(fontSize).toBeDefined()
  })

  it('exports spacing tokens', () => {
    expect(spacing).toBeDefined()
    expect(radius).toBeDefined()
  })

  it('exports motion tokens', () => {
    expect(duration).toBeDefined()
    expect(easing).toBeDefined()
  })
})

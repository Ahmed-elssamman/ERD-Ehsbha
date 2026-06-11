import { describe, it, expect } from 'vitest'
import { ResponseMetaSchema, SuccessEnvelopeSchema, EmptySuccessDataSchema } from './core/envelope'
import { FailureEnvelopeSchema, GOVERNED_ERROR_REGISTRY, normalizeErrorCode } from './core/errors'
import { CursorQuerySchema, OffsetQuerySchema } from './core/pagination'
import { API_VERSION, CONTRACT_VERSION, isSupportedMajorVersion } from './core/version'
import { parseSuccessResponse, parseFailureResponse } from './core/parse-response'

describe('package exports', () => {
  it('exports envelope schemas', () => {
    expect(ResponseMetaSchema).toBeDefined()
    expect(SuccessEnvelopeSchema).toBeDefined()
    expect(EmptySuccessDataSchema).toBeDefined()
  })

  it('exports error schemas', () => {
    expect(FailureEnvelopeSchema).toBeDefined()
    expect(GOVERNED_ERROR_REGISTRY).toBeDefined()
    expect(normalizeErrorCode).toBeDefined()
  })

  it('exports pagination schemas', () => {
    expect(CursorQuerySchema).toBeDefined()
    expect(OffsetQuerySchema).toBeDefined()
  })

  it('exports version constants', () => {
    expect(API_VERSION).toBe('v1')
    expect(CONTRACT_VERSION).toBe('1.0.0')
    expect(isSupportedMajorVersion('1.0.0')).toBe(true)
    expect(isSupportedMajorVersion('2.0.0')).toBe(false)
  })

  it('exports parse functions', () => {
    expect(parseSuccessResponse).toBeDefined()
    expect(parseFailureResponse).toBeDefined()
  })

  it('has all governed error codes', () => {
    const codes = Object.keys(GOVERNED_ERROR_REGISTRY)
    expect(codes).toContain('VALIDATION_ERROR')
    expect(codes).toContain('UNAUTHENTICATED')
    expect(codes).toContain('FORBIDDEN')
    expect(codes).toContain('NOT_FOUND')
    expect(codes).toContain('CONFLICT')
    expect(codes).toContain('CONTRACT_VIOLATION')
    expect(codes).toContain('CONTRACT_VERSION_MISMATCH')
    expect(codes).toContain('RATE_LIMITED')
    expect(codes).toContain('INTERNAL_ERROR')
  })
})

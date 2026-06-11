import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { CursorQuerySchema, OffsetQuerySchema, CursorPageMetaSchema, OffsetPageMetaSchema, DEFAULT_PAGE_SIZE, MAXIMUM_PAGE_SIZE } from './pagination'
import { ResponseMetaSchema, SuccessEnvelopeSchema, EmptySuccessDataSchema, createSuccessMeta } from './envelope'
import { FieldIssueSchema, FailureEnvelopeSchema, GOVERNED_ERROR_REGISTRY, normalizeErrorCode, getErrorDefinition } from './errors'
import { API_VERSION, CONTRACT_VERSION, SUPPORTED_MAJOR_VERSION, parseSemanticVersion, isSupportedMajorVersion, SemanticVersionSchema, ApiVersionSchema } from './version'
import { parseSuccessResponse, parseFailureResponse } from './parse-response'

describe('version', () => {
  it('exports expected constants', () => {
    expect(API_VERSION).toBe('v1')
    expect(CONTRACT_VERSION).toBe('1.0.0')
    expect(SUPPORTED_MAJOR_VERSION).toBe(1)
  })

  it('parseSemanticVersion extracts components', () => {
    const v = parseSemanticVersion('1.2.3')
    expect(v.major).toBe(1)
    expect(v.minor).toBe(2)
    expect(v.patch).toBe(3)
  })

  it('parseSemanticVersion throws for invalid versions', () => {
    expect(() => parseSemanticVersion('not-semver')).toThrow()
    expect(() => parseSemanticVersion('1.2')).toThrow()
  })

  it('isSupportedMajorVersion returns true for major 1', () => {
    expect(isSupportedMajorVersion('1.0.0')).toBe(true)
    expect(isSupportedMajorVersion('1.99.99')).toBe(true)
  })

  it('isSupportedMajorVersion returns false for other majors', () => {
    expect(isSupportedMajorVersion('2.0.0')).toBe(false)
    expect(isSupportedMajorVersion('0.9.0')).toBe(false)
  })

  it('validates schemas', () => {
    expect(SemanticVersionSchema.parse('1.0.0')).toBe('1.0.0')
    expect(() => SemanticVersionSchema.parse('bad')).toThrow()
    expect(ApiVersionSchema.parse('v1')).toBe('v1')
  })
})

describe('envelope', () => {
  it('ResponseMetaSchema validates correct meta', () => {
    const meta = ResponseMetaSchema.parse({
      requestId: 'abc123def456ghi789'.repeat(2),
      serverTime: '2026-06-11T12:00:00.000Z',
      apiVersion: 'v1',
      contractVersion: '1.0.0',
    })
    expect(meta.requestId.length).toBeGreaterThanOrEqual(16)
  })

  it('createSuccessMeta generates valid meta', () => {
    const meta = createSuccessMeta('test-request-id-12345')
    expect(meta.apiVersion).toBe('v1')
    expect(meta.contractVersion).toBe('1.0.0')
    expect(meta.serverTime).toBeTruthy()
  })

  it('SuccessEnvelopeSchema wraps data', () => {
    const schema = SuccessEnvelopeSchema(z.object({ name: z.string() }))
    const result = schema.parse({
      data: { name: 'test' },
      meta: {
        requestId: 'a'.repeat(20),
        serverTime: '2026-06-11T12:00:00.000Z',
        apiVersion: 'v1',
        contractVersion: '1.0.0',
      },
    })
    expect(result.data.name).toBe('test')
  })

  it('SuccessEnvelopeSchema rejects unknown data fields in strict mode', () => {
    const schema = SuccessEnvelopeSchema(z.object({ name: z.string() }).strict())
    const result = schema.safeParse({
      data: { name: 'test', extra: 'unknown' },
      meta: {
        requestId: 'a'.repeat(20),
        serverTime: '2026-06-11T12:00:00.000Z',
        apiVersion: 'v1',
        contractVersion: '1.0.0',
      },
    })
    expect(result.success).toBe(false)
  })

  it('EmptySuccessDataSchema validates ok:true', () => {
    expect(EmptySuccessDataSchema.parse({ ok: true })).toEqual({ ok: true })
    expect(() => EmptySuccessDataSchema.parse({ ok: false })).toThrow()
  })
})

describe('errors', () => {
  it('FieldIssueSchema validates field issues', () => {
    const issue = FieldIssueSchema.parse({
      path: 'limit',
      code: 'too_big',
      message: 'Must be <= 100',
    })
    expect(issue.path).toBe('limit')
  })

  it('FailureEnvelopeSchema validates failure payload', () => {
    const payload = FailureEnvelopeSchema.parse({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: [{ path: 'field', code: 'invalid', message: 'bad' }],
      },
      meta: {
        requestId: 'a'.repeat(20),
        serverTime: '2026-06-11T12:00:00.000Z',
        apiVersion: 'v1',
        contractVersion: '1.0.0',
      },
    })
    expect(payload.error.code).toBe('VALIDATION_ERROR')
  })

  it('GOVERNED_ERROR_REGISTRY contains all required codes', () => {
    const requiredCodes = [
      'VALIDATION_ERROR', 'INVALID_CURSOR', 'UNAUTHENTICATED', 'SESSION_EXPIRED',
      'FORBIDDEN', 'ADMIN_MFA_REQUIRED', 'ADMIN_PERMISSIONS_STALE', 'NOT_FOUND',
      'CONFLICT', 'IDEMPOTENCY_KEY_REUSED', 'IDEMPOTENCY_IN_PROGRESS',
      'CONTRACT_VIOLATION', 'CONTRACT_VERSION_MISMATCH', 'RATE_LIMITED',
      'PROVIDER_UNAVAILABLE', 'SERVICE_UNAVAILABLE', 'INTERNAL_ERROR',
    ]
    for (const code of requiredCodes) {
      expect(GOVERNED_ERROR_REGISTRY[code]).toBeDefined()
      expect(getErrorDefinition(code)).toBeDefined()
    }
  })

  it('normalizeErrorCode returns known codes unchanged', () => {
    expect(normalizeErrorCode('VALIDATION_ERROR')).toBe('VALIDATION_ERROR')
  })

  it('normalizeErrorCode returns CONTRACT_VIOLATION for unknown codes', () => {
    expect(normalizeErrorCode('UNKNOWN_CODE')).toBe('CONTRACT_VIOLATION')
  })
})

describe('pagination', () => {
  it('defaults limit to 25', () => {
    const query = CursorQuerySchema.parse({})
    expect(query.limit).toBe(DEFAULT_PAGE_SIZE)
    const offsetQuery = OffsetQuerySchema.parse({})
    expect(offsetQuery.limit).toBe(DEFAULT_PAGE_SIZE)
  })

  it('accepts limit up to 100', () => {
    const query = CursorQuerySchema.parse({ limit: '100' })
    expect(query.limit).toBe(MAXIMUM_PAGE_SIZE)
  })

  it('rejects limit over 100', () => {
    expect(() => CursorQuerySchema.parse({ limit: 101 })).toThrow()
    expect(() => OffsetQuerySchema.parse({ limit: 101 })).toThrow()
  })

  it('validates cursor page metadata', () => {
    const meta = CursorPageMetaSchema.parse({
      mode: 'cursor',
      limit: 25,
      nextCursor: null,
      hasMore: false,
    })
    expect(meta.mode).toBe('cursor')
  })

  it('validates offset page metadata', () => {
    const meta = OffsetPageMetaSchema.parse({
      mode: 'offset',
      limit: 25,
      offset: 0,
      total: 0,
      hasMore: false,
    })
    expect(meta.mode).toBe('offset')
  })
})

describe('parse-response', () => {
  it('parses valid success response', () => {
    const schema = z.object({ id: z.string() })
    const result = parseSuccessResponse(schema, {
      data: { id: '123' },
      meta: {
        requestId: 'a'.repeat(20),
        serverTime: '2026-06-11T12:00:00.000Z',
        apiVersion: 'v1',
        contractVersion: '1.0.0',
      },
    })
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.data.id).toBe('123')
    }
  })

  it('detects contract version mismatch', () => {
    const schema = z.object({ id: z.string() })
    const result = parseSuccessResponse(schema, {
      data: { id: '123' },
      meta: {
        requestId: 'a'.repeat(20),
        serverTime: '2026-06-11T12:00:00.000Z',
        apiVersion: 'v1',
        contractVersion: '2.0.0',
      },
    })
    expect(result.kind).toBe('contract-mismatch')
    if (result.kind === 'contract-mismatch') {
      expect(result.expectedMajor).toBe(1)
      expect(result.receivedVersion).toBe('2.0.0')
    }
  })

  it('parses valid failure response', () => {
    const result = parseFailureResponse({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
      },
      meta: {
        requestId: 'a'.repeat(20),
        serverTime: '2026-06-11T12:00:00.000Z',
        apiVersion: 'v1',
        contractVersion: '1.0.0',
      },
    })
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('VALIDATION_ERROR')
    }
  })
})

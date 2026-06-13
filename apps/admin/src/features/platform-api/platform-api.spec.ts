import { describe, expect, it } from 'vitest'
import { adminUserSchema } from '@ehsbha/api-contracts'
import { parseData } from './parse'
import { AdminPlatformError } from './errors'
import { shouldRetry } from './retry'

const meta = {
  requestId: 'request-id-00000002',
  serverTime: '2026-06-12T00:00:00.000Z',
  apiVersion: 'v1' as const,
  contractVersion: '1.0.0',
}

describe('admin platform API', () => {
  it('parses an admin response with the shared schema', () => {
    const result = parseData(adminUserSchema, {
      data: {
        id: 'admin_1',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'super-admin',
        permissions: ['users.read'],
        isActive: true,
      },
      meta,
    }, 'admin.users.get')
    expect(result.id).toBe('admin_1')
  })

  it('preserves request identity for malformed data', () => {
    try {
      parseData(adminUserSchema, { data: {}, meta }, 'admin.users.get')
    } catch (error) {
      expect(error).toBeInstanceOf(AdminPlatformError)
      expect(error).toMatchObject({
        code: 'CONTRACT_VIOLATION',
        requestId: meta.requestId,
        operationId: 'admin.users.get',
      })
    }
  })

  it('keeps contract mismatch distinct from session outcomes', () => {
    expect(() => parseData(adminUserSchema, {
      data: {},
      meta: { ...meta, contractVersion: '2.0.0' },
    }, 'admin.users.get')).toThrowError('Unsupported contract version 2.0.0')
  })

  it('does not retry deterministic admin outcomes', () => {
    expect(shouldRetry(new AdminPlatformError('FORBIDDEN', 403, 'forbidden'), 0)).toBe(false)
    expect(shouldRetry(new AdminPlatformError('ADMIN_MFA_REQUIRED', 403, 'mfa'), 0)).toBe(false)
    expect(shouldRetry(new AdminPlatformError('SESSION_EXPIRED', 401, 'expired'), 0)).toBe(false)
  })

  it('does not retry governed contract failures just because the status is 502', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 502,
        headers: {},
        data: {
          error: {
            code: 'CONTRACT_VERSION_MISMATCH',
            message: 'Unsupported contract version 2.0.0',
          },
          meta: { ...meta, contractVersion: '2.0.0' },
        },
      },
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'bad gateway',
      config: {},
    }

    expect(shouldRetry(error, 0)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { driverProfileSchema } from '@ehsbha/api-contracts'
import { parseData } from './parse'
import { PlatformError } from './errors'
import { getRetryAfterMs, shouldRetry } from './retry'

const meta = {
  requestId: 'request-id-00000001',
  serverTime: '2026-06-12T00:00:00.000Z',
  apiVersion: 'v1' as const,
  contractVersion: '1.0.0',
}

describe('driver platform API', () => {
  it('parses operation data with the shared response schema', () => {
    const result = parseData(driverProfileSchema, {
      data: {
        id: 'driver_1',
        name: 'Ahmed',
        phone: '01000000000',
        locale: 'ar',
        futureField: true,
      },
      meta,
    }, 'driver.profile.get')
    expect(result.id).toBe('driver_1')
    expect(result.futureField).toBe(true)
  })

  it('rejects malformed success data as a contract violation', () => {
    expect(() => parseData(driverProfileSchema, {
      data: { id: 'driver_1' },
      meta,
    }, 'driver.profile.get')).toThrowError(PlatformError)
    try {
      parseData(driverProfileSchema, { data: { id: 'driver_1' }, meta }, 'driver.profile.get')
    } catch (error) {
      expect(error).toMatchObject({
        code: 'CONTRACT_VIOLATION',
        requestId: meta.requestId,
      })
    }
  })

  it('rejects unsupported contract majors without retry', () => {
    const body = {
      data: {
        id: 'driver_1',
        name: 'Ahmed',
        phone: '01000000000',
        locale: 'ar',
      },
      meta: { ...meta, contractVersion: '2.0.0' },
    }
    expect(() => parseData(driverProfileSchema, body, 'driver.profile.get'))
      .toThrowError('Unsupported contract version 2.0.0')
    expect(shouldRetry(new PlatformError(
      'CONTRACT_VERSION_MISMATCH',
      502,
      'mismatch',
    ), 0)).toBe(false)
  })

  it('bounds retries and respects Retry-After', () => {
    const error = {
      isAxiosError: true,
      response: { status: 503, headers: { 'retry-after': '2' } },
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'unavailable',
      config: {},
    }
    expect(shouldRetry(error, 0)).toBe(true)
    expect(shouldRetry(error, 2)).toBe(false)
    expect(getRetryAfterMs(error)).toBe(2000)
  })

  it('does not retry governed contract failures even when the HTTP status is retryable', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 502,
        headers: {},
        data: {
          error: {
            code: 'CONTRACT_VIOLATION',
            message: 'contract failed',
          },
          meta,
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

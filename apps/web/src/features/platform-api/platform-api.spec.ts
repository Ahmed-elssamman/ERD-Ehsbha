import { describe, expect, it } from 'vitest'
import { driverProfileSchema } from '@ehsbha/api-contracts'
import { parseData } from './parse'
import { PlatformError } from './errors'
import { getRetryAfterMs, shouldRetry } from './retry'

const meta = {
  requestId: 'request-id-00000001',
  serverTime: '2026-06-12T00:00:00.000Z',
  apiVersion: 'v1' as const,
  contractVersion: '2.0.0',
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
      meta: { ...meta, contractVersion: '1.0.0' },
    }
    expect(() => parseData(driverProfileSchema, body, 'driver.profile.get'))
      .toThrowError('Unsupported contract version 1.0.0')
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

  it('does not retry VALIDATION_ERROR even when status is retryable', () => {
    const error = {
      isAxiosError: true,
      response: { status: 400, headers: {}, data: { error: { code: 'VALIDATION_ERROR', message: 'bad input' }, meta } },
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'bad request',
      config: {},
    }
    expect(shouldRetry(error, 0)).toBe(false)
  })

  it('does not retry UNAUTHENTICATED even when status is retryable', () => {
    const error = {
      isAxiosError: true,
      response: { status: 401, headers: {}, data: { error: { code: 'UNAUTHENTICATED', message: 'unauthorized' }, meta } },
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'unauthorized',
      config: {},
    }
    expect(shouldRetry(error, 0)).toBe(false)
  })

  it('does not retry CONFLICT even when status is retryable', () => {
    const error = {
      isAxiosError: true,
      response: { status: 409, headers: {}, data: { error: { code: 'CONFLICT', message: 'duplicate' }, meta } },
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'conflict',
      config: {},
    }
    expect(shouldRetry(error, 0)).toBe(false)
  })

  it('does not retry contract-mismatch at the error level', () => {
    const error = {
      isAxiosError: true,
      response: { status: 502, headers: {}, data: { error: { code: 'CONTRACT_VERSION_MISMATCH', message: 'bad version' }, meta } },
      toJSON: () => ({}),
      name: 'AxiosError',
      message: 'bad gateway',
      config: {},
    }
    expect(shouldRetry(error, 0)).toBe(false)
  })
})

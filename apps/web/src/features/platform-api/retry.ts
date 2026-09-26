import axios from 'axios'
import { getErrorDefinition, parseFailureResponse } from '@ehsbha/api-contracts/core'
import { PlatformError } from './errors'

const RETRYABLE_STATUSES = [408, 429, 502, 503, 504]
const MAX_RETRIES = 2

export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_STATUSES.includes(status)
}

export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error)
    && !error.response
    && (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK')
}

export function shouldRetry(error: unknown, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false
  if (error instanceof PlatformError) return false
  if (isNetworkError(error)) return true
  if (!axios.isAxiosError(error) || !error.response) return false

  const parsed = parseFailureResponse(error.response.data)
  if (parsed.kind === 'failure') {
    const definition = getErrorDefinition(parsed.code)
    return definition?.retryPolicy === 'safe-read' || definition?.retryPolicy === 'retry-after'
  }
  if (parsed.kind === 'contract-mismatch') return false

  return isRetryableHttpStatus(error.response.status)
}

export function getRetryAfterMs(error: unknown, attempt = 0): number {
  if (axios.isAxiosError(error)) {
    const retryAfter = error.response?.headers?.['retry-after']
    if (typeof retryAfter === 'string') {
      const seconds = Number.parseInt(retryAfter, 10)
      if (Number.isFinite(seconds)) return seconds * 1000
      const date = Date.parse(retryAfter)
      if (Number.isFinite(date)) return Math.max(0, date - Date.now())
    }
  }
  return Math.min(1000 * 2 ** attempt, 8000)
}

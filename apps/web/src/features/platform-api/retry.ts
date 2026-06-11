const RETRYABLE_STATUSES = [408, 429, 502, 503, 504]
const MAX_RETRIES = 2

export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_STATUSES.includes(status)
}

export function isNetworkError(error: any): boolean {
  return !error.response && error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK'
}

export function shouldRetry(error: any, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false
  if (isNetworkError(error)) return true
  if (error.response && isRetryableHttpStatus(error.response.status)) return true
  return false
}

export function getRetryAfterMs(error: any): number {
  const retryAfter = error.response?.headers?.['retry-after']
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10)
    if (!isNaN(seconds)) return seconds * 1000
  }
  return Math.min(1000 * Math.pow(2, error.config?.__retryCount || 0), 8000)
}

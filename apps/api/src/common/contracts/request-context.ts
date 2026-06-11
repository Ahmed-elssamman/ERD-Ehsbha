import { v4 as uuidv4, validate as isValidUuid } from 'uuid'
import { Request } from 'express'

export interface RequestContext {
  requestId: string
  startTime: number
}

declare global {
  namespace Express {
    interface Request {
      requestContext: RequestContext
    }
  }
}

const REQUEST_ID_MIN_LENGTH = 16
const REQUEST_ID_MAX_LENGTH = 128

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9-_.:]{16,128}$/

export function validateRequestId(value: string): boolean {
  if (typeof value !== 'string') return false
  if (value.length < REQUEST_ID_MIN_LENGTH || value.length > REQUEST_ID_MAX_LENGTH) return false
  return isValidUuid(value) || REQUEST_ID_PATTERN.test(value)
}

export function generateRequestId(): string {
  return uuidv4()
}

export function createRequestContext(inboundRequestId?: string): RequestContext {
  const requestId = inboundRequestId && validateRequestId(inboundRequestId)
    ? inboundRequestId
    : generateRequestId()
  return { requestId, startTime: Date.now() }
}

import { z } from 'zod'
import {
  getErrorDefinition,
  parseSuccessResponse,
  parseFailureResponse,
  ParseResult,
} from '@ehsbha/api-contracts/core'
import { PlatformError } from './errors'

export function parseResponse<S extends z.ZodTypeAny>(
  schema: S,
  body: unknown,
): ParseResult<z.output<S>> {
  return parseSuccessResponse(schema, body)
}

export function parseError(body: unknown) {
  return parseFailureResponse(body)
}

export function parseData<S extends z.ZodTypeAny>(
  schema: S,
  body: unknown,
  operationId: string,
): z.output<S> {
  const result = parseSuccessResponse(schema, body)
  if (result.kind === 'success') return result.data
  if (result.kind === 'failure') {
    throw new PlatformError(
      result.code,
      getErrorDefinition(result.code)?.httpStatus || 500,
      result.message,
      result.details,
      result.meta.requestId,
      operationId,
    )
  }
  if (result.kind === 'contract-mismatch') {
    throw new PlatformError(
      'CONTRACT_VERSION_MISMATCH',
      502,
      `Unsupported contract version ${result.receivedVersion}`,
      { expectedMajor: result.expectedMajor },
      result.meta?.requestId || null,
      operationId,
    )
  }
  throw new PlatformError(
    'CONTRACT_VIOLATION',
    502,
    'Response did not match the shared contract',
    null,
    result.meta?.requestId || null,
    operationId,
  )
}

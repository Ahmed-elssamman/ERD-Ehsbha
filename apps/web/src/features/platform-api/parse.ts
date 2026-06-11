import { z } from 'zod'
import { parseSuccessResponse, parseFailureResponse, ParseResult } from '@ehsbha/api-contracts/core'

export function parseResponse<T>(schema: z.ZodType<T>, body: unknown): ParseResult<T> {
  return parseSuccessResponse(schema, body)
}

export function parseError(body: unknown) {
  return parseFailureResponse(body)
}

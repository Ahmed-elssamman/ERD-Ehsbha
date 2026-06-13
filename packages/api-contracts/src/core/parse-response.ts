import { z } from 'zod'
import { ResponseMetaSchema, SuccessEnvelopeSchema } from './envelope'
import { FailureEnvelopeSchema, normalizeErrorCode, getErrorDefinition } from './errors'
import { isSupportedMajorVersion } from './version'
import type { FieldIssue } from './errors'

export interface ParsedSuccess<T> {
  kind: 'success'
  data: T
  meta: z.infer<typeof ResponseMetaSchema>
}

export interface ParsedFailure {
  kind: 'failure'
  code: string
  message: string
  messageKey: string | null
  details: FieldIssue[] | null
  meta: z.infer<typeof ResponseMetaSchema>
}

export interface ParsedContractMismatch {
  kind: 'contract-mismatch'
  meta: z.infer<typeof ResponseMetaSchema> | null
  receivedVersion: string
  expectedMajor: number
}

export interface ParsedUnknownError {
  kind: 'unknown'
  meta: z.infer<typeof ResponseMetaSchema> | null
}

export type ParseResult<T> = ParsedSuccess<T> | ParsedFailure | ParsedContractMismatch | ParsedUnknownError

export function parseSuccessResponse<S extends z.ZodTypeAny>(
  dataSchema: S,
  body: unknown,
): ParseResult<z.output<S>> {
  const metaResult = ResponseMetaSchema.safeParse(metaFrom(body))
  const contractVersion = metaResult.success ? metaResult.data.contractVersion : 'unknown'

  if (!isSupportedMajorVersion(contractVersion)) {
    return {
      kind: 'contract-mismatch',
      meta: metaResult.success ? metaResult.data : null,
      receivedVersion: contractVersion,
      expectedMajor: 1,
    }
  }

  if (!metaResult.success) {
    return { kind: 'unknown', meta: null }
  }

  const envelopeResult = SuccessEnvelopeSchema(z.unknown()).safeParse(body)
  if (!envelopeResult.success) {
    return { kind: 'unknown', meta: metaResult.data }
  }

  const dataResult = dataSchema.safeParse(envelopeResult.data.data)
  if (!dataResult.success) {
    return { kind: 'unknown', meta: envelopeResult.data.meta }
  }

  return {
    kind: 'success',
    data: dataResult.data,
    meta: envelopeResult.data.meta,
  }
}

export function parseFailureResponse(body: unknown): ParseResult<never> {
  const metaResult = ResponseMetaSchema.safeParse(metaFrom(body))
  if (metaResult.success && !isSupportedMajorVersion(metaResult.data.contractVersion)) {
    return {
      kind: 'contract-mismatch',
      meta: metaResult.data,
      receivedVersion: metaResult.data.contractVersion,
      expectedMajor: 1,
    }
  }
  const result = FailureEnvelopeSchema.safeParse(body)
  if (!result.success) {
    return {
      kind: 'unknown',
      meta: metaResult.success ? metaResult.data : null,
    }
  }

  const error = result.data.error
  const normalizedCode = normalizeErrorCode(error.code)
  const definition = getErrorDefinition(normalizedCode)

  return {
    kind: 'failure',
    code: normalizedCode,
    message: definition?.messageKey ? error.message : 'An unexpected error occurred',
    messageKey: error.messageKey ?? null,
    details: error.details ?? null,
    meta: result.data.meta,
  }
}

function metaFrom(body: unknown): unknown {
  return body !== null && typeof body === 'object' && 'meta' in body
    ? body.meta
    : undefined
}

export function redactFieldIssues(issues: FieldIssue[]): FieldIssue[] {
  return issues.map((issue) => ({
    path: issue.path,
    code: issue.code,
    message: issue.message,
    messageKey: issue.messageKey,
  }))
}

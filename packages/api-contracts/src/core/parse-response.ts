import { z } from 'zod'
import { ResponseMetaSchema, SuccessEnvelopeSchema, EmptySuccessDataSchema } from './envelope'
import { FailureEnvelopeSchema, FieldIssueSchema, normalizeErrorCode, getErrorDefinition } from './errors'
import { isSupportedMajorVersion, parseSemanticVersion } from './version'
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

export function parseSuccessResponse<T>(
  dataSchema: z.ZodType<T>,
  body: unknown,
): ParseResult<T> {
  const metaResult = ResponseMetaSchema.safeParse((body as any)?.meta)
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

  const envelopeSchema = SuccessEnvelopeSchema(dataSchema)
  const result = envelopeSchema.safeParse(body)
  if (!result.success) {
    return { kind: 'unknown', meta: metaResult.data }
  }
  return {
    kind: 'success',
    data: result.data.data as T,
    meta: result.data.meta,
  }
}

export function parseFailureResponse(body: unknown): ParseResult<never> {
  const result = FailureEnvelopeSchema.safeParse(body)
  if (!result.success) {
    const metaResult = ResponseMetaSchema.safeParse((body as any)?.meta)
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

export function redactFieldIssues(issues: FieldIssue[]): FieldIssue[] {
  return issues.map((issue) => ({
    path: issue.path,
    code: issue.code,
    message: issue.message,
    messageKey: issue.messageKey,
  }))
}

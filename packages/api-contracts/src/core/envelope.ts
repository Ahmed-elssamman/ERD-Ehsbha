import { z } from 'zod'

export const ResponseMetaSchema = z.object({
  requestId: z.string().min(16).max(128),
  serverTime: z.string(),
  apiVersion: z.literal('v1'),
  contractVersion: z.string(),
})

export type ResponseMeta = z.infer<typeof ResponseMetaSchema>

export function createSuccessMeta(requestId: string): ResponseMeta {
  return {
    requestId,
    serverTime: new Date().toISOString(),
    apiVersion: 'v1',
    contractVersion: '1.0.0',
  }
}

export const SuccessEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: ResponseMetaSchema,
  })

export const EmptySuccessDataSchema = z.object({
  ok: z.literal(true),
}).passthrough()

export type EmptySuccessData = z.infer<typeof EmptySuccessDataSchema>

export const RESPONSE_HEADERS = {
  REQUEST_ID: 'X-Request-Id',
  API_VERSION: 'X-Api-Version',
  CONTRACT_VERSION: 'X-Contract-Version',
} as const

import { z } from 'zod'
import type { OcrPlatform } from './ocr-platform'
import type { OcrStructuredTrip } from './ocr-structured'

export const OCR_MAX_IMAGES = 20
export const OCR_MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const OCR_MAX_BATCH_BYTES = 40 * 1024 * 1024
export const OCR_ALLOWED_MIME = /^image\/(png|jpe?g|webp|heic|heif)$/i

export enum OcrDocumentStatus {
  Completed = 'completed',
  Failed = 'failed',
  Duplicate = 'duplicate',
}

export enum OcrCandidateStatus {
  Ready = 'ready',
  Review = 'review',
  Duplicate = 'duplicate',
}

export interface OcrCandidateSource {
  documentId: string
  imageHash: string
  lineStart: number
  lineEnd: number
}

export interface OcrCandidateEvidence {
  id: string
  platform: OcrPlatform | null
  platformConfidence: number
  status: OcrCandidateStatus
  duplicateOf: string | null
  sources: OcrCandidateSource[]
  warnings: string[]
  rawText: string
  extractions?: OcrStructuredTrip[]
}

export interface OcrDocumentResult {
  id: string
  imageHash: string
  index: number
  status: OcrDocumentStatus
  duplicateOf: string | null
  errorCode: string | null
  rawText: string
  candidateIds: string[]
}

export const ocrCandidateSourceSchema: z.ZodType<OcrCandidateSource> = z.object({
  documentId: z.string(), imageHash: z.string().regex(/^[a-f0-9]{64}$/),
  lineStart: z.number().int().nonnegative(), lineEnd: z.number().int().nonnegative(),
}).strict()

export const ocrDocumentResultSchema: z.ZodType<OcrDocumentResult> = z.object({
  id: z.string(), imageHash: z.string().regex(/^[a-f0-9]{64}$/), index: z.number().int().nonnegative(),
  status: z.nativeEnum(OcrDocumentStatus), duplicateOf: z.string().nullable(),
  errorCode: z.string().nullable(), rawText: z.string().max(40000), candidateIds: z.array(z.string()),
}).strict()

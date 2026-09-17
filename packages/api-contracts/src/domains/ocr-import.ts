import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import type { ConsumerBinding } from '../catalog/types'
import { DEFAULT_PAGE_SIZE } from '../core/pagination'
import { OCR_MAX_BATCH_BYTES, OCR_MAX_IMAGE_BYTES, OCR_MAX_IMAGES } from './ocr-capture'
import { ocrExtractRequestHintsSchema, ocrExtractResponseSchema, type OcrExtractRequestHints, type OcrExtractResponse } from './trip-ocr'
import { ocrConfirmationReceiptSchema, type OcrConfirmationReceipt } from './ocr-confirmation'

export enum OcrImportStatus {
  Uploading = 'uploading', Processing = 'processing', Review = 'review', Cancelled = 'cancelled', Expired = 'expired',
}
export enum OcrImportImageStatus {
  AwaitingUpload = 'awaiting_upload', Queued = 'queued', Processing = 'processing',
  Completed = 'completed', Failed = 'failed', Duplicate = 'duplicate',
}
export interface OcrImportImageInput { imageHash: string; size: number; mimeType: string }
export interface CreateOcrImportRequest { clientMutationId: string; hints: OcrExtractRequestHints; images: OcrImportImageInput[] }
export interface OcrImportImage {
  id: string; index: number; imageHash: string; size: number; mimeType: string;
  status: OcrImportImageStatus; duplicateOf: string | null; errorCode: string | null; attempts: number;
}
export interface OcrImportSummary {
  id: string; clientMutationId: string; status: OcrImportStatus; createdAt: string; expiresAt: string;
  uploadExpiresAt: string; imageCount: number; finishedImageCount: number;
}
export interface OcrImportDetail extends OcrImportSummary {
  hints: OcrExtractRequestHints; images: OcrImportImage[]; result: OcrExtractResponse | null;
  confirmations: OcrConfirmationReceipt[];
}
export interface OcrImportList { items: OcrImportSummary[]; nextCursor: string | null }
export interface OcrImportListQuery { cursor?: string; limit: number }

export const ocrImportImageInputSchema: z.ZodType<OcrImportImageInput> = z.object({
  imageHash: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().min(1).max(OCR_MAX_IMAGE_BYTES),
  mimeType: z.string().regex(/^image\/(png|jpeg|webp|heic|heif)$/i),
}).strict()
export const createOcrImportRequestSchema = z.object({
  clientMutationId: z.string().uuid(), hints: ocrExtractRequestHintsSchema,
  images: z.array(ocrImportImageInputSchema).min(1).max(OCR_MAX_IMAGES),
}).strict().superRefine((request, ctx) => {
  if (request.images.reduce((sum, image) => sum + image.size, 0) > OCR_MAX_BATCH_BYTES) {
    ctx.addIssue({ code: 'custom', path: ['images'], message: 'OCR_BATCH_TOO_LARGE' })
  }
  const originals = new Map<string, OcrImportImageInput>()
  for (const [index, image] of request.images.entries()) {
    const original = originals.get(image.imageHash)
    if (original && (original.size !== image.size || original.mimeType !== image.mimeType)) {
      ctx.addIssue({ code: 'custom', path: ['images', index], message: 'OCR_IMAGE_INVALID' })
    }
    originals.set(image.imageHash, image)
  }
})
export const ocrImportImageSchema: z.ZodType<OcrImportImage> = z.object({
  id: z.string(), index: z.number().int().nonnegative(), imageHash: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().positive(), mimeType: z.string(), status: z.nativeEnum(OcrImportImageStatus),
  duplicateOf: z.string().nullable(), errorCode: z.string().nullable(), attempts: z.number().int().nonnegative(),
}).passthrough()
const summaryShape = {
  id: z.string(), clientMutationId: z.string().uuid(), status: z.nativeEnum(OcrImportStatus),
  createdAt: z.string().datetime(), expiresAt: z.string().datetime(), uploadExpiresAt: z.string().datetime(),
  imageCount: z.number().int().nonnegative(), finishedImageCount: z.number().int().nonnegative(),
}
export const ocrImportSummarySchema: z.ZodType<OcrImportSummary> = z.object(summaryShape).passthrough()
export const ocrImportDetailSchema = z.object({
  ...summaryShape, hints: ocrExtractRequestHintsSchema, images: z.array(ocrImportImageSchema), result: ocrExtractResponseSchema.nullable(),
  confirmations: z.array(ocrConfirmationReceiptSchema).default([]),
}).passthrough()
export const ocrImportListSchema: z.ZodType<OcrImportList> = z.object({
  items: z.array(ocrImportSummarySchema), nextCursor: z.string().nullable(),
}).passthrough()
export const ocrImportListQuerySchema = z.object({
  cursor: z.string().min(1).max(128).optional(), limit: z.coerce.number().int().min(1).max(DEFAULT_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
}).strict()

const consumers: ConsumerBinding[] = [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }]
const common = {
  transport: 'http', realm: 'driver', lifecycle: 'active',
  consumers,
  compatibility: 'additive-compatible', owner: 'platform', pagination: null, idempotency: null, followUp: null,
} as const
registerOperation({ ...common, operationId: 'driver.ocr.imports.create', method: 'POST', path: '/api/v1/ocr/imports',
  request: { body: 'createOcrImportRequestSchema' }, successData: 'ocrImportDetailSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'RATE_LIMITED', 'IDEMPOTENCY_KEY_REUSED', 'OCR_BUSY'],
})
registerOperation({ ...common, operationId: 'driver.ocr.imports.list', method: 'GET', path: '/api/v1/ocr/imports',
  request: { query: 'ocrImportListQuerySchema' }, successData: 'ocrImportListSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND'],
  pagination: { mode: 'cursor', defaultSize: DEFAULT_PAGE_SIZE, maximumSize: DEFAULT_PAGE_SIZE, stableSort: ['createdAt:desc', 'id:desc'], exceptionOwner: null, exceptionReason: null },
})
registerOperation({ ...common, operationId: 'driver.ocr.imports.get', method: 'GET', path: '/api/v1/ocr/imports/:id',
  request: {}, successData: 'ocrImportDetailSchema', failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
})
registerOperation({ ...common, operationId: 'driver.ocr.imports.upload', method: 'POST', path: '/api/v1/ocr/imports/:id/images/:imageId',
  request: {}, successData: 'ocrImportDetailSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND', 'RATE_LIMITED', 'OCR_IMAGE_INVALID', 'OCR_IMAGE_TOO_LARGE', 'OCR_UNSUPPORTED_MIME', 'OCR_IMPORT_CLOSED'],
})
registerOperation({ ...common, operationId: 'driver.ocr.imports.cancel', method: 'DELETE', path: '/api/v1/ocr/imports/:id',
  request: {}, successData: 'ocrImportDetailSchema', failureCodes: ['UNAUTHENTICATED', 'NOT_FOUND'],
})

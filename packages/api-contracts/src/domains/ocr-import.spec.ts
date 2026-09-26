import { describe, expect, it } from 'vitest'
import { createOcrImportRequestSchema, ocrImportListQuerySchema } from './ocr-import'
import { OCR_MAX_IMAGE_BYTES } from './ocr-capture'

const image = { imageHash: 'a'.repeat(64), size: 1024, mimeType: 'image/png' }
const request = { clientMutationId: 'bf5068b0-1c44-42d2-b36a-d0290d066a74', hints: {}, images: [image] }
describe('persisted OCR import contracts', () => {
  it('defaults optional extraction hints and accepts twenty duplicate references', () => {
    const parsed = createOcrImportRequestSchema.parse({ ...request, images: Array.from({ length: 20 }, () => image) })
    expect(parsed.hints).toEqual({ mode: 'auto', platform: null })
    expect(parsed.images).toHaveLength(20)
  })
  it('rejects extra fields and invalid hashes, types and sizes', () => {
    expect(createOcrImportRequestSchema.safeParse({ ...request, driverId: 'another-driver' }).success).toBe(false)
    for (const invalid of [{ ...image, size: 0 }, { ...image, size: OCR_MAX_IMAGE_BYTES + 1 }, { ...image, mimeType: 'image/svg+xml' }, { ...image, imageHash: '../image' }]) {
      expect(createOcrImportRequestSchema.safeParse({ ...request, images: [invalid] }).success).toBe(false)
    }
  })
  it('rejects oversized manifests and contradictory duplicate metadata', () => {
    expect(createOcrImportRequestSchema.safeParse({ ...request, images: Array.from({ length: 21 }, () => image) }).success).toBe(false)
    expect(createOcrImportRequestSchema.safeParse({ ...request, images: Array.from({ length: 9 }, () => ({ ...image, size: OCR_MAX_IMAGE_BYTES })) }).success).toBe(false)
    expect(createOcrImportRequestSchema.safeParse({ ...request, images: [image, { ...image, size: 2 }] }).success).toBe(false)
  })
  it('bounds list queries and disallows another owner as a query parameter', () => {
    expect(ocrImportListQuerySchema.parse({})).toEqual({ limit: 25 })
    expect(ocrImportListQuerySchema.safeParse({ limit: 26 }).success).toBe(false)
    expect(ocrImportListQuerySchema.safeParse({ driverId: 'other' }).success).toBe(false)
  })
})

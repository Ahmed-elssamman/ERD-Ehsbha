import {
  OcrImportStatus, OcrImportImageStatus, ocrExtractRequestHintsSchema, ocrExtractResponseSchema,
  type OcrImportDetail, type OcrImportSummary,
} from '@ehsbha/api-contracts';
import type { OcrImportWithImages } from './ocr-import.model';

export function importSummary(batch: OcrImportWithImages, now = new Date()): OcrImportSummary {
  const originals = batch.images.filter((image) => !image.duplicateOf);
  const terminal = new Set<string>([OcrImportImageStatus.Completed, OcrImportImageStatus.Failed]);
  let status = OcrImportStatus.Uploading;
  if (originals.some((image) => image.status === OcrImportImageStatus.Queued || image.status === OcrImportImageStatus.Processing)) status = OcrImportStatus.Processing;
  if (batch.result) status = OcrImportStatus.Review;
  if (batch.expiresAt <= now) status = OcrImportStatus.Expired;
  if (batch.cancelledAt) status = OcrImportStatus.Cancelled;
  const finishedImageCount = batch.images.filter((image) => {
    const original = image.duplicateOf ? originals.find((item) => item.id === image.duplicateOf) : image;
    return original ? terminal.has(original.status) : false;
  }).length;
  return {
    id: batch.id, clientMutationId: batch.clientMutationId, status,
    createdAt: batch.createdAt.toISOString(), expiresAt: batch.expiresAt.toISOString(),
    uploadExpiresAt: batch.uploadExpiresAt.toISOString(), imageCount: batch.images.length, finishedImageCount,
  };
}

export function importDetail(batch: OcrImportWithImages): OcrImportDetail {
  const summary = importSummary(batch);
  const closed = summary.status === OcrImportStatus.Expired || summary.status === OcrImportStatus.Cancelled;
  return {
    ...summary, hints: ocrExtractRequestHintsSchema.parse(batch.hints),
    confirmations: [],
    images: batch.images.map((image) => ({
      id: image.id, index: image.index, imageHash: image.imageHash, size: image.size, mimeType: image.mimeType,
      status: image.status as OcrImportImageStatus, duplicateOf: image.duplicateOf, errorCode: image.errorCode, attempts: image.attempts,
    })),
    result: !closed && batch.result ? ocrExtractResponseSchema.parse(batch.result) : null,
  };
}

import { OcrImportImageStatus, OcrImportStatus, type OcrImportDetail } from '@ehsbha/api-contracts';
import { OcrImportsApi } from '@/lib/api/ocr-imports.api';
import type { OcrExtractInput } from '@/lib/api/ocr.api';
import type { OcrCaptureDraft } from './ocr-capture-store';

export async function createCaptureDraft(input: OcrExtractInput): Promise<OcrCaptureDraft> {
  const manifest = [];
  for (const file of input.files) {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    manifest.push({ imageHash: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''), size: file.size, mimeType: file.type });
  }
  return { clientMutationId: crypto.randomUUID(), batchId: null, mode: input.mode, platform: input.platform, manifest, detail: null, review: null, expiresAt: Date.now() + 7 * 24 * 3600000 };
}

export async function runOcrImport(draft: OcrCaptureDraft, files: File[], signal: AbortSignal, update: (detail: OcrImportDetail) => Promise<void>): Promise<OcrImportDetail> {
  let detail = draft.batchId ? await OcrImportsApi.get(draft.batchId, signal) : await OcrImportsApi.create({
    clientMutationId: draft.clientMutationId, hints: { mode: draft.mode, platform: draft.platform }, images: draft.manifest,
  }, signal);
  await update(detail);
  if (detail.status === OcrImportStatus.Cancelled || detail.status === OcrImportStatus.Expired) throw new Error('OCR_IMPORT_CLOSED');
  for (const image of detail.images) {
    if (image.status !== OcrImportImageStatus.AwaitingUpload) continue;
    const file = files[image.index];
    if (!file) throw new Error('OCR_DRAFT_IMAGES_MISSING');
    detail = await OcrImportsApi.upload(detail.id, image.id, file, signal);
    await update(detail);
  }
  while (detail.status === OcrImportStatus.Processing || detail.status === OcrImportStatus.Uploading) {
    await waitForPoll(signal);
    detail = await OcrImportsApi.get(detail.id, signal);
    await update(detail);
  }
  if (detail.status !== OcrImportStatus.Review) throw new Error('OCR_IMPORT_CLOSED');
  detail = await OcrImportsApi.get(detail.id, signal);
  await update(detail);
  if (detail.status !== OcrImportStatus.Review) throw new Error('OCR_IMPORT_CLOSED');
  return detail;
}

function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 1000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

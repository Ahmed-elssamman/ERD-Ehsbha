import { z } from 'zod';
import {
  ocrExtractModeSchema, ocrPlatformSchema, ocrImportDetailSchema, ocrImportImageInputSchema,
  type OcrExtractMode, type OcrPlatform, type OcrImportDetail, type OcrImportImageInput,
} from '@ehsbha/api-contracts';
import { useAuth } from '@/stores/auth.store';
import { ocrReviewDraftSchema, type OcrReviewDraft } from './ocr-review.model';

export interface OcrCaptureDraft {
  clientMutationId: string; batchId: string | null; mode: OcrExtractMode; platform: OcrPlatform | null;
  manifest: OcrImportImageInput[]; detail: OcrImportDetail | null; review: OcrReviewDraft | null; expiresAt: number;
}
export interface RestoredOcrCapture { draft: OcrCaptureDraft; files: File[] }
const captureSchema = z.object({
  clientMutationId: z.string().uuid(), batchId: z.string().nullable(), mode: ocrExtractModeSchema,
  platform: ocrPlatformSchema.nullable(), manifest: z.array(ocrImportImageInputSchema).max(20),
  detail: ocrImportDetailSchema.nullable(), review: ocrReviewDraftSchema.nullable(), expiresAt: z.number(),
}).strict();
const DATABASE_NAME = 'ehsbha-ocr-capture';
const METADATA_STORE = 'drafts';
const FILE_STORE = 'images';

export class OcrCaptureStorageError extends Error {
  constructor() { super('OCR_DRAFT_STORAGE'); this.name = 'OcrCaptureStorageError'; }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(METADATA_STORE);
      request.result.createObjectStore(FILE_STORE);
    };
    request.onerror = () => reject(new OcrCaptureStorageError());
    request.onblocked = () => reject(new OcrCaptureStorageError());
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
  });
}

export async function readOcrCapture(accountId: string): Promise<RestoredOcrCapture | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([METADATA_STORE, FILE_STORE], 'readonly');
    const metadata = transaction.objectStore(METADATA_STORE).get(accountId);
    const images = transaction.objectStore(FILE_STORE).get(accountId);
    transaction.oncomplete = () => {
      database.close();
      if (metadata.result == null) { resolve(null); return; }
      const parsed = captureSchema.safeParse(metadata.result);
      if (!parsed.success || !Array.isArray(images.result) || !images.result.every((file) => file instanceof File)) {
        reject(new OcrCaptureStorageError()); return;
      }
      if (parsed.data.expiresAt <= Date.now()) { void clearOcrCapture(accountId).then(() => resolve(null), () => resolve(null)); return; }
      resolve({ draft: parsed.data, files: images.result as File[] });
    };
    transaction.onerror = () => { database.close(); reject(new OcrCaptureStorageError()); };
    transaction.onabort = transaction.onerror;
  });
}

export async function writeOcrCapture(accountId: string, draft: OcrCaptureDraft, files?: File[]): Promise<void> {
  const database = await openDatabase();
  // A late upload or draft write from the previous account cannot recreate its
  // local financial data after logout/account switching has scheduled deletion.
  if (useAuth.getState().user?.id !== accountId) { database.close(); return; }
  const parsed = captureSchema.safeParse(draft);
  if (!parsed.success) { database.close(); throw new OcrCaptureStorageError(); }
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([METADATA_STORE, FILE_STORE], 'readwrite');
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(new OcrCaptureStorageError()); };
    transaction.onabort = transaction.onerror;
    try {
      transaction.objectStore(METADATA_STORE).put(parsed.data, accountId);
      if (files) transaction.objectStore(FILE_STORE).put(files, accountId);
    } catch { transaction.abort(); }
  });
}

export async function clearOcrCapture(accountId: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([METADATA_STORE, FILE_STORE], 'readwrite');
    transaction.objectStore(METADATA_STORE).delete(accountId);
    transaction.objectStore(FILE_STORE).delete(accountId);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(new OcrCaptureStorageError()); };
    transaction.onabort = transaction.onerror;
  });
}

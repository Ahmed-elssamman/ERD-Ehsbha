import { useCallback, useEffect, useRef, useState } from 'react';
import { OcrDocumentStatus, OcrImportStatus, type OcrExtractMode, type OcrImportDetail, type OcrPlatform } from '@ehsbha/api-contracts';
import { useAuth } from '@/stores/auth.store';
import { readApiError } from '@/lib/api/client';
import { OcrImportsApi } from '@/lib/api/ocr-imports.api';
import { OcrCaptureStorageError, clearOcrCapture, readOcrCapture, writeOcrCapture, type OcrCaptureDraft } from '@/lib/ocr/ocr-capture-store';
import { createCaptureDraft, runOcrImport } from '@/lib/ocr/ocr-import-session';
import type { OcrReviewDraft } from '@/lib/ocr/ocr-review.model';

/** One account-scoped active capture. Blob writes are separate from review edits. */
export function useOcrCapture(open: boolean) {
  const accountId = useAuth((state) => state.user?.id ?? null);
  const [files, setFiles] = useState<File[]>([]);
  const [platform, setPlatform] = useState<OcrPlatform | null>(null);
  const [mode, setMode] = useState<OcrExtractMode>('auto');
  const [draft, setDraft] = useState<OcrCaptureDraft | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [running, setRunning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [writing, setWriting] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [errorCode, setErrorCode] = useState('');
  const current = useRef<OcrCaptureDraft | null>(null);
  const controller = useRef<AbortController | null>(null);
  const writes = useRef(Promise.resolve());
  const writeCount = useRef(0);
  const sourcesDurable = useRef(false);

  const persist = useCallback((next: OcrCaptureDraft, sourceFiles?: File[]): Promise<void> => {
    if (!accountId || useAuth.getState().user?.id !== accountId) return Promise.resolve();
    current.current = next; setDraft(next); setWriting(true); writeCount.current += 1;
    const task = writes.current.then(async () => {
      if (!sourceFiles && !sourcesDurable.current) throw new OcrCaptureStorageError();
      await writeOcrCapture(accountId, next, sourceFiles);
      if (sourceFiles) sourcesDurable.current = true;
      setStorageError(false);
    }).catch(() => { if (sourceFiles) sourcesDurable.current = false; setStorageError(true); }).finally(() => {
      writeCount.current -= 1;
      if (writeCount.current === 0) setWriting(false);
    });
    writes.current = task;
    return task;
  }, [accountId]);

  useEffect(() => {
    let active = true;
    if (!accountId) { setRestoring(false); return; }
    void readOcrCapture(accountId).then((restored) => {
      if (!active || !restored) return;
      current.current = restored.draft; setDraft(restored.draft); setFiles(restored.files);
      sourcesDurable.current = true;
      setMode(restored.draft.mode); setPlatform(restored.draft.platform);
    }).catch(() => { if (active) setStorageError(true); }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; controller.current?.abort(); };
  }, [accountId]);

  const acceptDetail = useCallback(async (detail: OcrImportDetail) => {
    if (current.current?.clientMutationId === detail.clientMutationId) await persist({ ...current.current, batchId: detail.id, detail });
  }, [persist]);

  const refresh = useCallback(async () => {
    const id = current.current?.batchId;
    if (!id || controller.current) return;
    setChecking(true);
    try { await acceptDetail(await OcrImportsApi.get(id)); setErrorCode(''); }
    catch (error) { setErrorCode(captureErrorCode(error instanceof Error ? error : new Error())); }
    finally { setChecking(false); }
  }, [acceptDetail]);
  useEffect(() => { if (open && !restoring) void refresh(); }, [open, restoring, refresh]);

  const start = async () => {
    if (!accountId || restoring || running || !files.length) return;
    const abort = new AbortController(); controller.current = abort;
    setRunning(true); setErrorCode('');
    try {
      const next = current.current ?? await createCaptureDraft({ files, platform, mode });
      if (abort.signal.aborted) return;
      if (sourcesDurable.current) await persist(next);
      else await persist(next, files);
      await runOcrImport(next, files, abort.signal, async (detail) => {
        if (!abort.signal.aborted) await acceptDetail(detail);
      });
    } catch (error) {
      if (!abort.signal.aborted) setErrorCode(captureErrorCode(error instanceof Error ? error : new Error()));
    } finally {
      if (controller.current === abort) { controller.current = null; setRunning(false); }
    }
  };

  const updateReview = useCallback((review: OcrReviewDraft) => {
    const previous = current.current?.review;
    if (current.current && (previous?.cards !== review.cards || previous?.vehicleChoice !== review.vehicleChoice)) void persist({ ...current.current, review });
  }, [persist]);

  const reset = async () => {
    controller.current?.abort(); controller.current = null; setRunning(false);
    const previous = current.current;
    if (previous?.batchId && previous.detail?.status !== OcrImportStatus.Review) {
      try { await OcrImportsApi.cancel(previous.batchId); }
      catch (error) { setErrorCode(captureErrorCode(error instanceof Error ? error : new Error())); return false; }
    }
    await writes.current;
    if (accountId) {
      try { await clearOcrCapture(accountId); setStorageError(false); }
      catch { setStorageError(true); return false; }
    }
    current.current = null; setDraft(null); setFiles([]); setErrorCode('');
    sourcesDurable.current = false;
    return true;
  };

  const retryFailed = async () => {
    const failed = new Set(current.current?.detail?.result?.documents?.filter((document) => document.status === OcrDocumentStatus.Failed).map((document) => document.index));
    const remainingFiles = files.filter((_, index) => failed.has(index));
    if (await reset()) setFiles(remainingFiles);
  };
  const retryStorage = async () => { if (current.current) await persist(current.current, files); };

  return {
    files, setFiles, platform, setPlatform, mode, setMode, draft,
    restoring, running, checking, writing, storageError, errorCode,
    start, reset, refresh, acceptDetail, updateReview, retryFailed, retryStorage,
  };
}

function captureErrorCode(error: Error): string {
  if (/^OCR_[A-Z_]+$/.test(error.message)) return error.message;
  return readApiError(error).code || 'UNKNOWN';
}

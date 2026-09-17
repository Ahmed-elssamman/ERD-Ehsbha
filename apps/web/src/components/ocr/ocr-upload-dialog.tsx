import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { OcrDocumentStatus } from '@ehsbha/api-contracts';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { AppsApi, VehiclesApi } from '@/lib/api/endpoints';
import { useOcrCapture } from '@/hooks/use-ocr-capture';
import type { OcrSaveOutcome, OcrSelectedTrip } from '@/lib/ocr/ocr-to-trip';
import { OcrDropzone } from './ocr-dropzone';
import { OcrProgress } from './ocr-progress';
import { OcrMultiTripReview } from './ocr-multi-trip-review';
import { OcrSourceSelector } from './ocr-source-selector';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onParsed: (batchId: string, selected: OcrSelectedTrip[]) => Promise<OcrSaveOutcome>;
}

export function OcrUploadDialog({ open, onOpenChange, onParsed }: Props) {
  const { t, tf } = useI18n();
  const capture = useOcrCapture(open);
  const [saving, setSaving] = useState(false);
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: VehiclesApi.list, enabled: open });
  const apps = useQuery({ queryKey: ['apps', 'mine'], queryFn: AppsApi.mine, enabled: open });
  const result = capture.draft?.detail?.result ?? null;
  const busy = saving || capture.running || capture.restoring;
  const close = () => { if (!saving) onOpenChange(false); };
  const apply = async (selected: OcrSelectedTrip[]): Promise<OcrSaveOutcome> => {
    const batchId = capture.draft?.batchId;
    if (!batchId) throw new Error('OCR_CANDIDATE_NOT_FOUND');
    setSaving(true);
    try {
      const outcome = await onParsed(batchId, selected);
      await capture.refresh();
      return outcome;
    } finally { setSaving(false); }
  };
  const failedDocuments = result?.documents?.filter((document) => document.status === OcrDocumentStatus.Failed) ?? [];
  const detail = capture.draft?.detail;
  const reviewed = capture.draft?.review?.cards ?? [];
  const canRetryFailed = result?.trips.length === 0 || (reviewed.length > 0 && reviewed.every((card) => card.saved));

  return (
    <Dialog open={open} onClose={close} size={result ? 'xl' : 'lg'} title={t('trips.ocr.dialogTitle')} description={t('trips.ocr.dialogSubtitle')}>
      <div className="space-y-4">
        {capture.storageError ? <div role="alert" className="rounded-lg border border-warning/40 p-3 text-sm"><p>{t('trips.ocr.error.OCR_DRAFT_STORAGE')}</p>{capture.draft ? <Button variant="ghost" onClick={capture.retryStorage}>{t('common.retry')}</Button> : null}</div> : capture.draft ? <p role="status" className="text-xs text-muted-foreground">{t(capture.writing ? 'trips.ocr.savingDraft' : 'trips.ocr.draftSaved')}</p> : null}
        {capture.errorCode ? <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
          <p>{tf(`trips.ocr.error.${capture.errorCode}`, t('trips.ocr.error.UNKNOWN'))}</p>
          {result ? <Button variant="ghost" onClick={capture.refresh} disabled={capture.checking}>{t('common.retry')}</Button> : null}
        </div> : null}
        {capture.restoring ? <p role="status">{t('trips.ocr.restoringDraft')}</p> : result ? <div className="space-y-4">
          {failedDocuments.length ? <section className="space-y-2 rounded-lg border border-warning/40 p-3" aria-label={t('trips.ocr.failedImages')}>
            <p className="text-sm font-medium">{t('trips.ocr.failedCount', { n: failedDocuments.length })}</p>
            {failedDocuments.map((document) => <details key={document.id}><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('trips.ocr.imageNumber', { n: document.index + 1 })}: {tf(`trips.ocr.error.${document.errorCode}`, t('trips.ocr.error.OCR_FAILED'))}</summary><pre dir="auto" className="whitespace-pre-wrap break-words text-sm">{document.rawText || t('trips.ocr.noReadableText')}</pre></details>)}
            {canRetryFailed ? <Button variant="secondary" onClick={capture.retryFailed} disabled={busy}>{t('trips.ocr.retryFailed')}</Button> : <p className="text-xs">{t('trips.ocr.retryAfterReview')}</p>}
          </section> : null}
          {result.trips.length ? <OcrMultiTripReview key={result.imageHashes.join(':')} result={result} vehicles={vehicles.data ?? []} apps={apps.data ?? []}
            loading={vehicles.isPending || apps.isPending || capture.checking} lookupError={vehicles.isError || apps.isError}
            onRetryLookups={() => { void vehicles.refetch(); void apps.refetch(); }} onApply={apply} onDiscard={close} saving={saving}
            draft={capture.draft?.review ?? null} onDraftChange={capture.updateReview} confirmations={detail?.confirmations ?? []} />
            : <Button onClick={close}>{t('trips.ocr.manualFallback')}</Button>}
          <Button variant="ghost" onClick={capture.reset} disabled={busy}>{t('trips.ocr.newUpload')}</Button>
        </div> : capture.running ? <div className="space-y-3">
          <OcrProgress />
          {detail ? <p className="text-sm">{t('trips.ocr.imageProgress', { done: detail.finishedImageCount, total: detail.imageCount })}</p> : null}
          <p className="text-sm text-muted-foreground">{t('trips.ocr.backgroundCapture')}</p>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={capture.reset}>{t('common.cancel')}</Button><Button variant="secondary" onClick={close}>{t('common.close')}</Button></div>
        </div> : <div className="space-y-4">
          <OcrDropzone files={capture.files} onChange={capture.setFiles} disabled={busy || capture.draft !== null} />
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('trips.ocr.optionalSettings')}</summary><OcrSourceSelector platform={capture.platform} mode={capture.mode} onPlatformChange={capture.setPlatform} onModeChange={capture.setMode} disabled={busy || capture.draft !== null} /></details>
          {capture.draft ? <p className="text-sm">{t('trips.ocr.resumeCapture')}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {capture.draft ? <Button variant="ghost" onClick={capture.reset}>{t('trips.ocr.newUpload')}</Button> : null}
            <Button variant="ghost" onClick={close}>{t('common.cancel')}</Button>
            <Button onClick={capture.start} disabled={!capture.files.length || busy}>{t('trips.ocr.extract')}</Button>
          </div>
        </div>}
      </div>
    </Dialog>
  );
}

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { readApiError } from '@/lib/api/client';
import { useOcrExtract } from '@/hooks/use-ocr-extract';
import type {
  OcrExtractMode,
  OcrExtractResponseDto,
  OcrPlatform,
} from '@/lib/api/ocr.api';
import { OcrDropzone } from './ocr-dropzone';
import { OcrProgress } from './ocr-progress';
import { OcrReviewForm } from './ocr-review-form';
import { OcrMultiTripReview } from './ocr-multi-trip-review';
import { OcrSourceSelector } from './ocr-source-selector';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  /**
   * Called with the extracted (and optionally driver-edited) trip data when
   * the user confirms. May be async — in multi-trip mode the parent batches
   * `result.trips.length` create requests, so we await before closing the
   * dialog so the saving indicator stays visible.
   *
   * Throw or return a status object to keep the dialog open and surface the
   * message inside the review form. Returning void (or true) closes it.
   */
  onParsed: (
    result: OcrExtractResponseDto,
  ) =>
    | void
    | Promise<void>
    | { keepOpen: true; statusMessage?: { kind: 'error' | 'success'; text: string } }
    | Promise<{ keepOpen: true; statusMessage?: { kind: 'error' | 'success'; text: string } }>;
}

/**
 * Two-step upload dialog. Step 1 (always first): pick the source app and
 * whether the screenshot is a single trip or a multi-trip earnings summary.
 * Step 2: drop the files and extract. Both inputs are required — the
 * dropzone and extract button stay disabled until the driver picks a
 * platform.
 *
 * The dialog re-uses the existing single-trip review when `result.mode`
 * comes back as 'single', and switches to a scrollable multi-trip review
 * for 'multi'.
 */
export function OcrUploadDialog({ open, onOpenChange, onParsed }: Props) {
  const { t, tf } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [platform, setPlatform] = useState<OcrPlatform | null>(null);
  const [mode, setMode] = useState<OcrExtractMode>('single');
  const [result, setResult] = useState<OcrExtractResponseDto | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<
    { kind: 'error' | 'success'; text: string } | null
  >(null);
  const mut = useOcrExtract();

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setPlatform(null);
      setMode('single');
      setResult(null);
      setErrorCode(null);
      setSaving(false);
      setStatusMessage(null);
      mut.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startExtract = async () => {
    if (!platform) {
      setErrorCode('OCR_NO_PLATFORM');
      return;
    }
    if (files.length === 0) {
      setErrorCode('OCR_NO_IMAGES');
      return;
    }
    setErrorCode(null);
    try {
      const r = await mut.mutateAsync({ files, platform, mode });
      setResult(r);
    } catch (err) {
      const e = readApiError(err);
      setErrorCode(e.code || 'UNKNOWN');
    }
  };

  const apply = async (edited: OcrExtractResponseDto) => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const r = await Promise.resolve(onParsed(edited));
      if (r && typeof r === 'object' && r.keepOpen) {
        if (r.statusMessage) setStatusMessage(r.statusMessage);
        return;
      }
      onOpenChange(false);
    } catch (err) {
      const e = readApiError(err);
      setStatusMessage({
        kind: 'error',
        text: tf(`trips.ocr.error.${e.code || 'UNKNOWN'}`, e.code || 'UNKNOWN'),
      });
    } finally {
      setSaving(false);
    }
  };

  const discardResult = () => {
    setResult(null);
    setFiles([]);
    setStatusMessage(null);
  };

  const isPending = mut.isPending;
  const errorMessage = errorCode
    ? errorCode === 'OCR_NO_PLATFORM'
      ? t('trips.ocr.selectPlatformFirst')
      : tf(`trips.ocr.error.${errorCode}`, errorCode)
    : null;

  const showFooter = !result;
  const canExtract = !isPending && files.length > 0 && platform != null;
  // The multi-trip review can host up to 20 expandable cards — give it the
  // widest dialog size so each card has horizontal room. Single-trip review
  // and the initial picker stay compact.
  const dialogSize = result && result.mode === 'multi' && result.trips.length > 1 ? 'xl' : 'lg';

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      size={dialogSize}
      title={t('trips.ocr.dialogTitle')}
      description={t('trips.ocr.dialogSubtitle')}
      footer={
        showFooter ? (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={startExtract} loading={isPending} disabled={!canExtract}>
              {isPending ? t('trips.ocr.extracting') : t('trips.ocr.extract')}
            </Button>
          </>
        ) : null
      }
    >
      {result ? (
        result.mode === 'multi' && result.trips.length > 1 ? (
          <OcrMultiTripReview
            result={result}
            onApply={apply}
            onDiscard={discardResult}
            saving={saving}
            statusMessage={statusMessage}
          />
        ) : (
          <OcrReviewForm result={result} onApply={apply} onDiscard={discardResult} />
        )
      ) : isPending ? (
        <OcrProgress />
      ) : (
        <div className="space-y-4">
          <OcrSourceSelector
            platform={platform}
            mode={mode}
            onPlatformChange={setPlatform}
            onModeChange={setMode}
            disabled={isPending}
          />
          <OcrDropzone
            files={files}
            onChange={setFiles}
            disabled={isPending || platform == null}
          />
          {errorMessage ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {errorMessage}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}

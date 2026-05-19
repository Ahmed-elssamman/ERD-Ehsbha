import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { readApiError } from '@/lib/api/client';
import { useOcrExtract } from '@/hooks/use-ocr-extract';
import type { OcrExtractResponseDto } from '@/lib/api/ocr.api';
import { OcrDropzone } from './ocr-dropzone';
import { OcrProgress } from './ocr-progress';
import { OcrExtractedSummary } from './ocr-extracted-summary';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onParsed: (result: OcrExtractResponseDto) => void;
}

export function OcrUploadDialog({ open, onOpenChange, onParsed }: Props) {
  const { t, tf } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<OcrExtractResponseDto | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const mut = useOcrExtract();

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setResult(null);
      setErrorCode(null);
      mut.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startExtract = async () => {
    if (files.length === 0) {
      setErrorCode('OCR_NO_IMAGES');
      return;
    }
    setErrorCode(null);
    try {
      const r = await mut.mutateAsync(files);
      setResult(r);
    } catch (err) {
      const e = readApiError(err);
      setErrorCode(e.code || 'UNKNOWN');
    }
  };

  const apply = () => {
    if (!result) return;
    onParsed(result);
    onOpenChange(false);
  };

  const isPending = mut.isPending;
  const errorMessage = errorCode ? tf(`trips.ocr.error.${errorCode}`, errorCode) : null;

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('trips.ocr.dialogTitle')}
      description={t('trips.ocr.dialogSubtitle')}
      footer={
        result ? null : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={startExtract} loading={isPending} disabled={files.length === 0}>
              {isPending ? t('trips.ocr.extracting') : t('trips.ocr.extract')}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <OcrExtractedSummary
          result={result}
          onApply={apply}
          onDiscard={() => {
            setResult(null);
            setFiles([]);
          }}
        />
      ) : isPending ? (
        <OcrProgress />
      ) : (
        <div className="space-y-3">
          <OcrDropzone files={files} onChange={setFiles} disabled={isPending} />
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

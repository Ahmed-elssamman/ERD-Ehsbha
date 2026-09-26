import { useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { OCR_ALLOWED_MIME, OCR_MAX_BATCH_BYTES, OCR_MAX_IMAGE_BYTES, OCR_MAX_IMAGES } from '@ehsbha/api-contracts';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

interface Props { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }
interface Preview { file: File; url: string }

export function OcrDropzone({ files, onChange, disabled }: Props) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState<Preview[]>([]);
  useEffect(() => {
    const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => { for (const preview of next) URL.revokeObjectURL(preview.url); };
  }, [files]);
  const add = (incoming: File[]) => {
    const merged = [...files, ...incoming];
    let code = '';
    if (merged.length > OCR_MAX_IMAGES) code = 'OCR_TOO_MANY_IMAGES';
    else if (incoming.some((file) => !OCR_ALLOWED_MIME.test(file.type))) code = 'OCR_UNSUPPORTED_MIME';
    else if (incoming.some((file) => file.size > OCR_MAX_IMAGE_BYTES)) code = 'OCR_IMAGE_TOO_LARGE';
    else if (merged.reduce((sum, file) => sum + file.size, 0) > OCR_MAX_BATCH_BYTES) code = 'OCR_BATCH_TOO_LARGE';
    setError(code);
    if (!code) onChange(merged);
  };
  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) add(Array.from(event.target.files));
    event.target.value = '';
  };
  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault(); setOver(false);
    if (!disabled) add(Array.from(event.dataTransfer.files));
  };
  return <div className="space-y-3">
    <button type="button" onClick={() => input.current?.click()} disabled={disabled} onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
      className={`flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 ${over ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}>
      <ImagePlus className="size-8 text-primary" aria-hidden /><span className="text-sm font-medium">{t('trips.ocr.drop')}</span><span className="text-xs text-muted-foreground">{t('trips.ocr.dropHint')}</span>
    </button>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/heif" multiple className="hidden" onChange={pick} disabled={disabled} aria-label={t('trips.ocr.drop')} />
    {error ? <p role="alert" className="text-sm text-destructive">{t(`trips.ocr.error.${error}`)}</p> : null}
    {previews.length ? <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">{previews.map(({ file, url }, index) => <li key={url} className="relative aspect-square overflow-hidden rounded-lg border bg-muted"><img src={url} alt={t('trips.ocr.imageNumber', { n: index + 1 })} className="h-full w-full object-cover" /><Button type="button" variant="ghost" aria-label={t('trips.ocr.removeImage', { name: file.name })} disabled={disabled} className="absolute end-0 top-0 size-11 rounded-lg bg-black/70 p-0 text-white hover:bg-black/90" onClick={() => { setError(''); onChange(files.filter((_, fileIndex) => fileIndex !== index)); }}><X className="size-5" aria-hidden /></Button></li>)}</ul> : null}
    {files.length ? <p className="text-xs text-muted-foreground" role="status">{t('trips.ocr.selectedCount', { n: files.length })}</p> : null}
  </div>;
}

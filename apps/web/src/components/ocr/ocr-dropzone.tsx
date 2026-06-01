import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = /^image\/(png|jpe?g|webp|heic|heif)$/i;

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

export function OcrDropzone({ files, onChange, disabled }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter((f) => ALLOWED_MIME.test(f.type) && f.size <= MAX_BYTES);
    const merged = [...files, ...valid].slice(0, MAX_FILES);
    onChange(merged);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
    if (disabled) return;
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  const remove = (i: number) => onChange(files.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={t('trips.ocr.drop')}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          isOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
        } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <ImagePlus className="h-8 w-8 text-primary" aria-hidden />
        <p className="text-sm font-medium">{t('trips.ocr.drop')}</p>
        <p className="text-xs text-muted-foreground">{t('trips.ocr.dropHint')}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onPick}
        />
      </div>

      {files.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((f, i) => {
            const url = URL.createObjectURL(f);
            return (
              <li key={`${f.name}-${i}`} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                <img
                  src={url}
                  alt={f.name}
                  className="h-full w-full object-cover"
                  onLoad={() => URL.revokeObjectURL(url)}
                />
                {!disabled ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="remove"
                    className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/60 text-white hover:bg-black/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(i);
                    }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <p className="text-xs text-muted-foreground">{t('trips.ocr.selectedCount', { n: files.length })}</p>
      ) : null}
    </div>
  );
}

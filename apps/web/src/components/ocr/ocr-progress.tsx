import { Loader2 } from 'lucide-react';
import { useT } from '@/i18n';

export function OcrProgress() {
  const t = useT();
  return <div role="status" className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
    <Loader2 className="size-5 shrink-0 animate-spin motion-reduce:animate-none text-primary" aria-hidden />
    <span className="text-sm font-medium">{t('trips.ocr.processing')}</span>
  </div>;
}

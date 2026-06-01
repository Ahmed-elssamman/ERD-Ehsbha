import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useT } from '@/i18n';

export function OcrProgress() {
  const t = useT();
  const messages = [
    t('trips.ocr.reading'),
    t('trips.ocr.detecting'),
    t('trips.ocr.parsing'),
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % messages.length), 1500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
      <span className="text-sm font-medium">{messages[idx]}</span>
    </div>
  );
}

import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/i18n';

interface Props {
  warnings: string[];
}

export function OcrWarningList({ warnings }: Props) {
  const { tf } = useI18n();
  if (warnings.length === 0) return null;
  return (
    <ul className="space-y-1.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
      {warnings.map((code) => (
        <li key={code} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{tf(`trips.ocr.warning.${code}`, code)}</span>
        </li>
      ))}
    </ul>
  );
}

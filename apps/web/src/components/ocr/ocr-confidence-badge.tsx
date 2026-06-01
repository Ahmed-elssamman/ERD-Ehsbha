import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';

interface Props {
  confidence: number | null | undefined;
  className?: string;
}

export function OcrConfidenceBadge({ confidence, className }: Props) {
  const t = useT();
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  let variant: 'success' | 'muted' | 'warning' = 'muted';
  if (confidence >= 0.85) variant = 'success';
  else if (confidence < 0.7) variant = 'warning';
  const title = confidence < 0.7 ? t('trips.ocr.lowConfidence') : undefined;
  return (
    <Badge variant={variant} className={className} title={title} aria-label={`Confidence ${pct}%`}>
      {pct}%
    </Badge>
  );
}

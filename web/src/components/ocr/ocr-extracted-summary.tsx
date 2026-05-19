import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import { formatMoney } from '@/lib/format';
import type { OcrExtractResponseDto } from '@/lib/api/ocr.api';
import { OcrConfidenceBadge } from './ocr-confidence-badge';
import { OcrWarningList } from './ocr-warning-list';

interface Props {
  result: OcrExtractResponseDto;
  onApply: () => void;
  onDiscard: () => void;
}

export function OcrExtractedSummary({ result, onApply, onDiscard }: Props) {
  const { t, locale } = useI18n();
  const { parsed, fieldConfidences, platform, platformConfidence, warnings } = result;

  const platformLabel = platform
    ? t('trips.ocr.platformDetected', { name: platform === 'UBER' ? 'Uber' : platform === 'INDRIVE' ? 'inDrive' : platform === 'DIDI' ? 'DiDi' : 'Careem' })
    : t('trips.ocr.platformUnknown');

  const fmtKm = (km: number | null) =>
    km == null ? '—' : `${km.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 })} km`;
  const fmtDur = (sec: number | null) => {
    if (sec == null) return '—';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };
  const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const rows: Array<{ key: string; label: string; value: string; confidence?: number | null }> = [
    { key: 'gross', label: t('trips.field.gross'), value: parsed.grossEgp == null ? '—' : formatMoney(Math.round(parsed.grossEgp * 100), locale), confidence: fieldConfidences.grossEgp },
    { key: 'received', label: t('trips.field.received'), value: parsed.receivedEgp == null ? '—' : formatMoney(Math.round(parsed.receivedEgp * 100), locale), confidence: fieldConfidences.receivedEgp },
    { key: 'commission', label: t('trips.field.commission'), value: parsed.commissionEgp == null ? '—' : formatMoney(Math.round(parsed.commissionEgp * 100), locale), confidence: fieldConfidences.commissionEgp },
    { key: 'totalKm', label: t('trips.field.totalKm'), value: fmtKm(parsed.totalKm), confidence: fieldConfidences.totalKm },
    { key: 'duration', label: t('trips.tripDuration'), value: fmtDur(parsed.durationSec), confidence: fieldConfidences.durationSec },
    { key: 'startedAt', label: t('trips.field.startedAt'), value: fmtDate(parsed.startedAt), confidence: fieldConfidences.startedAt },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{platformLabel}</p>
        {platform ? <OcrConfidenceBadge confidence={platformConfidence} /> : <Badge variant="warning">!</Badge>}
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <h3 className="border-b border-border/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('trips.ocr.summary')}
        </h3>
        <ul className="divide-y divide-border/60">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">{r.label}</span>
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="num-tabular">{r.value}</span>
                <OcrConfidenceBadge confidence={r.confidence ?? null} />
              </span>
            </li>
          ))}
        </ul>
        {parsed.pickup || parsed.destination ? (
          <div className="border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
            {parsed.pickup ? (
              <p>
                <span className="font-semibold text-foreground">↑</span> {parsed.pickup}
              </p>
            ) : null}
            {parsed.destination ? (
              <p>
                <span className="font-semibold text-foreground">↓</span> {parsed.destination}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <OcrWarningList warnings={warnings} />

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDiscard}>{t('trips.ocr.discard')}</Button>
        <Button onClick={onApply}>{t('trips.ocr.applyValues')}</Button>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import type {
  OcrExtractResponseDto,
  OcrParsedTripDto,
  OcrPaymentMethod,
  OcrTripResultDto,
} from '@/lib/api/ocr.api';
import { OcrConfidenceBadge } from './ocr-confidence-badge';
import { OcrWarningList } from './ocr-warning-list';

interface Props {
  result: OcrExtractResponseDto;
  onApply: (edited: OcrExtractResponseDto) => void;
  onDiscard: () => void;
  /** Async-saving state from the parent (bulk-create in flight). When true,
   * the form is locked and the apply button shows a progress label so the
   * driver knows N round-trips are happening. */
  saving?: boolean;
  /** Non-fatal error shown above the action footer (e.g. missing vehicle/app,
   * partial save). The parent owns the i18n string. */
  statusMessage?: { kind: 'error' | 'success'; text: string } | null;
}

interface CardState {
  parsed: OcrParsedTripDto;
  expanded: boolean;
}

/**
 * Renders a scrollable list of trip cards extracted from an Uber summary
 * screen ("ملخص الدخل"). Each card is collapsed by default to a one-line
 * summary; tapping expands an inline edit form with the trip's key fields.
 *
 * Layout principles:
 *   - Single column, vertical stack — works on phone and desktop alike.
 *   - The list container caps at ~60vh and scrolls smoothly so the global
 *     dialog footer remains visible (driver always sees the "Apply all"
 *     button without losing context).
 *   - Each card is keyboard-accessible (button-as-summary, focus rings).
 */
export function OcrMultiTripReview({ result, onApply, onDiscard, saving, statusMessage }: Props) {
  const { t, locale } = useI18n();
  const [cards, setCards] = useState<CardState[]>(() =>
    result.trips.map((t) => ({ parsed: { ...t.parsed }, expanded: false })),
  );

  // Reset internal state when a fresh result comes in (e.g. user discards
  // and re-extracts).
  useEffect(() => {
    setCards(result.trips.map((t) => ({ parsed: { ...t.parsed }, expanded: false })));
  }, [result]);

  const updateCard = useCallback((idx: number, parsed: Partial<OcrParsedTripDto>) => {
    setCards((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, parsed: { ...c.parsed, ...parsed } } : c)),
    );
  }, []);

  const toggle = useCallback((idx: number) => {
    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, expanded: !c.expanded } : c)));
  }, []);

  const handleApplyAll = () => {
    const updatedTrips: OcrTripResultDto[] = cards.map((c, i) => ({
      parsed: c.parsed,
      fieldConfidences: result.trips[i]?.fieldConfidences ?? {},
    }));
    onApply({
      ...result,
      trips: updatedTrips,
      parsed: updatedTrips[0]?.parsed ?? result.parsed,
      fieldConfidences: updatedTrips[0]?.fieldConfidences ?? result.fieldConfidences,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {t('trips.ocr.multiHeader', { n: cards.length })}
          </p>
          <p className="text-xs text-muted-foreground">{t('trips.ocr.reviewSubtitle')}</p>
        </div>
        <Badge variant="muted" title={t('trips.ocr.ocrConfidenceLabel')}>
          {Math.round(result.ocrMeanConfidence * 100)}%
        </Badge>
      </header>

      <div
        className={[
          'max-h-[60vh] space-y-2 overflow-y-auto overscroll-contain rounded-xl border bg-muted/30 p-2 scroll-smooth transition-opacity',
          // Lock editing while the batch-save is in flight so the snapshot
          // we POST'd matches what the user sees on screen.
          saving ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
        // Scroll snap on each card makes mobile flicks feel deliberate without
        // taking over keyboard navigation.
        style={{ scrollSnapType: 'y proximity' }}
        aria-busy={saving || undefined}
      >
        {cards.map((card, i) => (
          <TripCard
            key={i}
            index={i + 1}
            state={card}
            fieldConfidences={result.trips[i]?.fieldConfidences ?? {}}
            locale={locale}
            t={t}
            onToggle={() => toggle(i)}
            onChange={(patch) => updateCard(i, patch)}
          />
        ))}
      </div>

      <OcrWarningList warnings={result.warnings} />

      {statusMessage ? (
        <p
          className={[
            'rounded-lg border p-2 text-xs',
            statusMessage.kind === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-success/40 bg-success/10 text-success',
          ].join(' ')}
          role={statusMessage.kind === 'error' ? 'alert' : 'status'}
        >
          {statusMessage.text}
        </p>
      ) : null}

      <footer className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDiscard} disabled={saving}>
          {t('trips.ocr.discard')}
        </Button>
        <Button onClick={handleApplyAll} loading={saving} disabled={saving}>
          {saving
            ? t('trips.ocr.savingMulti', { n: cards.length })
            : t('trips.ocr.applyAll', { n: cards.length })}
        </Button>
      </footer>
    </motion.div>
  );
}

interface TripCardProps {
  index: number;
  state: CardState;
  fieldConfidences: Record<string, number>;
  locale: 'ar' | 'en';
  t: (key: string, vars?: Record<string, string | number>) => string;
  onToggle: () => void;
  onChange: (patch: Partial<OcrParsedTripDto>) => void;
}

function TripCard({ index, state, fieldConfidences, locale, t, onToggle, onChange }: TripCardProps) {
  const { parsed, expanded } = state;
  const summary = useMemo(() => buildSummary(parsed, t), [parsed, t]);

  return (
    <div
      className="rounded-lg border bg-background shadow-sm"
      style={{ scrollSnapAlign: 'start' }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 p-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Badge variant={expanded ? 'default' : 'muted'} className="shrink-0">
            {t('trips.ocr.multiTripLabel', { n: index })}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-sm">{summary}</span>
        </span>
        <ChevronIcon expanded={expanded} />
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t p-3">
              <Row
                label={t('trips.field.received')}
                confidence={fieldConfidences.receivedEgp}
                unit="EGP"
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={numToString(parsed.receivedEgp)}
                  onChange={(e) => onChange({ receivedEgp: parseNum(e.target.value) })}
                  dir="ltr"
                  className="text-end num-tabular"
                />
              </Row>
              <div className="grid grid-cols-2 gap-2">
                <Row
                  label={t('trips.ocr.fieldPaidKm')}
                  confidence={fieldConfidences.paidKm}
                  unit="km"
                >
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={numToString(parsed.paidKm)}
                    onChange={(e) => onChange({ paidKm: parseNum(e.target.value) })}
                    dir="ltr"
                    className="text-end num-tabular"
                  />
                </Row>
                <DurationRow
                  durationSec={parsed.durationSec}
                  confidence={fieldConfidences.durationSec}
                  t={t}
                  onChange={(durationSec) => onChange({ durationSec })}
                />
              </div>
              <Row
                label={t('trips.field.startedAt')}
                confidence={fieldConfidences.startedAt}
              >
                <Input
                  type="datetime-local"
                  value={toLocalDatetime(parsed.startedAt)}
                  onChange={(e) =>
                    onChange({ startedAt: fromLocalDatetime(e.target.value, parsed.startedAt) })
                  }
                  dir="ltr"
                />
              </Row>
              <Row
                label={t('trips.ocr.fieldPickup')}
                confidence={fieldConfidences.pickup}
              >
                <Input
                  value={parsed.pickup ?? ''}
                  onChange={(e) => onChange({ pickup: e.target.value || null })}
                  dir={locale === 'ar' ? 'rtl' : 'ltr'}
                />
              </Row>
              <Row
                label={t('trips.ocr.fieldDestination')}
                confidence={fieldConfidences.destination}
              >
                <Input
                  value={parsed.destination ?? ''}
                  onChange={(e) => onChange({ destination: e.target.value || null })}
                  dir={locale === 'ar' ? 'rtl' : 'ltr'}
                />
              </Row>
              <Row
                label={t('trips.ocr.fieldPayment')}
                confidence={fieldConfidences.paymentMethod}
              >
                <select
                  value={parsed.paymentMethod}
                  onChange={(e) =>
                    onChange({ paymentMethod: e.target.value as OcrPaymentMethod })
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="cash">{t('trips.ocr.paymentCash')}</option>
                  <option value="card">{t('trips.ocr.paymentCard')}</option>
                  <option value="wallet">{t('trips.ocr.paymentWallet')}</option>
                  <option value="unknown">{t('trips.ocr.paymentUnknown')}</option>
                </select>
              </Row>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

interface RowProps {
  label: string;
  confidence?: number | null;
  unit?: string;
  children: React.ReactNode;
}
function Row({ label, confidence, unit, children }: RowProps) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
          {unit ? <span className="ms-1 text-muted-foreground/70">({unit})</span> : null}
        </span>
        <OcrConfidenceBadge confidence={confidence ?? null} />
      </div>
      {children}
    </label>
  );
}

interface DurationRowProps {
  durationSec: number | null;
  confidence?: number | null;
  t: TripCardProps['t'];
  onChange: (durationSec: number | null) => void;
}
function DurationRow({ durationSec, confidence, t, onChange }: DurationRowProps) {
  const minutes = durationSec == null ? '' : String(Math.floor(durationSec / 60));
  const seconds = durationSec == null ? '' : String(durationSec % 60);
  const set = (m: string, s: string) => {
    if (m === '' && s === '') return onChange(null);
    onChange((Number(m) || 0) * 60 + (Number(s) || 0));
  };
  return (
    <Row
      label={t('trips.tripDuration')}
      confidence={confidence}
      unit={t('trips.ocr.minSecUnit')}
    >
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          value={minutes}
          onChange={(e) => set(e.target.value, seconds)}
          dir="ltr"
          className="w-16 text-end num-tabular"
        />
        <span className="text-xs text-muted-foreground">m</span>
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          max="59"
          value={seconds}
          onChange={(e) => set(minutes, e.target.value)}
          dir="ltr"
          className="w-16 text-end num-tabular"
        />
        <span className="text-xs text-muted-foreground">s</span>
      </div>
    </Row>
  );
}

function buildSummary(p: OcrParsedTripDto, t: TripCardProps['t']): string {
  const parts: string[] = [];
  if (p.receivedEgp != null) parts.push(`${p.receivedEgp.toFixed(2)} EGP`);
  if (p.paidKm != null) parts.push(`${p.paidKm} km`);
  const route = [p.pickup, p.destination].filter(Boolean).join(' → ');
  if (route) parts.push(route);
  return parts.length > 0 ? parts.join(' · ') : t('trips.ocr.multiCollapseHint');
}

function parseNum(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function numToString(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '' : String(v);
}

function toLocalDatetime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetime(local: string, fallback: string | null): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString();
}

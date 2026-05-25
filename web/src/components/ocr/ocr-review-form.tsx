import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import type {
  OcrExtractResponseDto,
  OcrParsedTripDto,
  OcrPaymentMethod,
} from '@/lib/api/ocr.api';
import { OcrConfidenceBadge } from './ocr-confidence-badge';
import { OcrWarningList } from './ocr-warning-list';

interface Props {
  result: OcrExtractResponseDto;
  onApply: (edited: OcrExtractResponseDto) => void;
  onDiscard: () => void;
}

interface FormState {
  grossEgp: string;
  receivedEgp: string;
  commissionEgp: string;
  tipEgp: string;
  waitingFeeEgp: string;
  totalKm: string;
  paidKm: string;
  durationMin: string;
  durationSec: string;
  startedAtLocal: string;
  endedAtLocal: string;
  pickup: string;
  destination: string;
  paymentMethod: OcrPaymentMethod;
  notes: string;
}

/**
 * Full review-and-edit form for OCR-extracted trip values. Every field is
 * editable; per-field confidence badges show the driver which values to
 * scrutinize most carefully. On apply, the edited values are merged back into
 * the original DTO shape so downstream code is unchanged.
 */
export function OcrReviewForm({ result, onApply, onDiscard }: Props) {
  const { t, locale } = useI18n();
  const { parsed, fieldConfidences, platform, platformConfidence, warnings, ocrMeanConfidence } =
    result;

  const initial = useMemo(() => parsedToForm(parsed), [parsed]);
  const [form, setForm] = useState<FormState>(initial);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const platformLabel = platform
    ? t('trips.ocr.platformDetected', {
        name:
          platform === 'UBER'
            ? 'Uber'
            : platform === 'INDRIVE'
            ? 'inDrive'
            : platform === 'DIDI'
            ? 'DiDi'
            : 'Careem',
      })
    : t('trips.ocr.platformUnknown');

  const onSubmit = () => {
    onApply({
      ...result,
      parsed: { ...result.parsed, ...formToParsed(form, result.parsed) },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{platformLabel}</p>
          <p className="text-xs text-muted-foreground">
            {t('trips.ocr.reviewSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {platform ? (
            <OcrConfidenceBadge confidence={platformConfidence} />
          ) : (
            <Badge variant="warning">!</Badge>
          )}
          <Badge variant="muted" title={t('trips.ocr.ocrConfidenceLabel')}>
            {Math.round(ocrMeanConfidence * 100)}%
          </Badge>
        </div>
      </header>

      <section className="space-y-3">
        <Row
          label={t('trips.field.gross')}
          confidence={fieldConfidences.grossEgp}
          unit="EGP"
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.grossEgp}
            onChange={(e) => set('grossEgp', e.target.value)}
            dir="ltr"
            className="text-end num-tabular"
          />
        </Row>
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
            value={form.receivedEgp}
            onChange={(e) => set('receivedEgp', e.target.value)}
            dir="ltr"
            className="text-end num-tabular"
          />
        </Row>
        <Row
          label={t('trips.field.commission')}
          confidence={fieldConfidences.commissionEgp}
          unit="EGP"
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.commissionEgp}
            onChange={(e) => set('commissionEgp', e.target.value)}
            dir="ltr"
            className="text-end num-tabular"
          />
        </Row>
        <Row
          label={t('trips.ocr.fieldTip')}
          confidence={fieldConfidences.tipEgp}
          unit="EGP"
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.tipEgp}
            onChange={(e) => set('tipEgp', e.target.value)}
            dir="ltr"
            className="text-end num-tabular"
          />
        </Row>
        <Row
          label={t('trips.ocr.fieldWaiting')}
          confidence={fieldConfidences.waitingFeeEgp}
          unit="EGP"
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.waitingFeeEgp}
            onChange={(e) => set('waitingFeeEgp', e.target.value)}
            dir="ltr"
            className="text-end num-tabular"
          />
        </Row>
      </section>

      <section className="space-y-3">
        <Row
          label={t('trips.field.totalKm')}
          confidence={fieldConfidences.totalKm}
          unit="km"
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.totalKm}
            onChange={(e) => set('totalKm', e.target.value)}
            dir="ltr"
            className="text-end num-tabular"
          />
        </Row>
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
            value={form.paidKm}
            onChange={(e) => set('paidKm', e.target.value)}
            dir="ltr"
            className="text-end num-tabular"
          />
        </Row>
        <Row
          label={t('trips.tripDuration')}
          confidence={fieldConfidences.durationSec}
          unit={t('trips.ocr.minSecUnit')}
        >
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={form.durationMin}
              onChange={(e) => set('durationMin', e.target.value)}
              dir="ltr"
              className="w-16 text-end num-tabular"
            />
            <span className="text-xs text-muted-foreground">m</span>
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              max="59"
              value={form.durationSec}
              onChange={(e) => set('durationSec', e.target.value)}
              dir="ltr"
              className="w-16 text-end num-tabular"
            />
            <span className="text-xs text-muted-foreground">s</span>
          </div>
        </Row>
      </section>

      <section className="space-y-3">
        <Row
          label={t('trips.field.startedAt')}
          confidence={fieldConfidences.startedAt}
        >
          <Input
            type="datetime-local"
            value={form.startedAtLocal}
            onChange={(e) => set('startedAtLocal', e.target.value)}
            dir="ltr"
          />
        </Row>
        <Row
          label={t('trips.ocr.fieldEndedAt')}
          confidence={fieldConfidences.endedAt}
        >
          <Input
            type="datetime-local"
            value={form.endedAtLocal}
            onChange={(e) => set('endedAtLocal', e.target.value)}
            dir="ltr"
          />
        </Row>
      </section>

      <section className="space-y-3">
        <Row label={t('trips.ocr.fieldPickup')} confidence={fieldConfidences.pickup}>
          <Input
            value={form.pickup}
            onChange={(e) => set('pickup', e.target.value)}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
          />
        </Row>
        <Row
          label={t('trips.ocr.fieldDestination')}
          confidence={fieldConfidences.destination}
        >
          <Input
            value={form.destination}
            onChange={(e) => set('destination', e.target.value)}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
          />
        </Row>
        <Row
          label={t('trips.ocr.fieldPayment')}
          confidence={fieldConfidences.paymentMethod}
        >
          <select
            value={form.paymentMethod}
            onChange={(e) => set('paymentMethod', e.target.value as OcrPaymentMethod)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="cash">{t('trips.ocr.paymentCash')}</option>
            <option value="card">{t('trips.ocr.paymentCard')}</option>
            <option value="wallet">{t('trips.ocr.paymentWallet')}</option>
            <option value="unknown">{t('trips.ocr.paymentUnknown')}</option>
          </select>
        </Row>
      </section>

      <OcrWarningList warnings={warnings} />

      <footer className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDiscard}>
          {t('trips.ocr.discard')}
        </Button>
        <Button onClick={onSubmit}>{t('trips.ocr.applyValues')}</Button>
      </footer>
    </motion.div>
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

function num(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '' : String(v);
}

function parsedToForm(p: OcrParsedTripDto): FormState {
  const m = p.durationSec == null ? 0 : Math.floor(p.durationSec / 60);
  const s = p.durationSec == null ? 0 : p.durationSec % 60;
  return {
    grossEgp: num(p.grossEgp),
    receivedEgp: num(p.receivedEgp),
    commissionEgp: num(p.commissionEgp),
    tipEgp: num(p.tipEgp),
    waitingFeeEgp: num(p.waitingFeeEgp),
    totalKm: num(p.totalKm),
    paidKm: num(p.paidKm),
    durationMin: p.durationSec == null ? '' : String(m),
    durationSec: p.durationSec == null ? '' : String(s),
    startedAtLocal: toLocalDatetime(p.startedAt),
    endedAtLocal: toLocalDatetime(p.endedAt),
    pickup: p.pickup ?? '',
    destination: p.destination ?? '',
    paymentMethod: p.paymentMethod,
    notes: p.notes ?? '',
  };
}

function formToParsed(form: FormState, base: OcrParsedTripDto): Partial<OcrParsedTripDto> {
  const dm = form.durationMin === '' ? null : Number(form.durationMin);
  const ds = form.durationSec === '' ? null : Number(form.durationSec);
  const durationSec =
    dm == null && ds == null ? null : (dm ?? 0) * 60 + (ds ?? 0);
  return {
    grossEgp: parseNum(form.grossEgp),
    receivedEgp: parseNum(form.receivedEgp),
    commissionEgp: parseNum(form.commissionEgp),
    tipEgp: parseNum(form.tipEgp),
    waitingFeeEgp: parseNum(form.waitingFeeEgp),
    totalKm: parseNum(form.totalKm),
    paidKm: parseNum(form.paidKm),
    durationSec,
    startedAt: fromLocalDatetime(form.startedAtLocal, base.startedAt),
    endedAt: fromLocalDatetime(form.endedAtLocal, base.endedAt),
    pickup: form.pickup.trim() || null,
    destination: form.destination.trim() || null,
    paymentMethod: form.paymentMethod,
    notes: form.notes.trim() || base.notes,
  };
}

function parseNum(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toLocalDatetime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  // YYYY-MM-DDTHH:MM (HTML5 datetime-local format, no timezone)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetime(local: string, fallback: string | null): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString();
}

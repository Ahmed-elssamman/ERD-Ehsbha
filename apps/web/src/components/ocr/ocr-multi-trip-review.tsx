import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { OcrCandidateStatus, type OcrConfirmationReceipt } from '@ehsbha/api-contracts';
import { formatLocalDateTime, resolveLocalDateTime, localDateTimeInstants, LocalTimeOccurrence, TripIncomeMode } from '@ehsbha/shared-types';
import { LocalTimeChoice } from '@/components/ui/local-time-choice';
import { parseLocalTimeChoice } from '@/components/ui/local-time-choice.control';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import type { DriverApp, Vehicle } from '@/lib/api/endpoints';
import type { OcrExtractResponseDto, OcrTripResultDto } from '@/lib/api/ocr.api';
import { findDriverAppForPlatform, validateOcrTrip, type OcrSaveOutcome, type OcrSelectedTrip } from '@/lib/ocr/ocr-to-trip';
import { OCR_REVIEW_FIELDS, OCR_PAYMENT_OPTIONS, OCR_INCOME_OPTIONS, OcrFieldKind } from './ocr-review.control';
import { OcrConfidenceBadge } from './ocr-confidence-badge';
import { OcrWarningList } from './ocr-warning-list';
import type { OcrReviewCard as CardState, OcrReviewDraft } from '@/lib/ocr/ocr-review.model';
export type { OcrReviewDraft } from '@/lib/ocr/ocr-review.model';

interface Props {
  result: OcrExtractResponseDto;
  vehicles: Vehicle[];
  apps: DriverApp[];
  loading: boolean;
  lookupError: boolean;
  onRetryLookups: () => void;
  onApply: (selected: OcrSelectedTrip[]) => Promise<OcrSaveOutcome>;
  onDiscard: () => void;
  saving: boolean;
  draft: OcrReviewDraft | null;
  onDraftChange: (draft: OcrReviewDraft) => void;
  confirmations: OcrConfirmationReceipt[];
}

function initializeCard(candidate: OcrTripResultDto, apps: DriverApp[]): CardState {
  const values: Record<string, string> = {};
  for (const control of OCR_REVIEW_FIELDS) {
    const value = candidate.parsed[control.field];
    values[control.field] = control.kind === OcrFieldKind.DateTime && typeof value === 'string'
      ? formatLocalDateTime(value) ?? '' : value == null ? '' : String(value);
  }
  values.paymentMethod = candidate.parsed.paymentMethod;
  const incomeMode = candidate.parsed.grossEgp == null && candidate.parsed.commissionEgp == null ? TripIncomeMode.TakeHome : TripIncomeMode.Breakdown;
  return {
    candidate, values, driverAppId: findDriverAppForPlatform(apps, candidate.evidence?.platform ?? null)?.id ?? '',
    selected: candidate.evidence?.status === OcrCandidateStatus.Ready,
    incomeMode, expanded: false, saved: false, editedFields: [], failureCode: '',
  };
}

function editedCandidate(card: CardState): OcrTripResultDto {
  let parsed = { ...card.candidate.parsed };
  for (const control of OCR_REVIEW_FIELDS) {
    const text = (card.values[control.field] ?? '').trim();
    let value: string | number | null = text || null;
    if (control.kind === OcrFieldKind.DateTime) {
      const original = card.candidate.parsed[control.field];
      value = resolveLocalDateTime(text, parseLocalTimeChoice(card.values[`${control.field}Occurrence`] ?? ''), typeof original === 'string' ? original : null);
    }
    else if (control.kind !== OcrFieldKind.Text) value = text === '' ? null : Number(text);
    parsed = { ...parsed, [control.field]: value };
  }
  const payment = OCR_PAYMENT_OPTIONS.find((option) => option.value === card.values.paymentMethod);
  if (card.incomeMode === TripIncomeMode.TakeHome) parsed = { ...parsed, grossEgp: null, commissionEgp: null, receivedEgp: null };
  else parsed.earningsEgp = null;
  parsed.paymentMethod = payment?.value ?? 'unknown';
  return { ...card.candidate, parsed };
}

export function OcrMultiTripReview({ result, vehicles, apps, loading, lookupError, onRetryLookups, onApply, onDiscard, saving, draft, onDraftChange, confirmations }: Props) {
  const { t, tf, locale } = useI18n();
  const activeVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.isActive), [vehicles]);
  const enabledApps = useMemo(() => apps.filter((app) => app.enabled), [apps]);
  const [vehicleChoice, setVehicleChoice] = useState(draft?.vehicleChoice ?? '');
  const vehicleId = vehicleChoice || (activeVehicles.length === 1 ? activeVehicles[0].id : '');
  const [cards, setCards] = useState(() => draft?.cards ?? result.trips.map((candidate) => initializeCard(candidate, apps)));
  useEffect(() => {
    const acknowledged = new Set(confirmations.map((receipt) => receipt.candidateId));
    setCards((previous) => previous.some((card) => !card.saved && acknowledged.has(card.candidate.evidence?.id ?? ''))
      ? previous.map((card) => acknowledged.has(card.candidate.evidence?.id ?? '') ? { ...card, saved: true, selected: false } : card) : previous);
  }, [confirmations]);
  // Mark the capture as saving before the edited selection can paint with the
  // previous "saved" status. Persistence itself remains asynchronous.
  useLayoutEffect(() => { onDraftChange({ cards, vehicleChoice }); }, [cards, vehicleChoice, onDraftChange]);
  const [status, setStatus] = useState('');
  const views = cards.map((card, index) => {
    const candidate = editedCandidate(card);
    const driverAppId = card.driverAppId || findDriverAppForPlatform(enabledApps, candidate.evidence?.platform ?? null)?.id || '';
    const selection = { candidate, vehicleId, driverAppId };
    return { card, index, selection, validation: validateOcrTrip(selection) };
  });
  const selected = views.filter((view) => view.card.selected && !view.card.saved);
  const ready = views.filter((view) => !view.card.saved && view.card.candidate.evidence?.status === OcrCandidateStatus.Ready && view.validation.input);
  const remaining = views.filter((view) => !view.card.saved);
  const reviewCount = remaining.length - ready.length;
  const canSave = !loading && !lookupError && selected.length > 0 && selected.every((view) => view.validation.input != null);

  const update = (index: number, patch: Partial<CardState>) => {
    setCards((previous) => previous.map((card, cardIndex) => cardIndex === index ? { ...card, ...patch } : card));
  };
  const editField = (index: number, field: string, value: string) => {
    const card = cards[index];
    const values = { ...card.values, [field]: value };
    const editedFields = new Set([...card.editedFields, field]);
    if (field === 'durationSec' && value.trim() && Number(value) > 0 && Number(value) <= 12 * 3600) {
      const start = resolveLocalDateTime(values.startedAt, parseLocalTimeChoice(values.startedAtOccurrence ?? ''), card.candidate.parsed.startedAt);
      if (start) {
        const end = new Date(new Date(start).getTime() + Number(value) * 1000).toISOString();
        values.endedAt = formatLocalDateTime(end) ?? '';
        const first = localDateTimeInstants(values.endedAt)[0];
        values.endedAtOccurrence = first?.slice(0, 19) === end.slice(0, 19) ? LocalTimeOccurrence.Earlier : LocalTimeOccurrence.Later;
        editedFields.add('endedAt');
      }
    }
    update(index, { values, editedFields: [...editedFields] });
  };
  const changeIncomeMode = (index: number, value: string) => {
    const option = OCR_INCOME_OPTIONS.find((item) => item.value === value);
    if (!option) return;
    update(index, { incomeMode: option.value, selected: false });
  };
  const save = async () => {
    if (!canSave || saving) return;
    setStatus('');
    try {
      const outcome = await onApply(selected.map((view) => view.selection));
      const saved = new Set(outcome.savedCandidateIds);
      setCards((previous) => previous.map((card) => saved.has(card.candidate.evidence?.id ?? '') ? { ...card, saved: true, selected: false, failureCode: '' }
        : { ...card, failureCode: outcome.failures?.find((failure) => failure.candidateId === card.candidate.evidence?.id)?.code ?? '' }));
      setStatus(t('trips.ocr.savedPartial', { ok: saved.size, total: selected.length, fail: outcome.failedCandidateIds.length }));
    } catch {
      setStatus(t('trips.ocr.error.UNKNOWN'));
    }
  };

  return (
    <div className="space-y-4" aria-busy={saving}>
      <header className="space-y-1" aria-live="polite">
        <p className="font-semibold">{t('trips.ocr.multiHeader', { n: result.trips.length })}</p>
        <p className="text-sm text-muted-foreground">{t('trips.ocr.readyCounts', { ready: ready.length, review: reviewCount })}</p>
      </header>
      {lookupError ? <div role="alert"><p>{t('trips.ocr.lookupFailed')}</p><Button variant="secondary" onClick={onRetryLookups}>{t('common.retry')}</Button></div> : null}
      {loading ? <p role="status">{t('common.loading')}</p> : null}
      {!loading && (!activeVehicles.length || !enabledApps.length) ? <p role="status">{t('trips.ocr.needVehicleOrApp')}</p> : null}
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t('trips.field.vehicle')}</span>
        <select value={vehicleId} onChange={(event) => setVehicleChoice(event.target.value)} disabled={saving} className="min-h-11 w-full rounded-lg border bg-background px-3">
          <option value="">{t('trips.ocr.chooseVehicle')}</option>
          {activeVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || t(`vehicles.type.${vehicle.type}`)}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">{t('trips.ocr.cairoTimes')}</p>
      <div className="space-y-3">
        {views.filter((view) => !view.card.saved).map(({ card, index, selection, validation }) => {
          const evidence = card.candidate.evidence;
          const candidateId = evidence?.id ?? String(index);
          const fare = selection.candidate.parsed.earningsEgp ?? selection.candidate.parsed.receivedEgp ?? selection.candidate.parsed.grossEgp;
          const amount = fare == null ? t('trips.ocr.amountMissing') : new Intl.NumberFormat(locale, { style: 'currency', currency: 'EGP' }).format(fare);
          const duplicate = evidence?.status === OcrCandidateStatus.Duplicate;
          return (
            <section key={candidateId} className="rounded-xl border bg-background">
              {card.failureCode ? <p role="alert" className="px-3 pt-3 text-sm text-destructive">{tf(`trips.ocr.error.${card.failureCode}`, t('trips.ocr.error.OCR_CONFIRMATION_RETRY'))}</p> : null}
              <div className="flex items-center gap-2 p-3">
                <label className="flex min-h-11 min-w-11 items-center justify-center">
                  <input type="checkbox" checked={card.selected} disabled={saving || !validation.input} onChange={(event) => update(index, { selected: event.target.checked })} aria-label={t('trips.ocr.selectTrip', { n: index + 1 })} className="size-5 accent-primary" />
                </label>
                <button type="button" disabled={saving} onClick={() => update(index, { expanded: !card.expanded })} aria-expanded={card.expanded} aria-controls={`ocr-card-${candidateId}`} className="min-h-11 flex-1 text-start focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="block font-medium">{t('trips.ocr.multiTripLabel', { n: index + 1 })} · {amount}</span>
                  <span className="text-xs text-muted-foreground">{t(duplicate ? 'trips.ocr.possibleDuplicate' : validation.input ? 'trips.ocr.reviewAndSelect' : 'trips.ocr.completeMissing')}</span>
                </button>
              </div>
              {card.expanded ? (
                <div id={`ocr-card-${candidateId}`} className="space-y-4 border-t p-3">
                  <label className="block space-y-1"><span className="text-sm">{t('trips.field.app')}</span>
                    <select value={selection.driverAppId} onChange={(event) => update(index, { driverAppId: event.target.value })} disabled={saving} className="min-h-11 w-full rounded-lg border bg-background px-3">
                      <option value="">{t('trips.ocr.chooseApp')}</option>
                      {enabledApps.map((app) => <option key={app.id} value={app.id}>{app.customName ?? app.appSource?.name}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-1"><span className="text-sm">{t('trips.finance.mode')}</span>
                    <select aria-label={t('trips.finance.mode')} value={card.incomeMode} onChange={(event) => changeIncomeMode(index, event.target.value)} disabled={saving} className="min-h-11 w-full rounded-lg border bg-background px-3">
                      {OCR_INCOME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
                    </select>
                  </label>
                  {card.incomeMode === TripIncomeMode.TakeHome ? <p className="text-sm text-muted-foreground">{t('trips.finance.takeHomeHint')}</p> : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {OCR_REVIEW_FIELDS.map((control) => {
                      if (control.incomeMode && control.incomeMode !== card.incomeMode) return null;
                      const numeric = control.kind === OcrFieldKind.Money || control.kind === OcrFieldKind.Distance || control.kind === OcrFieldKind.Duration;
                      const originalTime = card.candidate.parsed[control.field];
                      return <div key={control.field} className="space-y-1"><label className="block space-y-1">
                        <span className="flex items-center justify-between gap-2 text-sm">{t(control.field === 'tipEgp' && card.incomeMode === TripIncomeMode.TakeHome ? 'trips.finance.includedTip' : control.labelKey)}{card.editedFields.includes(control.field) ? <span className="text-xs text-muted-foreground">{t('trips.ocr.editedValue')}</span> : <OcrConfidenceBadge confidence={card.candidate.fieldConfidences[control.field] ?? null} />}</span>
                        <Input value={card.values[control.field] ?? ''} type={control.kind === OcrFieldKind.DateTime ? 'datetime-local' : numeric ? 'number' : 'text'} inputMode={numeric ? 'decimal' : 'text'} step={numeric ? 'any' : 1} min={numeric ? 0 : ''} disabled={saving} dir={numeric || control.kind === OcrFieldKind.DateTime ? 'ltr' : 'auto'}
                          onChange={(event) => editField(index, control.field, event.target.value)} className="min-h-11" />
                      </label>
                        {control.kind === OcrFieldKind.DateTime ? <LocalTimeChoice value={card.values[control.field] ?? ''}
                          choice={parseLocalTimeChoice(card.values[`${control.field}Occurrence`] ?? '')} label={t(control.labelKey)} disabled={saving}
                          original={typeof originalTime === 'string' ? originalTime : null}
                          onChange={(choice) => editField(index, `${control.field}Occurrence`, choice)} /> : null}
                      </div>;
                    })}
                    <label className="block space-y-1"><span className="text-sm">{t('trips.ocr.fieldPayment')}</span><select value={card.values.paymentMethod} onChange={(event) => update(index, { values: { ...card.values, paymentMethod: event.target.value } })} disabled={saving} className="min-h-11 w-full rounded-lg border bg-background px-3">{OCR_PAYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}</select></label>
                  </div>
                  {validation.issueKeys.length ? <ul className="space-y-1 text-sm text-destructive" aria-live="polite">{validation.issueKeys.map((key) => <li key={key}>{t(`trips.ocr.validation.${key}`)}</li>)}</ul> : null}
                  <OcrWarningList warnings={evidence?.warnings ?? []} />
                  <details><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('trips.ocr.rawText')}</summary><pre dir="auto" className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-sm">{evidence?.rawText}</pre></details>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      {status ? <p role="status" className="rounded-lg border p-3 text-sm">{status}</p> : null}
      {confirmations.length ? <p className="text-sm text-muted-foreground" role="status">{t('trips.ocr.previouslySaved', { n: confirmations.length })}</p> : null}
      {confirmations.some((receipt) => receipt.deleted) ? <p className="text-sm">{t('trips.ocr.previouslyDeleted')}</p> : null}
      <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background py-3">
        <Button variant="ghost" onClick={onDiscard} disabled={saving} className="min-h-11">{t('common.close')}</Button>
        <Button onClick={save} loading={saving} disabled={!canSave || saving} className="min-h-11">{t('trips.ocr.saveSelected', { n: selected.length })}</Button>
      </footer>
    </div>
  );
}

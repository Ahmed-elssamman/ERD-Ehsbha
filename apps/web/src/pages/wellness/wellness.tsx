import { useState } from 'react';
import { Link } from 'react-router-dom';
import { businessDateKey } from '@ehsbha/shared-types';
import { useI18n } from '@/i18n';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/dialog';
import { formatDate, formatNumber } from '@/lib/format';
import { useWellness } from '@/lib/wellness/use-wellness';
import { useBusinessDate } from '@/hooks/use-business-date';
import {
  ANSWERS, answerChecklist, ChecklistAnswer, FREQUENCIES, HOURS, REMINDERS,
  startWellness, WELLNESS_SOURCES, wellnessWeek, type ReminderKind,
} from '@/lib/wellness/wellness.control';

export function WellnessPage() {
  const { t, locale } = useI18n();
  const { state, error, pending, saved, reload, update, reset: resetStorage } = useWellness();
  const [confirmReset, setConfirmReset] = useState(false);
  const now = Date.now();
  const today = useBusinessDate();
  const day = state?.days.find((item) => item.date === today);
  const week = wellnessWeek(now);
  async function setAnswer(kind: ReminderKind, answer: ChecklistAnswer) {
    await update((current) => {
      if (businessDateKey(new Date()) !== today) throw new Error('WELLNESS_DAY_CHANGED');
      return answerChecklist(current, kind, answer, Date.now());
    });
  }
  async function reset() {
    const completed = await resetStorage();
    if (completed) setConfirmReset(false);
  }
  return <div className="space-y-6">
    <PageHeader title={t('wellness.title')} subtitle={t('wellness.subtitle')} />
    <details className="rounded-lg border p-4 text-sm text-muted-foreground"><summary className="min-h-11 cursor-pointer content-center font-medium">{t('wellness.about')}</summary><p className="mt-3">{t('wellness.privacy')}</p><p className="mt-3">{t('wellness.delivery')}</p></details>
    {error && <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 p-4"><p>{t('wellness.storageError')}</p><Button variant="outline" onClick={() => { void reload(); }}>{t('common.retry')}</Button></div>}
    {!state && !error && <Skeleton className="h-64 w-full" />}
    {state && <>
      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6" aria-labelledby="wellness-timer">
        <h2 id="wellness-timer" className="text-lg font-semibold">{t('wellness.timerTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('wellness.deliveryShort')}</p>
        <p className="text-sm">{state.startedAt === null ? t('wellness.paused') : t('wellness.running', { time: formatDate(new Date(state.startedAt).toISOString(), locale, { hour: 'numeric', minute: '2-digit' }) })}</p>
        <div className="flex flex-wrap items-center gap-3">
          {state.startedAt === null ? <Button disabled={pending || error || !state.reminders.some((item) => item.enabled)} onClick={() => { void update((current) => startWellness(current, Date.now())); }}>{t('wellness.start')}</Button>
            : <Button variant="outline" disabled={pending} onClick={() => { void update((current) => ({ ...current, startedAt: null })); }}>{t('wellness.pause')}</Button>}
          <Link className="inline-flex min-h-11 items-center text-sm text-foreground underline" to="/work-sessions">{t('wellness.workTimeLink')}</Link>
        </div>
        <details className="text-sm text-muted-foreground"><summary className="min-h-11 cursor-pointer content-center">{t('wellness.timerAbout')}</summary><p className="mt-2">{t('wellness.timerLimits')}</p></details>
      </section>
      <section className="space-y-4" aria-labelledby="wellness-settings">
        <h2 id="wellness-settings" className="text-lg font-semibold">{t('wellness.settings')}</h2>
        <p className="text-sm text-muted-foreground">{t('wellness.frequencyHint')}</p>
        <div className="divide-y rounded-xl border bg-card">
          {state.reminders.map((item) => <div key={item.kind} className="space-y-3 p-4">
            <label className="flex min-h-11 items-center gap-3 font-medium"><input type="checkbox" className="h-5 w-5 accent-primary" checked={item.enabled} disabled={pending}
              onChange={(event) => { const enabled = event.target.checked; void update((current) => ({ ...current, reminders: current.reminders.map((setting) => setting.kind !== item.kind ? setting : { ...setting, enabled, dueAt: enabled && current.startedAt !== null ? Date.now() + setting.minutes * 60_000 : null }) })); }} />{t(`wellness.kinds.${item.kind}`)}</label>
            <details className="text-sm text-muted-foreground"><summary className="min-h-11 cursor-pointer content-center">{t('wellness.guidanceTitle')}</summary><p className="mt-2">{t(`wellness.guidance.${item.kind}`)}</p></details>
            {item.skippedDate === today && <div className="flex flex-wrap items-center gap-2 text-sm"><span>{t('wellness.skippedToday')}</span><Button variant="outline" disabled={pending} onClick={() => { void update((current) => ({ ...current, reminders: current.reminders.map((setting) => setting.kind !== item.kind ? setting : { ...setting, skippedDate: null, dueAt: current.startedAt === null ? null : Date.now() + setting.minutes * 60_000 }) })); }}>{t('wellness.resumeToday')}</Button></div>}
            <div className="flex flex-wrap items-center gap-2"><label htmlFor={`frequency-${item.kind}`} className="text-sm">{t('wellness.every')}</label>
              <Select id={`frequency-${item.kind}`} className="w-auto min-w-28" value={item.minutes} disabled={pending} onChange={(event) => { const minutes = Number(event.target.value); void update((current) => ({ ...current, reminders: current.reminders.map((setting) => setting.kind !== item.kind ? setting : { ...setting, minutes, dueAt: setting.enabled && current.startedAt !== null ? Date.now() + minutes * 60_000 : null }) })); }}>
                {FREQUENCIES.map((minutes) => <option key={minutes} value={minutes}>{t('wellness.minutes', { count: formatNumber(minutes, locale) })}</option>)}
              </Select>
            </div>
          </div>)}
        </div>
        <fieldset className="space-y-3 rounded-xl border p-4"><legend className="px-1 font-medium">{t('wellness.quietTitle')}</legend>
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-primary" checked={state.quietEnabled} disabled={pending} onChange={(event) => { const quietEnabled = event.target.checked; void update((current) => ({ ...current, quietEnabled })); }} />{t('wellness.quietEnabled')}</label>
          <div className="flex flex-wrap gap-4">
            <label className="space-y-1"><span className="block text-sm">{t('wellness.quietStart')}</span><Select value={state.quietStart} disabled={pending} onChange={(event) => { const quietStart = Number(event.target.value); void update((current) => ({ ...current, quietStart })); }}>{HOURS.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}</Select></label>
            <label className="space-y-1"><span className="block text-sm">{t('wellness.quietEnd')}</span><Select value={state.quietEnd} disabled={pending} onChange={(event) => { const quietEnd = Number(event.target.value); void update((current) => ({ ...current, quietEnd })); }}>{HOURS.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}</Select></label>
          </div><p className="text-xs text-muted-foreground">{t('wellness.quietHint')}</p>
        </fieldset>
        {saved && <p role="status" className="text-sm text-foreground">{t('wellness.saved')}</p>}
      </section>
      <section className="space-y-4" aria-labelledby="wellness-checklist">
        <h2 id="wellness-checklist" className="text-lg font-semibold">{t('wellness.checklist')}</h2>
        <p className="text-sm text-muted-foreground">{t('wellness.checklistHint')} · {formatDate(`${today}T12:00:00Z`, locale)}</p>
        <div className="divide-y rounded-xl border bg-card">{REMINDERS.map(({ kind }) => <label key={kind} className="flex flex-wrap items-center justify-between gap-3 p-4"><span className="text-sm">{t(`wellness.checks.${kind}`)}</span><Select aria-label={t(`wellness.checks.${kind}`)} className="w-auto min-w-36" value={day?.answers[kind] ?? ChecklistAnswer.Unrecorded} disabled={pending} onChange={(event) => { const answer = ANSWERS.find((value) => value === event.target.value); if (answer) void setAnswer(kind, answer); }}>{ANSWERS.map((answer) => <option key={answer} value={answer}>{t(`wellness.answers.${answer}`)}</option>)}</Select></label>)}</div>
      </section>
      <section className="space-y-4" aria-labelledby="wellness-week">
        <h2 id="wellness-week" className="text-lg font-semibold">{t('wellness.week')}</h2>
        <p className="text-sm text-muted-foreground">{t('wellness.weekHint')}</p>
        <ul className="divide-y rounded-xl border bg-card">{week.map((date) => {
          const entry = state.days.find((item) => item.date === date);
          const done = Object.values(entry?.answers ?? {}).filter((answer) => answer === ChecklistAnswer.Done).length;
          const skipped = Object.values(entry?.answers ?? {}).filter((answer) => answer === ChecklistAnswer.Skipped).length;
          return <li key={date} className="flex flex-wrap justify-between gap-2 p-4 text-sm"><span>{formatDate(`${date}T12:00:00Z`, locale, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span>{t('wellness.daySummary', { done: formatNumber(done, locale), skipped: formatNumber(skipped, locale), missing: formatNumber(5 - done - skipped, locale) })}</span></li>;
        })}</ul>
      </section>
      <section className="space-y-2 text-sm"><h2 className="font-semibold">{t('wellness.sourcesTitle')}</h2><p className="text-muted-foreground">{t('wellness.sourcesHint')}</p><ul className="space-y-2">{WELLNESS_SOURCES.map((source) => <li key={source.key}><a className="inline-flex min-h-11 items-center text-foreground underline" href={source.href} target="_blank" rel="noreferrer">{t(`wellness.sources.${source.key}`)}</a></li>)}</ul></section>
    </>}
      <Button variant="outline" onClick={() => setConfirmReset(true)}>{t('wellness.reset')}</Button>
      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title={t('wellness.reset')}><p className="text-sm">{t('wellness.resetHint')}</p><div className="flex flex-wrap gap-2"><Button disabled={pending} onClick={() => { void reset(); }}>{t('wellness.reset')}</Button><Button variant="outline" onClick={() => setConfirmReset(false)}>{t('common.cancel')}</Button></div></Dialog>
  </div>;
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/stores/auth.store';
import { recordDraftAccountGeneration, requireRecordDraftAccount } from '@/lib/record-drafts/record-draft-store';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { actOnReminder, dueReminder, WellnessAction, WELLNESS_POLL_MS, type ReminderKind } from '@/lib/wellness/wellness.control';
import { changeWellness, readWellness, WELLNESS_CHANGED } from '@/lib/wellness/wellness-store';

interface VisibleReminder { kind: ReminderKind; generation: string; shownAt: number }

export function WellnessReminder() {
  const accountId = useAuth((state) => state.user?.id ?? null);
  const { t } = useI18n();
  const [reminder, setReminder] = useState<VisibleReminder | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let alive = true;
    let reading = false;
    const check = async () => {
      if (!accountId || reading || document.visibilityState !== 'visible') return;
      reading = true;
      try {
        const state = await readWellness(accountId);
        if (!alive) return;
        if (reminder) {
          const setting = state.reminders.find((item) => item.kind === reminder.kind);
          if (state.generation !== reminder.generation || state.startedAt === null || !setting?.enabled || state.lastShownAt !== reminder.shownAt) setReminder(null);
          return;
        }
        if (!dueReminder(state, Date.now())) return;
        let claimed: VisibleReminder | null = null;
        await changeWellness(accountId, (current) => {
          const now = Date.now();
          const due = dueReminder(current, now);
          if (!due || document.visibilityState !== 'visible') return current;
          claimed = { kind: due.kind, generation: current.generation, shownAt: now };
          return { ...current, lastShownAt: now, reminders: current.reminders.map((item) => item.kind !== due.kind ? item : { ...item, dueAt: now + item.minutes * 60_000 }) };
        });
        if (alive) { setReminder(claimed); setError(false); }
      } catch { if (alive && reminder) setError(true); }
      finally { reading = false; }
    };
    const refresh = () => { void check(); };
    refresh();
    const timer = window.setInterval(refresh, WELLNESS_POLL_MS);
    const accountChanged = (event: StorageEvent) => {
      if (event.key !== 'ehsbha.auth' || !accountId) return;
      try { requireRecordDraftAccount(accountId, recordDraftAccountGeneration()); refresh(); }
      catch { setReminder(null); }
    };
    window.addEventListener('storage', accountChanged);
    window.addEventListener(WELLNESS_CHANGED, refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('storage', accountChanged); window.removeEventListener(WELLNESS_CHANGED, refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [accountId, reminder]);
  async function act(action: WellnessAction) {
    if (!accountId || !reminder || pending) return;
    setPending(true);
    try {
      await changeWellness(accountId, (state) => {
        if (state.generation !== reminder.generation) throw new Error('WELLNESS_CHANGED');
        return actOnReminder(state, reminder.kind, action, Date.now());
      });
      setReminder(null); setError(false);
    } catch { setError(true); }
    finally { setPending(false); }
  }
  if (!reminder) return null;
  return <section className="mb-5 rounded-xl border border-primary/30 bg-card p-4" aria-label={t('wellness.reminder')}>
    <div role="status"><p className="font-semibold">{t(`wellness.kinds.${reminder.kind}`)}</p><p className="mt-1 text-sm">{t(`wellness.guidance.${reminder.kind}`)}</p></div>
    <p className="mt-2 text-xs text-muted-foreground">{t('wellness.safeStop')}</p>
    {error && <p role="alert" className="mt-2 text-sm text-foreground">{t('wellness.storageError')}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <Button disabled={pending} onClick={() => { void act(WellnessAction.Complete); }}>{t('wellness.dismiss')}</Button>
      <Button variant="outline" disabled={pending} onClick={() => { void act(WellnessAction.Snooze); }}>{t('wellness.snooze')}</Button>
      <Button variant="outline" disabled={pending} onClick={() => { void act(WellnessAction.Skip); }}>{t('wellness.skip')}</Button>
      <Button variant="ghost" disabled={pending} onClick={() => { void act(WellnessAction.Disable); }}>{t('wellness.disable')}</Button>
      <Link to="/wellness" className="inline-flex min-h-11 items-center px-3 text-sm text-foreground underline">{t('wellness.settings')}</Link>
    </div>
  </section>;
}

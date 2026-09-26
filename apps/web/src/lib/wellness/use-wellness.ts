import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/stores/auth.store';
import { recordDraftAccountGeneration, requireRecordDraftAccount } from '@/lib/record-drafts/record-draft-store';
import { WELLNESS_POLL_MS, type WellnessState } from './wellness.control';
import { changeWellness, clearWellness, readWellness, WELLNESS_CHANGED } from './wellness-store';

export function useWellness() {
  const accountId = useAuth((state) => state.user?.id ?? null);
  const [state, setState] = useState<WellnessState | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const reload = useCallback(async () => {
    if (!accountId) return;
    try { const value = await readWellness(accountId); setState(value); setError(false); }
    catch { setError(true); }
  }, [accountId]);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (!accountId || document.visibilityState !== 'visible') return;
      void readWellness(accountId).then((value) => { if (alive) { setState(value); setError(false); } })
        .catch(() => { if (alive) setError(true); });
    };
    refresh();
    const timer = window.setInterval(refresh, WELLNESS_POLL_MS);
    const accountChanged = (event: StorageEvent) => {
      if (event.key !== 'ehsbha.auth' || !accountId) return;
      try { requireRecordDraftAccount(accountId, recordDraftAccountGeneration()); refresh(); }
      catch { setState(null); setError(true); setSaved(false); }
    };
    window.addEventListener('storage', accountChanged);
    window.addEventListener(WELLNESS_CHANGED, refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('storage', accountChanged); window.removeEventListener(WELLNESS_CHANGED, refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [accountId]);
  async function update(change: (current: WellnessState) => WellnessState): Promise<boolean> {
    if (!accountId || pending) return false;
    setPending(true); setSaved(false);
    try { setState(await changeWellness(accountId, change)); setError(false); setSaved(true); return true; }
    catch { setError(true); return false; }
    finally { setPending(false); }
  }
  async function reset(): Promise<boolean> {
    if (!accountId || pending) return false;
    setPending(true); setSaved(false);
    try { await clearWellness(accountId, true); await reload(); setSaved(true); return true; }
    catch { setError(true); return false; }
    finally { setPending(false); }
  }
  return { state, accountId, error, pending, saved, reload, update, reset };
}

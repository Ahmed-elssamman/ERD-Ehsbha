import { useState, useSyncExternalStore } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { RecordDraftIssue, RecordDraftSaveState, RecordDraftStatus } from '@/lib/record-drafts/record-draft.model';
import type { RecordDraftSession } from '@/lib/record-drafts/record-draft-session';

interface Props { session: RecordDraftSession; busy: boolean; onDiscard: () => void }
export function RecordDraftNotice({ session, busy, onDiscard }: Props) {
  const { t } = useI18n();
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  async function discard() {
    setDiscarding(true);
    if (await session.complete()) onDiscard();
    setDiscarding(false);
  }
  return <div className="space-y-2 rounded-lg border p-3 text-sm" data-testid="record-draft-notice">
    <p role={state.issue ? 'alert' : 'status'}>{t(state.issue ? `recordDrafts.${state.issue}` : `recordDrafts.${state.saveState}`)}</p>
    {state.status === RecordDraftStatus.Pending ? <p>{t('recordDrafts.pending')}</p> : null}
    {state.status === RecordDraftStatus.Completed ? <p>{t('recordDrafts.completed')}</p> : null}
    {state.issue === RecordDraftIssue.Conflict ? <Button type="button" variant="outline" onClick={onDiscard}>{t('recordDrafts.closeCopy')}</Button> : null}
    {state.saveState === RecordDraftSaveState.Failed ? <Button type="button" variant="outline" disabled={busy || discarding} onClick={() => void session.flush()}>{t('recordDrafts.retryStorage')}</Button> : null}
    {state.status !== RecordDraftStatus.Completed ? <>
      <p className="text-xs text-muted-foreground">{t('recordDrafts.privacy')}</p>
      {confirming ? <div className="space-y-2"><p>{t(state.status === RecordDraftStatus.Pending ? 'recordDrafts.confirmPendingDiscard' : 'recordDrafts.confirmDiscard')}</p>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="destructive" disabled={busy} loading={discarding} onClick={() => void discard()}>{t('recordDrafts.discardConfirm')}</Button>
          <Button type="button" variant="ghost" disabled={discarding} onClick={() => setConfirming(false)}>{t('common.cancel')}</Button></div></div>
        : <Button type="button" variant="ghost" disabled={busy || !!state.issue} onClick={() => setConfirming(true)}>{t('recordDrafts.discard')}</Button>}
    </> : null}
  </div>;
}

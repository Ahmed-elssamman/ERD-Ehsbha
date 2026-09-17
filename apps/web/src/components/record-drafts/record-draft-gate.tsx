import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/stores/auth.store';
import { useI18n } from '@/i18n';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RecordDraftSession } from '@/lib/record-drafts/record-draft-session';
import { discardUnreadableRecordDraft, readRecordDraft } from '@/lib/record-drafts/record-draft-store';
import { RecordDraftError, RecordDraftIssue, RecordDraftStatus, type RecordDraft, type RecordDraftKind } from '@/lib/record-drafts/record-draft.model';

interface Props {
  kind: RecordDraftKind; scope: string; context: string; linkId: string | null;
  resumeOnly?: boolean;
  inline?: boolean;
  validate: (draft: RecordDraft) => void; onClose: () => void; children: (session: RecordDraftSession) => ReactNode;
}
export function RecordDraftGate({ kind, scope, context, linkId, validate, onClose, children, resumeOnly = false, inline = false }: Props) {
  const { t } = useI18n();
  const accountId = useAuth((state) => state.user?.id ?? '');
  const [session, setSession] = useState<RecordDraftSession | null>(null);
  const [issue, setIssue] = useState<RecordDraftIssue | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [initial] = useState({ kind, scope, context, linkId, validate, resumeOnly });
  useEffect(() => {
    let active = true;
    void readRecordDraft(accountId, initial.kind, initial.scope).then((stored) => {
      if (initial.resumeOnly && (!stored || stored.status === RecordDraftStatus.Completed)) {
        if (active) { setIssue(null); setCompleted(true); } return;
      }
      const draft: RecordDraft = stored && stored.status !== RecordDraftStatus.Completed ? stored : {
        schemaVersion: 1, generation: stored?.generation ?? crypto.randomUUID(), accountId, kind: initial.kind, scope: initial.scope, revision: stored?.revision ?? 0, status: RecordDraftStatus.Editing,
        context: initial.context, fields: null, linkId: initial.linkId, pending: null, updatedAt: Date.now(),
      };
      initial.validate(draft);
      if (active && useAuth.getState().user?.id === accountId) { setIssue(null); setSession(new RecordDraftSession(draft)); }
    }).catch((error) => { if (active) setIssue(error instanceof RecordDraftError ? error.issue : RecordDraftIssue.Storage); });
    return () => { active = false; };
  }, [accountId, initial, attempt]);
  async function discardUnreadable() {
    setDiscarding(true);
    try { await discardUnreadableRecordDraft(accountId, kind, scope, validate); onClose(); }
    catch (error) { setIssue(error instanceof RecordDraftError ? error.issue : RecordDraftIssue.Storage); }
    setDiscarding(false);
  }
  if (session) return children(session);
  const content = <>
    {completed ? <p role="status">{t('recordDrafts.noLongerPending')}</p> : issue ? <div role="alert" className="space-y-3"><p>{t(`recordDrafts.${issue}`)}</p><Button onClick={() => setAttempt((value) => value + 1)}>{t('common.retry')}</Button>
      {issue === RecordDraftIssue.Invalid ? confirmDiscard ? <div className="space-y-3"><p>{t('recordDrafts.confirmUnreadableDiscard')}</p>
        <Button variant="destructive" loading={discarding} onClick={() => void discardUnreadable()}>{t('recordDrafts.discardConfirm')}</Button></div>
        : <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>{t('recordDrafts.discard')}</Button> : null}
    </div> : <p role="status">{t('common.loading')}</p>}
  </>;
  if (inline) return <div className="space-y-3">{content}<Button variant="ghost" onClick={onClose}>{t('common.close')}</Button></div>;
  return <Dialog open title={t('recordDrafts.title')} onClose={onClose} footer={<Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>}>{content}</Dialog>;
}

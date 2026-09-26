import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { RecordDraftSaveState, RecordDraftStatus } from '@/lib/record-drafts/record-draft.model';
import type { RecordDraftSession } from '@/lib/record-drafts/record-draft-session';

const alwaysPersist = () => true;
export function useRecordDraftForm<T extends FieldValues>(session: RecordDraftSession, form: UseFormReturn<T>, linkId: string | null, shouldPersist = alwaysPersist) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const { watch, getValues } = form;
  const previousLink = useRef(linkId);
  useLayoutEffect(() => {
    if (previousLink.current !== linkId) session.change(JSON.stringify(getValues()), linkId);
    previousLink.current = linkId;
    const subscription = watch(() => { if (shouldPersist()) session.change(JSON.stringify(getValues()), linkId); });
    return () => subscription.unsubscribe();
  }, [session, watch, getValues, linkId, shouldPersist]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      const latest = session.getSnapshot();
      if (latest.saveState === RecordDraftSaveState.Saving || latest.saveState === RecordDraftSaveState.Failed) event.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [session]);
  return { locked: state.status !== RecordDraftStatus.Editing || state.issue !== null, pending: state.status === RecordDraftStatus.Pending };
}

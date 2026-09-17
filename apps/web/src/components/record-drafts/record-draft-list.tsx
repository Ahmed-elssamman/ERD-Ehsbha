import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/stores/auth.store';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { listRecordDrafts } from '@/lib/record-drafts/record-draft-store';
import { RecordDraftStatus, type RecordDraftSummary, type RecordDraftKind } from '@/lib/record-drafts/record-draft.model';
import { RECORD_DRAFT_DATE_FORMAT } from './record-draft.control';

interface Props { kind: RecordDraftKind; render: (draft: RecordDraftSummary, close: () => void) => ReactNode }
export function RecordDraftList({ kind, render }: Props) {
  const { t, locale } = useI18n();
  const accountId = useAuth((state) => state.user?.id ?? '');
  const [selected, setSelected] = useState<RecordDraftSummary | null>(null);
  const drafts = useQuery({ queryKey: ['record-drafts', kind], queryFn: () => listRecordDrafts(accountId, kind),
    enabled: !!accountId, staleTime: 0, refetchOnWindowFocus: true, retry: false });
  function close() { setSelected(null); void drafts.refetch(); }
  if (selected) return render(selected, close);
  if (drafts.isError) return <div role="alert" className="space-y-2 text-sm"><p>{t('recordDrafts.listFailed')}</p>
    <Button variant="outline" onClick={() => void drafts.refetch()}>{t('common.retry')}</Button></div>;
  if (!drafts.data?.length) return null;
  return <section aria-label={t('recordDrafts.title')} className="space-y-2 rounded-xl border p-3">
    <h2 className="font-medium">{t('recordDrafts.title')}</h2>
    {drafts.data.map((draft) => <div key={draft.scope} className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p>{t(draft.status === null ? 'recordDrafts.unreadable' : draft.status === RecordDraftStatus.Pending ? 'recordDrafts.waiting' : 'recordDrafts.unfinished')}
        {draft.updatedAt ? ` · ${formatDate(new Date(draft.updatedAt), locale, RECORD_DRAFT_DATE_FORMAT)}` : ''}</p>
      <Button variant="outline" className="min-h-11" onClick={() => setSelected(draft)}>{t('recordDrafts.resume')}</Button>
    </div>)}
  </section>;
}

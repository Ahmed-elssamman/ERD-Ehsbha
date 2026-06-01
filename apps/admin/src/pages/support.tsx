import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { supportApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TicketStatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BulkActionBar } from '@/components/ui/bulk-action-bar';
import { BulkConfirmDialog } from '@/components/ui/bulk-confirm-dialog';
import { Can } from '@/components/auth/can';
import { toast } from '@/components/ui/toast';
import { readApiError } from '@/lib/api-error';
import { useI18n } from '@/i18n/provider';

interface Row {
  id: string;
  userPhone: string;
  category: string;
  subject: string;
  body: string;
  status: 'OPEN' | 'IN_REVIEW' | 'PLANNED' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
}

const STATUS_OPTIONS = ['ALL', 'OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED'] as const;
type BulkAction = 'close' | 'delete';

export function SupportPage() {
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'support', { status }],
    queryFn: () => supportApi.list({ status: status === 'ALL' ? undefined : status, limit: 100 }) as Promise<{ items: Row[] }>,
  });
  const { data: summary } = useQuery({
    queryKey: ['admin', 'support', 'summary'],
    queryFn: () => supportApi.summary() as Promise<{ byStatus: { open: number; inReview: number; planned: number; resolved: number; closed: number } }>,
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, reason }: { action: BulkAction; reason: string }) =>
      action === 'close'
        ? supportApi.bulkTransition(selected, 'CLOSED', reason)
        : supportApi.bulkDelete(selected, reason),
    onSuccess: (resp: { affected: number }) => {
      toast.success(t('common.completed'), `${resp.affected} ${t('common.affected')}`);
      setSelected([]);
      setPendingAction(null);
      qc.invalidateQueries({ queryKey: ['admin', 'support'] });
    },
    onError: (e) => { const er = readApiError(e); toast.error(er.code, er.message); },
  });

  const columns: Column<Row>[] = [
    { key: 'subject', header: t('support.subject'), cell: (r) => <div><div className="font-medium">{r.subject}</div><div className="line-clamp-1 text-xs text-muted-foreground">{r.body}</div></div>, sortValue: (r) => r.subject },
    { key: 'category', header: t('support.category'), cell: (r) => <Badge variant="outline">{r.category.replace(/_/g, ' ')}</Badge>, sortValue: (r) => r.category },
    { key: 'status', header: t('common.status'), cell: (r) => <TicketStatusBadge status={r.status} />, sortValue: (r) => r.status },
    { key: 'user', header: t('support.from'), cell: (r) => <span className="font-mono text-xs">{r.userPhone}</span>, sortValue: (r) => r.userPhone },
    { key: 'created', header: t('common.createdAt'), cell: (r) => <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>, sortValue: (r) => r.createdAt },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t('support.title')} description={t('support.subtitle')} />

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: t('support.open'), value: summary.byStatus.open, k: 'OPEN' },
            { label: t('support.inReview'), value: summary.byStatus.inReview, k: 'IN_REVIEW' },
            { label: t('support.planned'), value: summary.byStatus.planned, k: 'PLANNED' },
            { label: t('support.resolved'), value: summary.byStatus.resolved, k: 'RESOLVED' },
            { label: t('support.closed'), value: summary.byStatus.closed, k: 'CLOSED' },
          ].map((m) => (
            <button
              key={m.k}
              onClick={() => setStatus(m.k as (typeof STATUS_OPTIONS)[number])}
              className={`rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 ${status === m.k ? 'border-primary' : ''}`}
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</div>
              <div className="mt-1 text-2xl font-semibold">{m.value}</div>
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        {STATUS_OPTIONS.map((o) => (
          <button
            key={o}
            onClick={() => setStatus(o)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${status === o ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
          >
            {o.replace('_', ' ')}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/support/${r.id}`)}
        emptyTitle={t('support.noTickets')}
        pageSize={15}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
      />

      <BulkActionBar count={selected.length} onClear={() => setSelected([])}>
        <Can permission="support.transition">
          <Button size="sm" variant="success" onClick={() => setPendingAction('close')}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('support.closeTickets')}
          </Button>
        </Can>
        <Can permission="support.close">
          <Button size="sm" variant="danger" onClick={() => setPendingAction('delete')}>
            <Trash2 className="h-3.5 w-3.5" />
            {t('common.delete')}
          </Button>
        </Can>
      </BulkActionBar>

      <BulkConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        title={t('common.bulkConfirmTitle')}
        count={selected.length}
        confirmLabel={pendingAction === 'delete' ? t('common.delete') : t('support.closeTickets')}
        confirmVariant={pendingAction === 'delete' ? 'danger' : 'success'}
        loading={bulkMutation.isPending}
        onConfirm={(reason) => pendingAction && bulkMutation.mutate({ action: pendingAction, reason })}
      />
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { auditApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n/provider';

interface Row {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  ip: string | null;
  occurredAt: string;
}

export function AuditPage() {
  const [search, setSearch] = useState('');
  const action = search.includes('.') ? search : undefined;
  const { t } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'audit', { action }],
    queryFn: () => auditApi.list({ action, limit: 100 }) as Promise<{ items: Row[] }>,
  });

  const columns: Column<Row>[] = [
    { key: 'when', header: t('audit.when'), cell: (r) => <span className="font-mono text-xs">{new Date(r.occurredAt).toLocaleString()}</span>, sortValue: (r) => r.occurredAt },
    {
      key: 'actor',
      header: t('audit.actor'),
      cell: (r) => (
        <div>
          <div className="break-all font-medium">{r.actorEmail}</div>
          <div className="text-xs text-muted-foreground">{r.actorRole}</div>
        </div>
      ),
      sortValue: (r) => r.actorEmail,
    },
    { key: 'action', header: t('audit.action'), cell: (r) => <Badge variant="default">{r.action}</Badge>, sortValue: (r) => r.action },
    { key: 'target', header: t('audit.target'), cell: (r) => <span className="font-mono text-xs">{r.targetType}#{r.targetId.slice(-8)}</span>, sortValue: (r) => r.targetType },
    { key: 'reason', header: t('common.reason'), cell: (r) => <span className="line-clamp-1 max-w-xs text-xs text-muted-foreground">{r.reason ?? '—'}</span> },
    { key: 'ip', header: t('audit.ip'), cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.ip ?? '—'}</span> },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t('audit.title')} description={t('audit.subtitle')} />
      <div className="relative mb-4 max-w-md">
        <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t('audit.filterHint')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-8"
        />
      </div>
      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        emptyTitle={t('audit.noEvents')}
        emptyDescription={t('audit.eventsAppear')}
        pageSize={20}
      />
    </div>
  );
}

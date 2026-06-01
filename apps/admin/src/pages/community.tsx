import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { communityApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BulkActionBar } from '@/components/ui/bulk-action-bar';
import { BulkConfirmDialog } from '@/components/ui/bulk-confirm-dialog';
import { Can } from '@/components/auth/can';
import { toast } from '@/components/ui/toast';
import { readApiError } from '@/lib/api-error';
import { useI18n } from '@/i18n/provider';
import { formatNumber } from '@/lib/utils';

interface Post {
  id: string;
  title: string;
  body: string;
  category: string;
  likeCount: number;
  dislikeCount: number;
  isHidden: boolean;
  driverId: string;
  driverDisplayName: string;
  driverPhone: string;
  createdAt: string;
}

export function CommunityPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'hidden' | 'visible'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const qc = useQueryClient();
  const isHidden = filter === 'all' ? undefined : filter === 'hidden';

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'community', { isHidden }],
    queryFn: () => communityApi.list({ isHidden, limit: 100 }) as Promise<{ items: Post[] }>,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'community'] });
  const onErr = (e: unknown) => { const er = readApiError(e); toast.error(er.code, er.message); };

  const hideMut = useMutation({
    mutationFn: (id: string) => communityApi.hide(id),
    onSuccess: () => { toast.success(t('community.hidden')); invalidate(); },
    onError: onErr,
  });
  const unhideMut = useMutation({
    mutationFn: (id: string) => communityApi.unhide(id),
    onSuccess: () => { toast.success(t('community.visible')); invalidate(); },
    onError: onErr,
  });
  const bulkDeleteMut = useMutation({
    mutationFn: (reason: string) => communityApi.bulkDelete(selected, reason),
    onSuccess: (resp: { affected: number }) => {
      toast.success(t('common.completed'), `${resp.affected} ${t('common.affected')}`);
      setSelected([]);
      setConfirmDelete(false);
      invalidate();
    },
    onError: onErr,
  });

  const filterLabel = (v: 'all' | 'visible' | 'hidden') =>
    v === 'all' ? t('community.all') : v === 'visible' ? t('community.visible') : t('community.hidden');

  const columns: Column<Post>[] = [
    {
      key: 'post',
      header: t('community.post'),
      cell: (p) => (
        <div className="min-w-0 max-w-xl">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{p.title}</span>
            {p.isHidden && <Badge variant="warning">{t('community.hidden')}</Badge>}
          </div>
          <div className="line-clamp-2 text-xs text-muted-foreground">{p.body}</div>
        </div>
      ),
      sortValue: (p) => p.title,
    },
    {
      key: 'author',
      header: t('community.author'),
      cell: (p) => (
        <div>
          <div className="font-medium">{p.driverDisplayName}</div>
          <div className="font-mono text-xs text-muted-foreground">{p.driverPhone}</div>
        </div>
      ),
      sortValue: (p) => p.driverDisplayName,
    },
    {
      key: 'category',
      header: t('community.category'),
      cell: (p) => <Badge variant="outline">{p.category.replace(/_/g, ' ')}</Badge>,
      sortValue: (p) => p.category,
    },
    {
      key: 'engagement',
      header: t('community.likes'),
      align: 'right',
      cell: (p) => (
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{formatNumber(p.likeCount)}</span>
          <span className="inline-flex items-center gap-0.5"><ThumbsDown className="h-3 w-3" />{formatNumber(p.dislikeCount)}</span>
        </span>
      ),
      sortValue: (p) => p.likeCount - p.dislikeCount,
    },
    {
      key: 'createdAt',
      header: t('common.createdAt'),
      cell: (p) => <span className="text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>,
      sortValue: (p) => p.createdAt,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (p) => (
        <div className="inline-flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          {p.isHidden ? (
            <Can permission="community.unhide">
              <Button variant="outline" size="sm" loading={unhideMut.isPending} onClick={() => unhideMut.mutate(p.id)}>
                <Eye className="h-3.5 w-3.5" />{t('community.unhide')}
              </Button>
            </Can>
          ) : (
            <Can permission="community.hide">
              <Button variant="outline" size="sm" loading={hideMut.isPending} onClick={() => hideMut.mutate(p.id)}>
                <EyeOff className="h-3.5 w-3.5" />{t('community.hide')}
              </Button>
            </Can>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={t('community.title')}
        description={t('community.subtitle')}
        actions={
          <div className="inline-flex rounded-md border bg-card p-0.5">
            {(['all', 'visible', 'hidden'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === v ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {filterLabel(v)}
              </button>
            ))}
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        rowKey={(p) => p.id}
        emptyTitle={t('community.noPosts')}
        emptyDescription={t('community.nothingMod')}
        pageSize={15}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
      />

      <BulkActionBar count={selected.length} onClear={() => setSelected([])}>
        <Can permission="community.delete">
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            {t('common.delete')}
          </Button>
        </Can>
      </BulkActionBar>

      <BulkConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('common.bulkConfirmTitle')}
        count={selected.length}
        confirmLabel={t('common.delete')}
        confirmVariant="danger"
        loading={bulkDeleteMut.isPending}
        onConfirm={(reason) => bulkDeleteMut.mutate(reason)}
      />
    </div>
  );
}

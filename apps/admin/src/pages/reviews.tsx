import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Star, StarOff, X, Trash2 } from 'lucide-react';
import { reviewsApi } from '@/lib/api/endpoints';
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

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  isApproved: boolean;
  isFeatured: boolean;
  driverId: string;
  driverDisplayName: string;
  driverPhone: string;
  createdAt: string;
}

function StarsBar({ rating }: { rating: number }) {
  return (
    <div className="inline-flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? 'fill-warning text-warning' : 'text-muted-foreground'}`} />
      ))}
    </div>
  );
}

export function ReviewsPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'featured'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const qc = useQueryClient();
  const { t } = useI18n();
  const isApproved = filter === 'pending' ? false : undefined;
  const isFeatured = filter === 'featured' ? true : undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'reviews', { filter }],
    queryFn: () => reviewsApi.list({ isApproved, isFeatured, limit: 100 }),
  });
  const { data: summary } = useQuery({
    queryKey: ['admin', 'reviews', 'summary'],
    queryFn: () => reviewsApi.summary(),
  });

  const onErr = (e: unknown) => { const er = readApiError(e); toast.error(er.code, er.message); };
  const onSuccess = (msg: string) => () => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
  };

  const approve = useMutation({ mutationFn: reviewsApi.approve, onSuccess: onSuccess(t('reviews.approve')), onError: onErr });
  const unapprove = useMutation({ mutationFn: reviewsApi.unapprove, onSuccess: onSuccess(t('reviews.unapprove')), onError: onErr });
  const feature = useMutation({ mutationFn: reviewsApi.feature, onSuccess: onSuccess(t('reviews.feature')), onError: onErr });
  const unfeature = useMutation({ mutationFn: reviewsApi.unfeature, onSuccess: onSuccess(t('reviews.unfeature')), onError: onErr });
  const bulkDeleteMut = useMutation({
    mutationFn: (reason: string) => reviewsApi.bulkDelete(selected, reason),
    onSuccess: (resp: { affected: number }) => {
      toast.success(t('common.completed'), `${resp.affected} ${t('common.affected')}`);
      setSelected([]);
      setConfirmDelete(false);
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    },
    onError: onErr,
  });

  const filterLabel = (v: 'all' | 'pending' | 'featured') =>
    v === 'all' ? t('reviews.all') : v === 'pending' ? t('reviews.pending') : t('reviews.featured');

  const columns: Column<Review>[] = [
    {
      key: 'rating',
      header: t('reviews.rating'),
      cell: (r) => <StarsBar rating={r.rating} />,
      sortValue: (r) => r.rating,
    },
    {
      key: 'review',
      header: t('reviews.review'),
      cell: (r) => (
        <div className="min-w-0 max-w-xl">
          <div className="flex flex-wrap items-center gap-1.5">
            {r.title && <span className="font-medium">{r.title}</span>}
            {!r.isApproved && <Badge variant="warning">{t('reviews.pending')}</Badge>}
            {r.isFeatured && <Badge variant="success">{t('reviews.featured')}</Badge>}
          </div>
          <div className="line-clamp-2 text-xs text-muted-foreground">{r.body}</div>
        </div>
      ),
      sortValue: (r) => r.title ?? r.body,
    },
    {
      key: 'author',
      header: t('community.author'),
      cell: (r) => (
        <div>
          <div className="font-medium">{r.driverDisplayName}</div>
          <div className="font-mono text-xs text-muted-foreground">{r.driverPhone}</div>
        </div>
      ),
      sortValue: (r) => r.driverDisplayName,
    },
    {
      key: 'createdAt',
      header: t('common.createdAt'),
      cell: (r) => <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>,
      sortValue: (r) => r.createdAt,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (r) => (
        <div className="inline-flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          {r.isApproved ? (
            <Can permission="reviews.unapprove">
              <Button variant="outline" size="sm" onClick={() => unapprove.mutate(r.id)} loading={unapprove.isPending}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </Can>
          ) : (
            <Can permission="reviews.approve">
              <Button variant="success" size="sm" onClick={() => approve.mutate(r.id)} loading={approve.isPending}>
                <Check className="h-3.5 w-3.5" />
              </Button>
            </Can>
          )}
          {r.isFeatured ? (
            <Can permission="reviews.unfeature">
              <Button variant="ghost" size="sm" onClick={() => unfeature.mutate(r.id)} loading={unfeature.isPending}>
                <StarOff className="h-3.5 w-3.5" />
              </Button>
            </Can>
          ) : (
            <Can permission="reviews.feature">
              <Button variant="ghost" size="sm" onClick={() => feature.mutate(r.id)} loading={feature.isPending}>
                <Star className="h-3.5 w-3.5" />
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
        title={t('reviews.title')}
        description={t('reviews.subtitle')}
        actions={
          <div className="inline-flex rounded-md border bg-card p-0.5">
            {(['all', 'pending', 'featured'] as const).map((v) => (
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

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: t('reviews.totalLabel'), value: summary.total },
            { label: t('reviews.approved'), value: summary.approved },
            { label: t('reviews.pending'), value: summary.pending },
            { label: t('reviews.featured'), value: summary.featured },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border bg-card p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</div>
              <div className="mt-1 text-2xl font-semibold">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        emptyTitle={t('reviews.noReviews')}
        emptyDescription={t('reviews.nothingMatch')}
        pageSize={15}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
      />

      <BulkActionBar count={selected.length} onClear={() => setSelected([])}>
        <Can permission="reviews.delete">
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

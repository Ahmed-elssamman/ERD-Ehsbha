import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Route, Filter, Plus, ChevronRight, Trash2, CheckSquare, Square, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useI18n } from '@/i18n';
import { TripsApi, type TripItem } from '@/lib/api/endpoints';
import { formatKm, formatMoney, formatTime, formatDate } from '@/lib/format';
import { durationMinutes } from '@/lib/time';
import { Badge } from '@/components/ui/badge';

type Preset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'all';

function rangeFor(preset: Preset): { from?: string; to?: string } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'all') return {};
  if (preset === 'today') return { from: startOfDay.toISOString() };
  if (preset === 'last7') {
    const f = new Date(startOfDay);
    f.setDate(f.getDate() - 7);
    return { from: f.toISOString() };
  }
  if (preset === 'last30') {
    const f = new Date(startOfDay);
    f.setDate(f.getDate() - 30);
    return { from: f.toISOString() };
  }
  // thisMonth
  const f = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: f.toISOString() };
}

function tripNet(t: TripItem) {
  return t.grossPiastres + t.tipPiastres - t.commissionPiastres;
}

export function TripsListPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [preset, setPreset] = useState<Preset>('last7');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const range = rangeFor(preset);
  const { data, isLoading } = useQuery({
    queryKey: ['trips', { preset }],
    queryFn: () => TripsApi.list({ ...range, limit: 50 }),
    staleTime: 30_000,
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  // When the preset changes the list contents change underneath the
  // selection — drop any selected ids that are no longer visible so the
  // count in the toolbar stays accurate.
  const visibleIds = useMemo(() => new Set(items.map((t) => t.id)), [items]);
  const effectiveSelected = useMemo(
    () => new Set(Array.from(selected).filter((id) => visibleIds.has(id))),
    [selected, visibleIds],
  );

  const allSelected = items.length > 0 && effectiveSelected.size === items.length;
  const someSelected = effectiveSelected.size > 0 && !allSelected;

  const enterSelectMode = () => {
    setSelectMode(true);
    setStatusMsg(null);
  };
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
    setStatusMsg(null);
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((t) => t.id)));
    }
  };

  const deleteMut = useMutation({
    mutationFn: (ids: string[]) => TripsApi.removeBatch(ids),
    onSuccess: ({ deleted, errors }) => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['decisions'] });
      qc.invalidateQueries({ queryKey: ['score'] });
      setConfirm(false);
      // Keep IDs that failed so the user can retry without re-selecting.
      setSelected(new Set(errors.map((e) => e.id)));
      if (errors.length === 0) {
        setStatusMsg(t('trips.bulkDelete.success', { n: deleted.length }));
        // Leave select mode once everything succeeded.
        setSelectMode(false);
      } else if (deleted.length > 0) {
        setStatusMsg(
          t('trips.bulkDelete.partial', {
            ok: deleted.length,
            total: deleted.length + errors.length,
            fail: errors.length,
          }),
        );
      } else {
        setStatusMsg(t('trips.bulkDelete.failed'));
      }
    },
    onError: () => {
      setConfirm(false);
      setStatusMsg(t('trips.bulkDelete.failed'));
    },
  });

  const handleConfirmDelete = () => {
    const ids = Array.from(effectiveSelected);
    if (ids.length === 0) {
      setConfirm(false);
      return;
    }
    deleteMut.mutate(ids);
  };

  const handleRowAction = (trip: TripItem) => {
    if (selectMode) toggleOne(trip.id);
    else navigate(`/trips/${trip.id}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('trips.title')}
        subtitle={t('trips.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectMode ? (
              <Button variant="ghost" onClick={exitSelectMode} className="gap-1.5">
                <X className="h-4 w-4" aria-hidden />
                {t('common.cancel')}
              </Button>
            ) : items.length > 0 ? (
              <Button variant="ghost" onClick={enterSelectMode} className="gap-1.5">
                <CheckSquare className="h-4 w-4" aria-hidden />
                {t('trips.bulkDelete.enter')}
              </Button>
            ) : null}
            {!selectMode ? (
              <Button asChild>
                <Link to="/trips/new" className="gap-2">
                  <Plus className="h-4 w-4" aria-hidden /> {t('trips.add')}
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Selection toolbar — sticky on mobile so the action stays reachable
          while the driver scrolls a long list. */}
      <AnimatePresence initial={false}>
        {selectMode ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/95 px-3 py-2 shadow-sm backdrop-blur"
          >
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              disabled={items.length === 0}
            >
              {allSelected ? (
                <CheckSquare className="h-4 w-4 text-primary" aria-hidden />
              ) : someSelected ? (
                <span className="grid h-4 w-4 place-items-center rounded-sm border border-primary bg-primary/30 text-primary">
                  <span className="block h-0.5 w-2.5 rounded bg-primary" aria-hidden />
                </span>
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
              <span>
                {effectiveSelected.size === 0
                  ? t('trips.bulkDelete.selectAll')
                  : t('trips.bulkDelete.countSelected', { n: effectiveSelected.size })}
              </span>
            </button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirm(true)}
              disabled={effectiveSelected.size === 0 || deleteMut.isPending}
              loading={deleteMut.isPending}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {t('trips.bulkDelete.delete', { n: effectiveSelected.size })}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {statusMsg ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs text-foreground">
          {statusMsg}
        </p>
      ) : null}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <Tabs<Preset>
          size="sm"
          value={preset}
          onChange={setPreset}
          items={[
            { key: 'today', label: t('trips.filter.preset.today') },
            { key: 'last7', label: t('trips.filter.preset.last7') },
            { key: 'last30', label: t('trips.filter.preset.last30') },
            { key: 'thisMonth', label: t('trips.filter.preset.thisMonth') },
            { key: 'all', label: t('common.all') },
          ]}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <ul className="divide-y divide-border/60">
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i} className="px-5 py-4">
                  <Skeleton className="h-12 w-full" />
                </li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            <EmptyState
              Icon={Route}
              title={t('trips.empty')}
              body={t('trips.emptyBody')}
              action={
                <Button asChild>
                  <Link to="/trips/new">{t('trips.add')}</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((trip, i) => {
                const checked = effectiveSelected.has(trip.id);
                return (
                  <motion.li
                    key={trip.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, delay: Math.min(i, 10) * 0.02 }}
                  >
                    <button
                      type="button"
                      onClick={() => handleRowAction(trip)}
                      aria-pressed={selectMode ? checked : undefined}
                      className={[
                        'flex w-full items-center justify-between gap-3 px-5 py-4 text-start transition-colors',
                        selectMode && checked ? 'bg-primary/5' : 'hover:bg-accent/40',
                      ].join(' ')}
                    >
                      {selectMode ? (
                        <span
                          aria-hidden
                          className={[
                            'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition',
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input bg-background',
                          ].join(' ')}
                        >
                          {checked ? (
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : null}
                        </span>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="num-tabular text-base font-semibold">
                            {formatMoney(tripNet(trip), locale)}
                          </span>
                          {trip.emptyKmMeters > 0 ? (
                            <Badge variant="muted">
                              {formatKm(trip.emptyKmMeters, locale)} km empty
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <span dir="ltr">
                            {formatDate(trip.startedAt, locale, { month: 'short', day: 'numeric' })} ·{' '}
                            {formatTime(trip.startedAt, locale)}
                          </span>
                          {' · '}
                          {formatKm(trip.totalKmMeters, locale)} km
                          {' · '}
                          {durationMinutes(trip.startedAt, trip.endedAt)}m
                        </p>
                      </div>
                      {!selectMode ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" aria-hidden />
                      ) : null}
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleConfirmDelete}
        title={t('trips.bulkDelete.confirmTitle', { n: effectiveSelected.size })}
        body={t('trips.bulkDelete.confirmBody', { n: effectiveSelected.size })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={deleteMut.isPending}
      />
    </div>
  );
}

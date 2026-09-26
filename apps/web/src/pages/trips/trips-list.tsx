import { RecordDraftList } from '@/components/record-drafts/record-draft-list';
import { RecordDraftKind } from '@/lib/record-drafts/record-draft.model';
import { TripForm } from './trip-form';
import { tripEarningsPiastres, TripView, type TripVersionTarget } from '@ehsbha/shared-types';
import { useMemo, useState } from 'react';
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Route, Filter, Plus, ChevronRight, Trash2, CheckSquare, Square, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { useI18n } from '@/i18n';
import { TripsApi, type TripItem } from '@/lib/api/endpoints';
import { formatKm, formatMoney, formatTime, formatDate } from '@/lib/format';
import { durationMinutes } from '@/lib/time';
import { Badge } from '@/components/ui/badge';
import { useBusinessDate } from '@/hooks/use-business-date';

import { TripDatePreset as Preset, TRIP_DATE_PRESETS as PRESETS, parsePreset, rangeFor, TRIP_BATCH_SELECTION_LIMIT } from './trips-list.control';

function tripNet(t: TripItem) {
  return tripEarningsPiastres(t);
}

export function TripsListPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Initial filter window can be seeded from the URL (?range=all) — the OCR
  // import flow sends the driver here with range=all so freshly imported trips
  // (whose startedAt is often days/weeks in the past) are visible immediately
  // instead of being hidden behind the default "last 7 days" window.
  const [searchParams] = useSearchParams();
  const [preset, setPreset] = useState<Preset>(() => parsePreset(searchParams.get('range')));
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [confirm, setConfirm] = useState(false);
  const [view, setView] = useState(TripView.Active);
  const [batch, setBatch] = useState<{ items: TripVersionTarget[]; key: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const today = useBusinessDate();
  const range = useMemo(() => rangeFor(preset), [preset, today]);
  const query = useInfiniteQuery({
    queryKey: ['trips', { preset, today, view }], initialPageParam: '',
    queryFn: ({ pageParam }) => TripsApi.list({ ...range, view, limit: 50, ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: (page) => page.nextCursor,
    staleTime: 30_000,
  });

  const { isLoading } = query;
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  // When the preset changes the list contents change underneath the
  // selection — drop any selected ids that are no longer visible so the
  // count in the toolbar stays accurate.
  const visibleIds = useMemo(() => new Set(items.map((t) => t.id)), [items]);
  const effectiveSelected = useMemo(
    () => new Set(Array.from(selected.keys()).filter((id) => visibleIds.has(id))),
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
    setSelected(new Map());
    setStatusMsg(null);
  };
  const toggleOne = (trip: TripItem) => {
    const id = trip.id;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < TRIP_BATCH_SELECTION_LIMIT) next.set(id, trip.version);
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Map());
    } else {
      setSelected(new Map(items.slice(0, TRIP_BATCH_SELECTION_LIMIT).map((trip) => [trip.id, selected.get(trip.id) ?? trip.version])));
    }
  };

  const deleteMut = useMutation({
    mutationFn: (input: { items: TripVersionTarget[]; key: string }) => TripsApi.removeBatch(input.items, input.key),
    onSuccess: ({ deleted, errors }) => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['decisions'] });
      qc.invalidateQueries({ queryKey: ['score'] });
      setConfirm(false);
      // Keep IDs that failed so the user can retry without re-selecting.
      setSelected((previous) => new Map(Array.from(previous).filter(([id]) => errors.some((error) => error.id === id))));
      setBatch(null);
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
      if (errors.some((error) => error.code === 'TRIP_VERSION_CONFLICT')) setStatusMsg(t('trips.bulkStale'));
    },
    onError: () => {
      setStatusMsg(t('trips.bulkDelete.failed'));
    },
  });

  function openDelete() {
    const targets = Array.from(selected).filter(([id]) => effectiveSelected.has(id)).map(([id, expectedVersion]) => ({ id, expectedVersion }));
    if (!targets.length) return;
    setBatch({ items: targets, key: crypto.randomUUID() }); setStatusMsg(null); setConfirm(true);
  }
  const handleConfirmDelete = () => { if (batch) deleteMut.mutate(batch); };
  function changeView() {
    setView((current) => current === TripView.Active ? TripView.Deleted : TripView.Active);
    exitSelectMode();
  }

  const handleRowAction = (trip: TripItem) => {
    if (selectMode) toggleOne(trip);
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
            ) : items.length > 0 && view === TripView.Active ? (
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

      <RecordDraftList kind={RecordDraftKind.Trip} render={(draft, close) => <Dialog open onClose={close} title={t('recordDrafts.title')}>
        <TripForm scope={draft.scope} resumeOnly onClose={close} onDone={(id) => { close(); navigate('/trips/' + id); }} />
      </Dialog>} />
      <Button variant="outline" onClick={changeView}>{t(view === TripView.Active ? 'trips.showDeleted' : 'trips.showActive')}</Button>
      <p className="text-sm text-muted-foreground">{t('trips.view.' + view)}</p>
      {query.isError ? <div role="alert"><p>{t('trips.loadFailed')}</p><Button onClick={() => void query.refetch()}>{t('common.retry')}</Button></div> : null}
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
                  ? t(items.length > TRIP_BATCH_SELECTION_LIMIT ? 'trips.selectLimit' : 'trips.bulkDelete.selectAll', { n: TRIP_BATCH_SELECTION_LIMIT })
                  : t('trips.bulkDelete.countSelected', { n: effectiveSelected.size })}
              </span>
            </button>
            <Button
              variant="destructive"
              size="sm"
              onClick={openDelete}
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
          onChange={(value) => { setPreset(value); exitSelectMode(); }}
          items={PRESETS.map((key) => ({ key, label: t(key === Preset.All ? 'common.all' : `trips.filter.preset.${key}`) }))}
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
          ) : query.isError && items.length === 0 ? null : items.length === 0 ? (
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
                              {formatKm(trip.emptyKmMeters, locale)} {t('common.km')} · {t('trips.tripEmptyKm')}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <span dir="ltr">
                            {formatDate(trip.startedAt, locale, { month: 'short', day: 'numeric' })} ·{' '}
                            {formatTime(trip.startedAt, locale)}
                          </span>
                          {' · '}
                          {formatKm(trip.totalKmMeters, locale)} {t('common.km')}
                          {' · '}
                          {durationMinutes(trip.startedAt, trip.endedAt)} {t('common.min')}
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

      {query.hasNextPage ? <Button variant="outline" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t('trips.loadMore')}</Button> : null}
      <ConfirmDialog
        open={confirm}
        onClose={() => { if (!deleteMut.isPending) setConfirm(false); }}
        onConfirm={handleConfirmDelete}
        title={t('trips.bulkDelete.confirmTitle', { n: batch?.items.length ?? 0 })}
        body={(statusMsg ? statusMsg + ' ' : '') + t('trips.bulkDelete.confirmBody', { n: batch?.items.length ?? 0 })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={deleteMut.isPending}
      />
    </div>
  );
}

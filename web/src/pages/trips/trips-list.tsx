import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Route, Filter, Plus, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
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
  const [preset, setPreset] = useState<Preset>('last7');

  const range = rangeFor(preset);
  const { data, isLoading } = useQuery({
    queryKey: ['trips', { preset }],
    queryFn: () => TripsApi.list({ ...range, limit: 50 }),
    staleTime: 30_000,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('trips.title')}
        subtitle={t('trips.subtitle')}
        actions={
          <Button asChild>
            <Link to="/trips/new" className="gap-2">
              <Plus className="h-4 w-4" aria-hidden /> {t('trips.add')}
            </Link>
          </Button>
        }
      />

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
              {items.map((trip, i) => (
                <motion.li
                  key={trip.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, delay: Math.min(i, 10) * 0.02 }}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/trips/${trip.id}`)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0">
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
                        <span dir="ltr">{formatDate(trip.startedAt, locale, { month: 'short', day: 'numeric' })} · {formatTime(trip.startedAt, locale)}</span>
                        {' · '}
                        {formatKm(trip.totalKmMeters, locale)} km
                        {' · '}
                        {durationMinutes(trip.startedAt, trip.endedAt)}m
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" aria-hidden />
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

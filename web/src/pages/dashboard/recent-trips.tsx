import { Link } from 'react-router-dom';
import { Route, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n';
import { formatKm, formatMoney, formatTime } from '@/lib/format';
import type { TripItem } from '@/lib/api/endpoints';

interface Props {
  items: TripItem[] | undefined;
  loading: boolean;
}

function tripNet(t: TripItem): number {
  return t.grossPiastres + t.tipPiastres - t.commissionPiastres;
}

export function RecentTrips({ items, loading }: Props) {
  const { t, locale } = useI18n();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="h-4 w-4 text-primary" aria-hidden />
          {t('dashboard.recentTrips')}
        </CardTitle>
        <Link
          to="/trips"
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('common.viewAll')}
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">{t('dashboard.noTripsToday')}</p>
            <Link
              to="/trips"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t('dashboard.addFirstTrip')}
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((trip, i) => (
              <motion.li
                key={trip.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: i * 0.03 }}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="num-tabular text-sm font-semibold">
                    {formatMoney(tripNet(trip), locale)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span dir="ltr">{formatTime(trip.startedAt, locale)}</span>
                    {' · '}
                    {formatKm(trip.totalKmMeters, locale)} km
                  </p>
                </div>
                {trip.notes ? (
                  <p className="hidden max-w-[40%] truncate text-xs text-muted-foreground sm:block">
                    {trip.notes}
                  </p>
                ) : null}
              </motion.li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

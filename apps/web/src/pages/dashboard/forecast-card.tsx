import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n';
import { formatMoney } from '@/lib/format';
import type { MonthlyForecast } from '@/lib/api/endpoints';

interface Props {
  data: MonthlyForecast | undefined;
  loading: boolean;
}

export function ForecastCard({ data, loading }: Props) {
  const { t, locale } = useI18n();
  const progress = data && data.totalDays > 0 ? (data.elapsedDays / data.totalDays) * 100 : 0;

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Link
        to="/work-planner"
        aria-label={t('dashboard.viewDetails')}
        className="group block"
      >
        <Card className="transition-all hover:border-primary/40 hover:shadow-elevated">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="truncate">{t('dashboard.forecast')}</span>
              </CardTitle>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {t('dashboard.forecastSubtitle')}
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              aria-hidden
            />
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="space-y-3">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                      {t('dashboard.projected')}
                    </p>
                    <p className="num-tabular break-words text-xl font-bold tracking-tight sm:text-2xl">
                      {formatMoney(data.forecastNetPiastres, locale)}
                    </p>
                  </div>
                  <div className="min-w-0 text-end">
                    <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t('dashboard.currentNet')}
                    </p>
                    <p className="num-tabular break-words text-sm font-semibold">
                      {formatMoney(data.currentNetPiastres, locale)}
                    </p>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, progress)}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">
                    {t('dashboard.elapsed', { elapsed: data.elapsedDays, total: data.totalDays })}
                  </span>
                  <span dir="ltr" className="min-w-0 truncate">
                    ± {formatMoney(data.confidenceBandPiastres, locale)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

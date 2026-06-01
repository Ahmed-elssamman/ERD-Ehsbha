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
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
                {t('dashboard.forecast')}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{t('dashboard.forecastSubtitle')}</p>
            </div>
            <ArrowRight
              className="h-4 w-4 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
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
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t('dashboard.projected')}
                    </p>
                    <p className="num-tabular text-2xl font-bold tracking-tight">
                      {formatMoney(data.forecastNetPiastres, locale)}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t('dashboard.currentNet')}
                    </p>
                    <p className="num-tabular text-sm font-semibold">
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
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('dashboard.elapsed', { elapsed: data.elapsedDays, total: data.totalDays })}</span>
                  <span dir="ltr">± {formatMoney(data.confidenceBandPiastres, locale)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

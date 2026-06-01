import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarClock, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { AnalyticsApi, GoalsApi } from '@/lib/api/endpoints';
import { formatDuration, formatMoney, formatNumber } from '@/lib/format';

const STATUS_STYLES: Record<string, string> = {
  ON_TRACK: 'bg-success/15 text-success',
  LAGGING: 'bg-warning/15 text-warning',
  AT_RISK: 'bg-destructive/15 text-destructive',
  ACHIEVED: 'bg-primary/15 text-primary',
};

export function WorkPlannerPage() {
  const { t, locale } = useI18n();

  const goalsQ = useQuery({ queryKey: ['goals'], queryFn: GoalsApi.list });
  const monthlyGoal = useMemo(
    () => (goalsQ.data ?? []).find((g) => g.period === 'MONTHLY' && g.isActive),
    [goalsQ.data],
  );
  const progressQ = useQuery({
    queryKey: ['goals', monthlyGoal?.id, 'progress'],
    queryFn: () => GoalsApi.progress(monthlyGoal!.id),
    enabled: !!monthlyGoal?.id,
  });

  const forecastQ = useQuery({
    queryKey: ['analytics', 'forecast', 'monthly'],
    queryFn: AnalyticsApi.forecastMonthly,
  });

  const todayQ = useQuery({ queryKey: ['analytics', 'today'], queryFn: AnalyticsApi.today });

  if (goalsQ.isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title={t('planner.title')} subtitle={t('planner.subtitle')} />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!monthlyGoal) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title={t('planner.title')} subtitle={t('planner.subtitle')} />
        <Card>
          <CardContent>
            <EmptyState
              Icon={Target}
              title={t('planner.noGoal')}
              action={
                <Button asChild>
                  <Link to="/settings">{t('nav.settings')}</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = progressQ.data;
  const forecast = forecastQ.data;
  const today = todayQ.data;

  const target = monthlyGoal.targetPiastres;
  const current = progress?.currentNetPiastres ?? 0;
  const remaining = Math.max(0, target - current);
  const elapsed = forecast?.elapsedDays ?? progress?.elapsedDays ?? 0;
  const totalDays = forecast?.totalDays ?? progress?.totalDays ?? 0;
  const remainingDays = Math.max(0, totalDays - elapsed);
  const neededPerDay = remainingDays > 0 ? Math.round(remaining / remainingDays) : 0;

  const profitPerHour = today?.profitPerHourPiastres ?? 0;
  const neededHoursPerDay =
    profitPerHour > 0 && remainingDays > 0 ? remaining / remainingDays / profitPerHour : 0;
  const neededPerHour = profitPerHour;

  const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('planner.title')} subtitle={t('planner.subtitle')} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" aria-hidden /> {t('planner.target')}
            </span>
            {progress ? (
              <Badge className={STATUS_STYLES[progress.status]}>
                {t(`planner.${progress.status === 'ACHIEVED' ? 'achieved' : progress.status === 'ON_TRACK' ? 'atTrack' : progress.status === 'LAGGING' ? 'lagging' : 'atRisk'}`)}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('planner.currentNet')}</p>
              <p className="num-tabular text-3xl font-bold tracking-tight">{formatMoney(current, locale)}</p>
            </div>
            <div className="text-end">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('planner.target')}</p>
              <p className="num-tabular text-sm font-semibold">{formatMoney(target, locale)}</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={t('planner.remainingDays')} value={formatNumber(remainingDays, locale)} />
        <Stat label={t('planner.neededPerDay')} value={formatMoney(neededPerDay, locale)} />
        <Stat label={t('planner.neededPerHour')} value={formatMoney(neededPerHour, locale)} />
        <Stat label={t('planner.estimateHours')} value={formatDuration(Math.round(neededHoursPerDay * 60), locale)} />
      </div>

      {forecast ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" aria-hidden /> {t('dashboard.forecast')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.currentNet')}</p>
                <p className="num-tabular font-semibold">{formatMoney(forecast.currentNetPiastres, locale)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.projected')}</p>
                <p className="num-tabular font-semibold">{formatMoney(forecast.forecastNetPiastres, locale)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.confidenceBand')}</p>
                <p className="num-tabular font-semibold">± {formatMoney(forecast.confidenceBandPiastres, locale)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="num-tabular mt-1.5 text-xl font-bold sm:text-2xl">{value}</p>
    </Card>
  );
}

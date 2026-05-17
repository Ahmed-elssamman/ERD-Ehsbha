import { useQuery } from '@tanstack/react-query';
import {
  Coins,
  Route,
  MapPin,
  Clock,
  Plus,
  Receipt,
  Wrench,
  BarChart3,
  Sigma,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { useAuth } from '@/stores/auth.store';
import {
  AnalyticsApi,
  RecommendationsApi,
  ScoreApi,
  TripsApi,
  DriverApi,
  type DailyAnalytics,
  type MonthlyForecast,
  type DecisionCard,
  type DriverScore,
  type TripsListResponse,
  type DriverMe,
} from '@/lib/api/endpoints';
import { formatDuration, formatKm, formatMoney } from '@/lib/format';
import { KpiCard } from './kpi-card';
import { DecisionsCard } from './decisions-card';
import { ForecastCard } from './forecast-card';
import { ScoreCard } from './score-card';
import { RecentTrips } from './recent-trips';
import { AnimatedNumber } from './animated-number';

export function DashboardPage() {
  const { t, locale } = useI18n();
  const user = useAuth((s) => s.user);

  const driverQuery = useQuery<DriverMe>({
    queryKey: ['driver', 'me'],
    queryFn: DriverApi.me,
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const todayQuery = useQuery<DailyAnalytics>({
    queryKey: ['analytics', 'today'],
    queryFn: AnalyticsApi.today,
    staleTime: 30_000,
  });

  const forecastQuery = useQuery<MonthlyForecast>({
    queryKey: ['analytics', 'forecast', 'monthly'],
    queryFn: AnalyticsApi.forecastMonthly,
    staleTime: 60_000,
  });

  const decisionsQuery = useQuery<DecisionCard[]>({
    queryKey: ['decisions', 'today'],
    queryFn: RecommendationsApi.todaysDecisions,
    staleTime: 60_000,
  });

  const scoreQuery = useQuery<DriverScore | null>({
    queryKey: ['score', 'today'],
    queryFn: ScoreApi.today,
    staleTime: 60_000,
  });

  const tripsQuery = useQuery<TripsListResponse>({
    queryKey: ['trips', 'recent'],
    queryFn: () => TripsApi.list({ limit: 5 }),
    staleTime: 30_000,
  });

  const today = todayQuery.data;
  const todayLoading = todayQuery.isLoading;
  const greeting = driverQuery.data?.displayName
    ? t('dashboard.greetingNamed', { name: driverQuery.data.displayName })
    : t('dashboard.greeting');

  const netProfit = today?.netProfitPiastres ?? 0;
  const profitTone: 'success' | 'destructive' | 'default' =
    !today ? 'default' : netProfit >= 0 ? 'success' : 'destructive';

  const quickActions: Array<{
    to: string;
    label: string;
    Icon: typeof Plus;
  }> = [
    { to: '/trips/new', label: t('nav.addTrip'), Icon: Plus },
    { to: '/expenses', label: t('dashboard.addExpense'), Icon: Receipt },
    { to: '/maintenance', label: t('dashboard.logMaintenance'), Icon: Wrench },
    { to: '/analytics', label: t('dashboard.exploreAnalytics'), Icon: BarChart3 },
    { to: '/profit-simulator', label: t('dashboard.openSimulator'), Icon: Sigma },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{greeting}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.todaySummary')}</p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/trips/new">
            <Plus className="h-4 w-4" aria-hidden />
            {t('nav.addTrip')}
          </Link>
        </Button>
      </motion.header>

      {/* KPI row */}
      <section
        aria-label={t('dashboard.todaySummary')}
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <KpiCard
          index={0}
          label={t('dashboard.netProfit')}
          value={<AnimatedNumber value={netProfit} format={(n) => formatMoney(Math.round(n), locale)} />}
          loading={todayLoading}
          tone={profitTone}
          Icon={Coins}
          hint={
            today
              ? `${formatMoney(today.profitPerKmPiastres, locale)} ${t('common.perKm')}`
              : undefined
          }
          to="/analytics"
          linkLabel={`${t('dashboard.netProfit')} — ${t('dashboard.viewDetails')}`}
        />
        <KpiCard
          index={1}
          label={t('dashboard.trips')}
          value={
            <AnimatedNumber
              value={today?.tripCount ?? 0}
              format={(n) =>
                new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US').format(Math.round(n))
              }
            />
          }
          loading={todayLoading}
          Icon={Route}
          to="/trips"
          linkLabel={`${t('dashboard.trips')} — ${t('dashboard.viewDetails')}`}
        />
        <KpiCard
          index={2}
          label={t('dashboard.distance')}
          value={
            <>
              {formatKm(today?.totalKmMeters ?? 0, locale)}{' '}
              <span className="text-base font-semibold text-muted-foreground">
                {t('common.km')}
              </span>
            </>
          }
          loading={todayLoading}
          Icon={MapPin}
          to="/analytics"
          linkLabel={`${t('dashboard.distance')} — ${t('dashboard.viewDetails')}`}
        />
        <KpiCard
          index={3}
          label={t('dashboard.hours')}
          value={formatDuration(today?.onlineMinutes ?? 0, locale)}
          loading={todayLoading}
          Icon={Clock}
          hint={
            today
              ? `${formatMoney(today.profitPerHourPiastres, locale)} ${t('common.perHour')}`
              : undefined
          }
          to="/best-hours"
          linkLabel={`${t('dashboard.hours')} — ${t('dashboard.viewDetails')}`}
        />
      </section>

      {/* Quick actions */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        aria-label={t('dashboard.quickActions')}
      >
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('dashboard.quickActions')}
        </h2>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {quickActions.map(({ to, label, Icon }, i) => (
            <motion.div
              key={to}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22, delay: 0.22 + i * 0.04 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="shrink-0"
            >
              <Link
                to={to}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <Icon className="h-4 w-4 text-primary" aria-hidden />
                <span>{label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Main grid */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ForecastCard data={forecastQuery.data} loading={forecastQuery.isLoading} />
          <RecentTrips items={tripsQuery.data?.items} loading={tripsQuery.isLoading} />
        </div>
        <div className="space-y-4">
          <DecisionsCard data={decisionsQuery.data} loading={decisionsQuery.isLoading} />
          <ScoreCard data={scoreQuery.data} loading={scoreQuery.isLoading} />
        </div>
      </section>
    </div>
  );
}

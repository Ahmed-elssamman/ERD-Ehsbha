import { useQuery } from '@tanstack/react-query';
import { Coins, Route, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{greeting}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.todaySummary')}</p>
        </div>
        <Button asChild>
          <Link to="/trips">{t('nav.addTrip')}</Link>
        </Button>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          index={0}
          label={t('dashboard.netProfit')}
          value={formatMoney(today?.netProfitPiastres ?? 0, locale)}
          loading={todayLoading}
          tone="success"
          Icon={Coins}
          hint={today ? `${formatMoney(today.profitPerKmPiastres, locale)} / km` : undefined}
        />
        <KpiCard
          index={1}
          label={t('dashboard.trips')}
          value={today?.tripCount ?? 0}
          loading={todayLoading}
          Icon={Route}
        />
        <KpiCard
          index={2}
          label={t('dashboard.distance')}
          value={
            <>
              {formatKm(today?.totalKmMeters ?? 0, locale)}{' '}
              <span className="text-base font-semibold text-muted-foreground">km</span>
            </>
          }
          loading={todayLoading}
          Icon={MapPin}
        />
        <KpiCard
          index={3}
          label={t('dashboard.hours')}
          value={formatDuration(today?.onlineMinutes ?? 0, locale)}
          loading={todayLoading}
          Icon={Clock}
          hint={today ? `${formatMoney(today.profitPerHourPiastres, locale)} / h` : undefined}
        />
      </section>

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

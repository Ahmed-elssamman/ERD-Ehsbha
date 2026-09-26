import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { adminDashboardOverviewSchema } from '@ehsbha/api-contracts';
import { parseData } from '@/features/platform-api';
import { adminApi } from '@/lib/api/admin-client';
import { useI18n } from '@/i18n/provider';
import { cn, formatNumber, formatPercent } from '@/lib/utils';

function useDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard', '7d'],
    queryFn: async () => {
      const response = await adminApi.get('/admin/dashboard/overview', { params: { range: '7d' } });
      return parseData(adminDashboardOverviewSchema, response.data, 'admin.dashboard.overview');
    },
  });
}

interface KpiCardProps {
  label: string;
  value: number;
  deltaPct?: number | null;
  format?: 'number' | 'percent';
}

function KpiCard({ label, value, deltaPct, format = 'number' }: KpiCardProps) {
  const formatted = format === 'percent' ? formatPercent(value) : formatNumber(value);
  const isPositive = deltaPct != null && deltaPct > 0;
  const isNegative = deltaPct != null && deltaPct < 0;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="break-words text-2xl font-semibold tracking-tight">{formatted}</div>
        {deltaPct != null && (
          <div
            className={cn(
              'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
              isPositive && 'bg-success/10 text-success',
              isNegative && 'bg-danger/10 text-danger',
              !isPositive && !isNegative && 'bg-muted text-muted-foreground',
            )}
          >
            {isPositive ? <ArrowUp className="h-3 w-3" /> : isNegative ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(deltaPct).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function SkeletonCard() {
  return <div className="h-24 animate-pulse rounded-lg border bg-card" />;
}

export function DashboardPage() {
  const { t } = useI18n();
  const { data, isLoading, error } = useDashboard();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {t('common.error')}
        </div>
      )}

      <Section title={t('dashboard.sectionUsers')}>
        {isLoading || !data
          ? Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} />)
          : (
            <>
              <KpiCard label={t('dashboard.totalUsers')} value={data.users.total.value} deltaPct={data.users.total.deltaPct} />
              <KpiCard label={t('dashboard.active30d')} value={data.users.active30d.value} deltaPct={data.users.active30d.deltaPct} />
              <KpiCard label={t('dashboard.newToday')} value={data.users.newToday.value} deltaPct={data.users.newToday.deltaPct} />
              <KpiCard label={t('dashboard.newThisWeek')} value={data.users.newThisWeek.value} deltaPct={data.users.newThisWeek.deltaPct} />
              <KpiCard label={t('dashboard.newThisMonth')} value={data.users.newThisMonth.value} deltaPct={data.users.newThisMonth.deltaPct} />
            </>
          )}
      </Section>

      <Section title={t('dashboard.sectionDrivers')}>
        {isLoading || !data
          ? Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
          : (
            <>
              <KpiCard label={t('dashboard.totalDrivers')} value={data.drivers.total.value} deltaPct={data.drivers.total.deltaPct} />
              <KpiCard label={t('dashboard.activeDrivers')} value={data.drivers.active.value} deltaPct={data.drivers.active.deltaPct} />
              <KpiCard label={t('dashboard.inactiveDrivers')} value={data.drivers.inactive.value} deltaPct={data.drivers.inactive.deltaPct} />
              <KpiCard label={t('dashboard.retention')} value={data.drivers.retentionPct.value} deltaPct={data.drivers.retentionPct.deltaPct} format="percent" />
            </>
          )}
      </Section>

      <Section title={t('dashboard.sectionTrips')}>
        {isLoading || !data
          ? Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
          : (
            <>
              <KpiCard label={t('dashboard.totalTrips')} value={data.trips.total.value} deltaPct={data.trips.total.deltaPct} />
              <KpiCard label={t('dashboard.today')} value={data.trips.today.value} deltaPct={data.trips.today.deltaPct} />
              <KpiCard label={t('dashboard.thisWeek')} value={data.trips.weekly.value} deltaPct={data.trips.weekly.deltaPct} />
              <KpiCard label={t('dashboard.thisMonth')} value={data.trips.monthly.value} deltaPct={data.trips.monthly.deltaPct} />
            </>
          )}
      </Section>

      <Section title={t('dashboard.sectionBusiness')}>
        {isLoading || !data
          ? Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
          : (
            <>
              <KpiCard label={t('dashboard.growthRate')} value={data.business.growthRatePct.value} deltaPct={data.business.growthRatePct.deltaPct} format="percent" />
              <KpiCard label={t('dashboard.engagement')} value={data.business.engagementRatePct.value} deltaPct={data.business.engagementRatePct.deltaPct} format="percent" />
              <KpiCard label={t('dashboard.retentionRate')} value={data.business.retentionRatePct.value} deltaPct={data.business.retentionRatePct.deltaPct} format="percent" />
              <KpiCard label={t('dashboard.conversion')} value={data.business.conversionRatePct.value} deltaPct={data.business.conversionRatePct.deltaPct} format="percent" />
            </>
          )}
      </Section>
    </div>
  );
}

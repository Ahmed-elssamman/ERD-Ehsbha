import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { useI18n } from '@/i18n';
import { AnalyticsApi } from '@/lib/api/endpoints';
import { formatDuration, formatKm, formatMoney, formatNumber } from '@/lib/format';
import { isoYearWeek } from '@/lib/time';

type AnalyticsTab = 'daily' | 'weekly' | 'monthly' | 'apps' | 'areas' | 'hours';
type WindowKey = '7d' | '30d' | '90d';

export function AnalyticsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<AnalyticsTab>('daily');

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('analytics.title')} subtitle={t('analytics.subtitle')} />

      <div className="overflow-x-auto pb-1">
        <Tabs<AnalyticsTab>
          value={tab}
          onChange={setTab}
          items={[
            { key: 'daily', label: t('analytics.tabs.daily') },
            { key: 'weekly', label: t('analytics.tabs.weekly') },
            { key: 'monthly', label: t('analytics.tabs.monthly') },
            { key: 'apps', label: t('analytics.tabs.apps') },
            { key: 'areas', label: t('analytics.tabs.areas') },
            { key: 'hours', label: t('analytics.tabs.hours') },
          ]}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'daily' ? <DailyTab /> : null}
          {tab === 'weekly' ? <WeeklyTab /> : null}
          {tab === 'monthly' ? <MonthlyTab /> : null}
          {tab === 'apps' ? <WindowedTab kind="apps" /> : null}
          {tab === 'areas' ? <WindowedTab kind="areas" /> : null}
          {tab === 'hours' ? <HoursTab /> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DailyTab() {
  const { t, locale } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'today'],
    queryFn: AnalyticsApi.today,
  });
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard label={t('dashboard.netProfit')} value={data ? formatMoney(data.netProfitPiastres, locale) : ''} loading={isLoading} />
      <SummaryCard label={t('dashboard.trips')} value={data ? formatNumber(data.tripCount, locale) : ''} loading={isLoading} />
      <SummaryCard label={t('dashboard.distance')} value={data ? `${formatKm(data.totalKmMeters, locale)} km` : ''} loading={isLoading} />
      <SummaryCard label={t('dashboard.hours')} value={data ? formatDuration(data.onlineMinutes, locale) : ''} loading={isLoading} />
      <SummaryCard label={t('dashboard.profitPerKm')} value={data ? formatMoney(data.profitPerKmPiastres, locale) : ''} loading={isLoading} />
      <SummaryCard label={t('dashboard.profitPerHour')} value={data ? formatMoney(data.profitPerHourPiastres, locale) : ''} loading={isLoading} />
      <SummaryCard label={t('trips.tripGross')} value={data ? formatMoney(data.grossPiastres, locale) : ''} loading={isLoading} />
      <SummaryCard label={t('expenses.title')} value={data ? formatMoney(data.expensePiastres, locale) : ''} loading={isLoading} />
    </div>
  );
}

function WeeklyTab() {
  const { t, locale } = useI18n();
  const { isoYear, isoWeek } = isoYearWeek(new Date());
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'weekly', isoYear, isoWeek],
    queryFn: () => AnalyticsApi.weekly(isoYear, isoWeek),
  });
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard label={t('dashboard.netProfit')} value={data ? formatMoney(data.netProfitPiastres, locale) : ''} loading={isLoading} />
      <SummaryCard label={t('dashboard.trips')} value={data ? formatNumber(data.tripCount, locale) : ''} loading={isLoading} />
      <SummaryCard label={t('dashboard.distance')} value={data && data.totalKmMeters ? `${formatKm(data.totalKmMeters, locale)} km` : '—'} loading={isLoading} />
      <SummaryCard label={t('dashboard.hours')} value={data && data.onlineMinutes != null ? formatDuration(data.onlineMinutes, locale) : '—'} loading={isLoading} />
    </div>
  );
}

function MonthlyTab() {
  const { t, locale } = useI18n();
  const now = new Date();
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'monthly', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => AnalyticsApi.monthly(now.getFullYear(), now.getMonth() + 1),
  });
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard label={t('dashboard.netProfit')} value={data ? formatMoney(data.netProfitPiastres, locale) : ''} loading={isLoading} />
      <SummaryCard label={t('dashboard.trips')} value={data ? formatNumber(data.tripCount, locale) : ''} loading={isLoading} />
      <SummaryCard label={t('dashboard.distance')} value={data && data.totalKmMeters ? `${formatKm(data.totalKmMeters, locale)} km` : '—'} loading={isLoading} />
      <SummaryCard label={t('dashboard.hours')} value={data && data.onlineMinutes != null ? formatDuration(data.onlineMinutes, locale) : '—'} loading={isLoading} />
    </div>
  );
}

function WindowSelector({ value, onChange }: { value: WindowKey; onChange: (w: WindowKey) => void }) {
  const { t } = useI18n();
  return (
    <Tabs<WindowKey>
      size="sm"
      value={value}
      onChange={onChange}
      items={[
        { key: '7d', label: t('analytics.windows.7d') },
        { key: '30d', label: t('analytics.windows.30d') },
        { key: '90d', label: t('analytics.windows.90d') },
      ]}
    />
  );
}

function WindowedTab({ kind }: { kind: 'apps' | 'areas' }) {
  const { t, locale } = useI18n();
  const [w, setW] = useState<WindowKey>('7d');
  const { data, isLoading } = useQuery<{
    windowDays: number;
    items: Array<{
      name?: string;
      appName?: string;
      color: string | null;
      netProfitPiastres: number;
      profitPerKmPiastres: number;
      tripCount: number;
    }>;
  }>({
    queryKey: ['analytics', kind, w],
    queryFn: () => (kind === 'apps' ? (AnalyticsApi.apps(w) as Promise<unknown>) : (AnalyticsApi.areas(w) as Promise<unknown>)) as Promise<{
      windowDays: number;
      items: Array<{
        name?: string;
        appName?: string;
        color: string | null;
        netProfitPiastres: number;
        profitPerKmPiastres: number;
        tripCount: number;
      }>;
    }>,
  });

  const items = data?.items ?? [];

  const chartData = items.map((it) => ({
    name: it.name ?? it.appName ?? '—',
    net: it.netProfitPiastres / 100,
    color: it.color ?? '#34D399',
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {kind === 'apps' ? t('analytics.tabs.apps') : t('analytics.tabs.areas')}
        </h2>
        <WindowSelector value={w} onChange={setW} />
      </div>
      <Card>
        <CardContent className="pt-5">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">{t('analytics.noDataPeriod')}</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="hsl(var(--border))" vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      color: 'hsl(var(--card-foreground))',
                    }}
                    formatter={(v: number) => formatMoney(Math.round(v * 100), locale)}
                    cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  />
                  <Bar dataKey="net" radius={[8, 8, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.color || '#34D399'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {items.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {items.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: it.color ?? '#34D399' }}
                      aria-hidden
                    />
                    <span className="truncate font-medium">{it.name ?? it.appName}</span>
                    <span className="text-xs text-muted-foreground">{it.tripCount} {t('analytics.trips')}</span>
                  </div>
                  <div className="text-end">
                    <p className="num-tabular text-sm font-semibold">{formatMoney(it.netProfitPiastres, locale)}</p>
                    <p className="num-tabular text-xs text-muted-foreground">
                      {formatMoney(it.profitPerKmPiastres, locale)} {t('common.perKm')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function HoursTab() {
  const { t, locale } = useI18n();
  const [w, setW] = useState<WindowKey>('7d');
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'hours', w],
    queryFn: () => AnalyticsApi.hours(w),
  });

  const items = data?.items ?? [];
  const chart = items.map((it) => ({
    name: t(`analytics.buckets.${it.bucket}`),
    net: it.netProfitPiastres / 100,
    trips: it.tripCount,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('analytics.tabs.hours')}</h2>
        <WindowSelector value={w} onChange={setW} />
      </div>
      <Card>
        <CardContent className="pt-5">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chart.every((c) => c.net === 0 && c.trips === 0) ? (
            <p className="text-center text-sm text-muted-foreground">{t('analytics.noDataPeriod')}</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="hsl(var(--border))" vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      color: 'hsl(var(--card-foreground))',
                    }}
                    formatter={(v: number) => formatMoney(Math.round(v * 100), locale)}
                    cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  />
                  <Bar dataKey="net" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p className="num-tabular mt-2 text-xl font-bold sm:text-2xl">{value || '—'}</p>
      )}
    </Card>
  );
}


import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n } from '@/i18n';
import { AnalyticsApi } from '@/lib/api/endpoints';
import { formatMoney, formatNumber } from '@/lib/format';

type WindowKey = '7d' | '30d' | '90d';

export function BestHoursPage() {
  const { t, locale } = useI18n();
  const [w, setW] = useState<WindowKey>('30d');
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'hours', w],
    queryFn: () => AnalyticsApi.hours(w),
  });

  const items = (data?.items ?? []).map((it) => ({
    bucket: it.bucket,
    label: t(`analytics.buckets.${it.bucket}`),
    netEgp: it.netProfitPiastres / 100,
    profitPerKmPiastres: it.profitPerKmPiastres,
    tripCount: it.tripCount,
  }));

  const allZero = items.every((it) => it.netEgp === 0 && it.tripCount === 0);
  const best = !allZero ? items.reduce((a, b) => (a.netEgp > b.netEgp ? a : b), items[0]) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('bestHours.title')}
        subtitle={t('bestHours.subtitle')}
        actions={
          <Tabs<WindowKey>
            size="sm"
            value={w}
            onChange={setW}
            items={[
              { key: '7d', label: t('analytics.windows.7d') },
              { key: '30d', label: t('analytics.windows.30d') },
              { key: '90d', label: t('analytics.windows.90d') },
            ]}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" aria-hidden /> {t('analytics.tabs.hours')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : allZero ? (
            <EmptyState Icon={Clock} title={t('analytics.noDataPeriod')} />
          ) : (
            <>
              {best ? (
                <p className="mb-4 text-sm text-muted-foreground">
                  🏆 <span className="font-semibold text-foreground">{best.label}</span> — {formatMoney(best.netEgp * 100, locale)} ({formatNumber(best.tripCount, locale)} {t('bestHours.trips')})
                </p>
              ) : null}
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={items} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <defs>
                      <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
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
                    <Bar dataKey="netEgp" radius={[8, 8, 0, 0]} fill="url(#hourFill)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((it) => (
                  <li key={it.bucket} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                    <span className="font-medium">{it.label}</span>
                    <div className="text-end">
                      <span className="num-tabular font-semibold">{formatMoney(it.netEgp * 100, locale)}</span>
                      <span className="num-tabular ms-2 text-xs text-muted-foreground">
                        {formatMoney(it.profitPerKmPiastres, locale)} {t('common.perKm')}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

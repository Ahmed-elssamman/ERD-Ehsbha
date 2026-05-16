import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { KpiTile } from '@/ui/KpiTile';
import { Analytics } from '@/api/endpoints';
import { formatHours, formatKm, formatMoney, formatPercent } from '@/lib/format';
import { getLocale, t } from '@/i18n';

type Tab = 'daily' | 'weekly' | 'monthly' | 'apps' | 'areas' | 'hours';

function isoYearWeek(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return {
    isoYear: date.getUTCFullYear(),
    isoWeek: Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7),
  };
}

export default function AnalyticsScreen() {
  const [tab, setTab] = useState<Tab>('daily');
  const locale = getLocale();
  const now = new Date();
  const yw = isoYearWeek(now);

  const dailyQ = useQuery({ queryKey: ['analytics', 'today'], queryFn: () => Analytics.today() });
  const weeklyQ = useQuery({ queryKey: ['analytics', 'weekly', yw], queryFn: () => Analytics.weekly(yw.isoYear, yw.isoWeek) });
  const monthlyQ = useQuery({
    queryKey: ['analytics', 'monthly', now.getUTCFullYear(), now.getUTCMonth() + 1],
    queryFn: () => Analytics.monthly(now.getUTCFullYear(), now.getUTCMonth() + 1),
  });
  const appsQ = useQuery({ queryKey: ['analytics', 'apps', '7d'], queryFn: () => Analytics.apps('7d') });
  const areasQ = useQuery({ queryKey: ['analytics', 'areas', '7d'], queryFn: () => Analytics.areas('7d') });
  const hoursQ = useQuery({ queryKey: ['analytics', 'hours', '7d'], queryFn: () => Analytics.hours('7d') });
  const forecastQ = useQuery({ queryKey: ['analytics', 'forecast'], queryFn: () => Analytics.forecast() });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'daily', label: t('analytics.daily') },
    { key: 'weekly', label: t('analytics.weekly') },
    { key: 'monthly', label: t('analytics.monthly') },
    { key: 'apps', label: t('analytics.apps') },
    { key: 'areas', label: t('analytics.areas') },
    { key: 'hours', label: t('analytics.hours') },
  ];

  return (
    <Screen>
      <Header title={t('analytics.title')} />
      <View className="flex-row gap-2 mb-4 flex-wrap">
        {tabs.map((tt) => (
          <Pressable
            key={tt.key}
            onPress={() => setTab(tt.key)}
            className={`px-4 h-9 rounded-full items-center justify-center ${tab === tt.key ? 'bg-accent' : 'bg-surface border border-border'}`}
          >
            <Text className={`text-sm font-medium ${tab === tt.key ? 'text-bg' : 'text-text'}`}>{tt.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'daily' && <AggView data={dailyQ.data} loading={dailyQ.isLoading} locale={locale} />}
      {tab === 'weekly' && <AggView data={weeklyQ.data} loading={weeklyQ.isLoading} locale={locale} />}
      {tab === 'monthly' && (
        <View>
          <AggView data={monthlyQ.data} loading={monthlyQ.isLoading} locale={locale} />
          {forecastQ.data && (
            <Card className="mt-3">
              <Text className="text-textMuted text-xs mb-1">{t('analytics.forecast')}</Text>
              <Text className="text-text text-2xl font-bold">{formatMoney(forecastQ.data.forecastNetPiastres, locale)}</Text>
              <Text className="text-textMuted text-xs mt-1">
                {t('analytics.remainingDays', { value: forecastQ.data.elapsedDays, total: forecastQ.data.totalDays })}
              </Text>
            </Card>
          )}
        </View>
      )}
      {tab === 'apps' && <AppsList data={appsQ.data?.items ?? []} loading={appsQ.isLoading} locale={locale} />}
      {tab === 'areas' && <AreasList data={areasQ.data?.items ?? []} loading={areasQ.isLoading} locale={locale} />}
      {tab === 'hours' && <HoursList data={hoursQ.data?.items ?? []} loading={hoursQ.isLoading} locale={locale} />}
    </Screen>
  );
}

function AggView({ data, loading, locale }: { data: any; loading: boolean; locale: 'ar' | 'en' }) {
  if (loading) return <ActivityIndicator color="#34D399" />;
  if (!data) return <Text className="text-textMuted text-sm">{t('home.noTrips')}</Text>;
  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <KpiTile label={t('home.todayProfit')} value={formatMoney(data.netProfitPiastres ?? 0, locale)} />
        <KpiTile label={t('analytics.profitPerKm')} value={formatMoney(data.profitPerKmPiastres ?? 0, locale)} />
      </View>
      <View className="flex-row gap-3">
        <KpiTile label={t('analytics.profitPerHour')} value={formatMoney(data.profitPerHourPiastres ?? 0, locale)} />
        <KpiTile label={t('analytics.emptyKm')} value={formatPercent(data.emptyRatioBp ?? 0, locale)} />
      </View>
      <View className="flex-row gap-3">
        <KpiTile label={t('home.todayKm')} value={formatKm(data.totalKmMeters ?? 0)} />
        <KpiTile label={t('home.todayHours')} value={formatHours(data.onlineMinutes ?? 0, locale)} />
      </View>
    </View>
  );
}

function AppsList({ data, loading, locale }: { data: any[]; loading: boolean; locale: 'ar' | 'en' }) {
  if (loading) return <ActivityIndicator color="#34D399" />;
  if (data.length === 0) return <Text className="text-textMuted text-sm">{t('home.noTrips')}</Text>;
  return (
    <View className="gap-2">
      {data.map((a) => (
        <Card key={a.driverAppId} className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-text font-bold">{a.appName}</Text>
            <Text className="text-textMuted text-xs mt-1">
              {a.tripCount} {t('analytics.tripUnit')} · {formatKm(a.totalKmMeters)} · {formatHours(a.onlineMinutes, locale)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-accent font-bold">{formatMoney(a.netProfitPiastres, locale)}</Text>
            <Text className="text-textMuted text-xs mt-1">{formatMoney(a.profitPerHourPiastres, locale)}/{t('analytics.hourShort')}</Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

function AreasList({ data, loading, locale }: { data: any[]; loading: boolean; locale: 'ar' | 'en' }) {
  if (loading) return <ActivityIndicator color="#34D399" />;
  if (data.length === 0) return <Text className="text-textMuted text-sm">{t('home.noTrips')}</Text>;
  return (
    <View className="gap-2">
      {data.map((a) => (
        <Card key={a.areaId} className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View style={{ width: 8, height: 32, borderRadius: 4, backgroundColor: a.color ?? '#60A5FA' }} />
            <View>
              <Text className="text-text font-bold">{a.name}</Text>
              <Text className="text-textMuted text-xs mt-1">{a.tripCount} · {formatKm(a.totalKmMeters)}</Text>
            </View>
          </View>
          <Text className="text-accent font-bold">{formatMoney(a.netProfitPiastres, locale)}</Text>
        </Card>
      ))}
    </View>
  );
}

function HoursList({ data, loading, locale }: { data: any[]; loading: boolean; locale: 'ar' | 'en' }) {
  if (loading) return <ActivityIndicator color="#34D399" />;
  const max = Math.max(1, ...data.map((d) => d.netProfitPiastres));
  return (
    <View className="gap-3">
      {data.map((d) => (
        <View key={d.bucket}>
          <View className="flex-row justify-between mb-1">
            <Text className="text-text text-sm">{t(`analytics.hourBuckets.${d.bucket}`)}</Text>
            <Text className="text-text font-bold">{formatMoney(d.netProfitPiastres, locale)}</Text>
          </View>
          <View className="h-2 bg-surface rounded-full overflow-hidden">
            <View style={{ width: `${(d.netProfitPiastres / max) * 100}%`, backgroundColor: '#34D399', height: '100%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

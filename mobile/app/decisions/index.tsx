import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { DecisionCard } from '@/ui/DecisionCard';
import { EmptyState } from '@/ui/EmptyState';
import { Analytics, Recommendations } from '@/api/endpoints';
import { formatHours, formatKm, formatMoney, formatPercent } from '@/lib/format';
import { getLocale, t } from '@/i18n';

const HOUR_TONES: Record<string, 'earn' | 'protect' | 'goal' | 'neutral'> = {
  best_app_window: 'earn',
  empty_km_high: 'earn',
  goal_lag: 'goal',
  maintenance_imminent: 'protect',
  fatigue_high: 'protect',
  fuel_efficiency_drop: 'protect',
  best_day_of_week: 'earn',
};

export default function DecisionsScreen() {
  const locale = getLocale();
  const todayQ = useQuery({ queryKey: ['decisions', 'today'], queryFn: () => Recommendations.today() });
  const allQ = useQuery({ queryKey: ['recommendations'], queryFn: () => Recommendations.list() });
  const apps7Q = useQuery({ queryKey: ['analytics', 'apps', '7d'], queryFn: () => Analytics.apps('7d') });
  const apps30Q = useQuery({ queryKey: ['analytics', 'apps', '30d'], queryFn: () => Analytics.apps('30d') });
  const hoursQ = useQuery({ queryKey: ['analytics', 'hours', '7d'], queryFn: () => Analytics.hours('7d') });
  const forecastQ = useQuery({ queryKey: ['analytics', 'forecast'], queryFn: () => Analytics.forecast() });
  const dailyQ = useQuery({ queryKey: ['analytics', 'today'], queryFn: () => Analytics.today() });

  const today = todayQ.data ?? [];
  const all = allQ.data ?? [];
  const apps7 = apps7Q.data?.items ?? [];
  const apps30 = apps30Q.data?.items ?? [];
  const hours = hoursQ.data?.items ?? [];
  const forecast = forecastQ.data;
  const daily = dailyQ.data;

  // Best apps (this week, by profit/hr, min 60 min online)
  const bestApps = [...apps7]
    .filter((a) => a.onlineMinutes >= 60)
    .sort((a, b) => b.profitPerHourPiastres - a.profitPerHourPiastres);

  // Best hour buckets (this week, by profit total)
  const bestHours = [...hours]
    .filter((h) => h.tripCount > 0)
    .sort((a, b) => b.netProfitPiastres - a.netProfitPiastres);

  // Weak hour buckets
  const weakHours = [...hours]
    .filter((h) => h.tripCount > 0)
    .sort((a, b) => a.netProfitPiastres - b.netProfitPiastres);

  // Trend: today's net vs 7-day avg
  const sevenDayAvg = apps7.length
    ? Math.round(apps7.reduce((s: number, a: any) => s + a.netProfitPiastres, 0) / 7)
    : 0;
  const todayNet = daily?.netProfitPiastres ?? 0;
  const trendDelta = sevenDayAvg > 0 ? Math.round(((todayNet - sevenDayAvg) / sevenDayAvg) * 100) : 0;

  const isLoading = todayQ.isLoading && apps7Q.isLoading;

  return (
    <Screen>
      <Header title={t('decisions.title')} back subtitle={t('decisions.intro')} />

      {isLoading ? (
        <View className="py-10 items-center">
          <ActivityIndicator color="#34D399" />
        </View>
      ) : (
        <View className="gap-6">
          {/* Today's primary decision cards */}
          <Section title={t('decisions.todayCards')}>
            {today.length === 0 ? (
              <EmptyState title={t('decisions.empty')} />
            ) : (
              <View className="gap-2.5">
                {today.map((d: any) => (
                  <DecisionCard
                    key={d.id}
                    title={d.title}
                    body={d.body}
                    tone={HOUR_TONES[d.type] ?? 'neutral'}
                  />
                ))}
              </View>
            )}
          </Section>

          {/* Best apps with reasoning */}
          {bestApps.length > 0 ? (
            <Section title={t('decisions.bestApps')}>
              <View className="gap-2">
                {bestApps.slice(0, 3).map((a, idx) => {
                  const next = bestApps[idx + 1];
                  const lift = next && next.profitPerHourPiastres > 0
                    ? Math.round(((a.profitPerHourPiastres - next.profitPerHourPiastres) / next.profitPerHourPiastres) * 100)
                    : 0;
                  return (
                    <Card key={a.driverAppId}>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3">
                          <Badge num={idx + 1} />
                          <Text className="text-text font-bold">{a.appName}</Text>
                        </View>
                        <Text className="text-accent font-bold">
                          {formatMoney(a.profitPerHourPiastres, locale)}/{t('analytics.hourShort')}
                        </Text>
                      </View>
                      <Text className="text-textMuted text-xs mt-2">
                        {t('decisions.reasonLabel')}: {a.tripCount} {t('analytics.tripUnit')} · {formatHours(a.onlineMinutes, locale)} · {formatMoney(a.netProfitPiastres, locale)} {locale === 'ar' ? 'صافي' : 'net'}
                        {lift > 0 && next ? ` · +${lift}% ${locale === 'ar' ? 'مقارنة بـ' : 'vs'} ${next.appName}` : ''}
                      </Text>
                    </Card>
                  );
                })}
              </View>
            </Section>
          ) : null}

          {/* Best hours bucket with reasoning */}
          {bestHours.length > 0 ? (
            <Section title={t('decisions.bestHours')}>
              <View className="gap-2">
                {bestHours.slice(0, 2).map((h, idx) => (
                  <Card key={h.bucket}>
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-3">
                        <Badge num={idx + 1} />
                        <Text className="text-text font-bold">{t(`analytics.hourBuckets.${h.bucket}`)}</Text>
                      </View>
                      <Text className="text-accent font-bold">{formatMoney(h.netProfitPiastres, locale)}</Text>
                    </View>
                    <Text className="text-textMuted text-xs">
                      {t('decisions.reasonLabel')}: {h.tripCount} {t('analytics.tripUnit')} · {formatKm(h.totalKmMeters)} · {formatMoney(h.profitPerKmPiastres, locale)}/{t('analytics.kmShort')}
                    </Text>
                  </Card>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Weak periods */}
          {weakHours.length > 0 && weakHours[0].bucket !== bestHours[0]?.bucket ? (
            <Section title={t('decisions.weakPeriods')}>
              <Card>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-text font-bold">{t(`analytics.hourBuckets.${weakHours[0].bucket}`)}</Text>
                  <Text className="text-warn font-bold">{formatMoney(weakHours[0].netProfitPiastres, locale)}</Text>
                </View>
                <Text className="text-textMuted text-xs">
                  {weakHours[0].tripCount} {t('analytics.tripUnit')} · {formatMoney(weakHours[0].profitPerKmPiastres, locale)}/{t('analytics.kmShort')}
                </Text>
              </Card>
            </Section>
          ) : null}

          {/* Profit trend */}
          {sevenDayAvg > 0 ? (
            <Section title={t('decisions.profitTrends')}>
              <Card>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-text font-bold">{t('home.todayProfit')}</Text>
                  <Text className={`font-bold ${trendDelta > 0 ? 'text-accent' : trendDelta < 0 ? 'text-danger' : 'text-textMuted'}`}>
                    {trendDelta > 0 ? '↑' : trendDelta < 0 ? '↓' : '·'} {Math.abs(trendDelta)}%
                  </Text>
                </View>
                <Text className="text-textMuted text-xs">
                  {formatMoney(todayNet, locale)} {locale === 'ar' ? 'مقارنةً بمتوسط آخر 7 أيام' : 'vs 7-day average'} {formatMoney(sevenDayAvg, locale)}
                </Text>
              </Card>
            </Section>
          ) : null}

          {/* Goal status */}
          {forecast ? (
            <Section title={t('analytics.forecast')}>
              <Card>
                <Text className="text-textMuted text-xs mb-1">
                  {t('analytics.remainingDays', { value: forecast.elapsedDays, total: forecast.totalDays })}
                </Text>
                <Text className="text-text text-2xl font-bold">{formatMoney(forecast.forecastNetPiastres, locale)}</Text>
                <Text className="text-textMuted text-xs mt-1">
                  {locale === 'ar' ? 'حالياً:' : 'So far:'} {formatMoney(forecast.currentNetPiastres, locale)}
                </Text>
              </Card>
            </Section>
          ) : null}

          {/* All active recommendations */}
          {all.length > 0 ? (
            <Section title={t('decisions.operationalInsights')}>
              <View className="gap-2.5">
                {all.map((d: any) => (
                  <DecisionCard
                    key={d.id}
                    title={d.title}
                    body={d.body}
                    tone={HOUR_TONES[d.type] ?? 'neutral'}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          {/* App comparison summary (30d view) */}
          {apps30.length > 1 ? (
            <Section title={`${t('decisions.bestApps')} · 30d`}>
              <View className="gap-2">
                {apps30.slice(0, 5).map((a: any) => (
                  <View key={a.driverAppId} className="flex-row items-center justify-between bg-surface border border-border rounded-xl px-4 py-3">
                    <Text className="text-text">{a.appName}</Text>
                    <View className="flex-row gap-3">
                      <Text className="text-textMuted text-xs">
                        {formatMoney(a.profitPerKmPiastres, locale)}/{t('analytics.kmShort')}
                      </Text>
                      <Text className="text-accent font-bold">
                        {formatMoney(a.profitPerHourPiastres, locale)}/{t('analytics.hourShort')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-text font-bold text-base mb-2.5">{title}</Text>
      {children}
    </View>
  );
}

function Badge({ num }: { num: number }) {
  return (
    <View className="w-6 h-6 rounded-full bg-accent items-center justify-center">
      <Text className="text-bg font-bold text-xs">{num}</Text>
    </View>
  );
}

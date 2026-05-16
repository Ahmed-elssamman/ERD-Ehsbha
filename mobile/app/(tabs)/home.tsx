import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { KpiTile } from '@/ui/KpiTile';
import { DecisionCard } from '@/ui/DecisionCard';
import { Button } from '@/ui/Button';
import { TripRow } from '@/ui/TripRow';
import { EmptyState } from '@/ui/EmptyState';
import { Analytics, Recommendations, Score, Trips } from '@/api/endpoints';
import { formatHours, formatKm, formatMoney } from '@/lib/format';
import { getLocale, t } from '@/i18n';
import { useNetwork } from '@/stores/network.store';

export default function HomeScreen() {
  const router = useRouter();
  const locale = getLocale();
  const pending = useNetwork((s) => s.pendingMutations);

  const todayQ = useQuery({ queryKey: ['analytics', 'today'], queryFn: () => Analytics.today(), staleTime: 60_000 });
  const decisionsQ = useQuery({ queryKey: ['decisions', 'today'], queryFn: () => Recommendations.today(), staleTime: 5 * 60_000 });
  const scoreQ = useQuery({ queryKey: ['score', 'today'], queryFn: () => Score.today(), staleTime: 60_000 });
  const tripsQ = useQuery({
    queryKey: ['trips', 'list', { limit: 5 }],
    queryFn: () => Trips.list({ limit: 5 }),
    staleTime: 30_000,
  });

  const today = todayQ.data;
  const decisions = decisionsQ.data ?? [];
  const score = scoreQ.data;
  const trips = tripsQ.data?.items ?? [];

  return (
    <Screen>
      <Header
        title={t('home.today')}
        subtitle={new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
          weekday: 'long', day: '2-digit', month: 'long',
        })}
        right={
          pending > 0 ? (
            <View className="px-3 py-1 rounded-full bg-warn/15">
              <Text className="text-warn text-xs">{t('common.syncing')} · {pending}</Text>
            </View>
          ) : null
        }
      />

      {todayQ.isLoading ? (
        <View className="py-6 items-center"><ActivityIndicator color="#34D399" /></View>
      ) : (
        <View className="gap-3">
          <View className="flex-row gap-3">
            <KpiTile
              label={t('home.todayProfit')}
              value={formatMoney(today?.netProfitPiastres ?? 0, locale)}
              tone={today?.netProfitPiastres > 0 ? 'positive' : today?.netProfitPiastres < 0 ? 'negative' : 'neutral'}
            />
            <KpiTile label={t('home.todayHours')} value={formatHours(today?.onlineMinutes ?? 0, locale)} />
          </View>
          <View className="flex-row gap-3">
            <KpiTile label={t('home.todayKm')} value={formatKm(today?.totalKmMeters ?? 0)} />
            <KpiTile label={t('home.todayTrips')} value={String(today?.tripCount ?? 0)} />
          </View>
        </View>
      )}

      {score ? (
        <View className="mt-6">
          <Pressable className="bg-surface border border-border rounded-2xl p-4 flex-row items-center justify-between">
            <View>
              <Text className="text-textMuted text-xs mb-1">{t('score.title')}</Text>
              <Text className="text-text text-3xl font-bold">{score.overall}</Text>
            </View>
            <View className="flex-row gap-4">
              <ScoreBar label={t('score.efficiency')} value={score.efficiency} />
              <ScoreBar label={t('score.profit')} value={score.profit} />
              <ScoreBar label={t('score.safety')} value={score.safety} />
            </View>
          </Pressable>
        </View>
      ) : null}

      <View className="mt-6">
        <Text className="text-text font-bold text-base mb-3">{t('home.decisions')}</Text>
        {decisions.length === 0 ? (
          <Text className="text-textMuted text-sm">{t('home.emptyDecisions')}</Text>
        ) : (
          <View className="gap-2.5">
            {decisions.map((d: any) => (
              <DecisionCard
                key={d.id}
                title={d.title}
                body={d.body}
                tone={
                  d.type.includes('app') || d.type.includes('empty') ? 'earn'
                  : d.type.includes('goal') ? 'goal'
                  : 'protect'
                }
              />
            ))}
          </View>
        )}
      </View>

      <View className="mt-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-text font-bold text-base">{t('home.recentTrips')}</Text>
          <Pressable onPress={() => router.push('/(tabs)/trips')}>
            <Text className="text-accent text-sm">{t('home.viewAll')}</Text>
          </Pressable>
        </View>
        {trips.length === 0 ? (
          <EmptyState
            title={t('home.noTrips')}
            action={<Button label={t('home.addFirst')} onPress={() => router.push('/trips/new')} fullWidth={false} />}
          />
        ) : (
          trips.slice(0, 5).map((trip: any) => (
            <TripRow key={trip.id} trip={trip} onPress={() => router.push(`/trips/${trip.id}` as any)} />
          ))
        )}
      </View>

      <View className="mt-4">
        <Button label={t('home.addTrip')} onPress={() => router.push('/trips/new')} />
      </View>
    </Screen>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <View className="items-center">
      <View className="w-1.5 h-10 rounded-full bg-surface2 overflow-hidden justify-end">
        <View style={{ height: `${value}%`, backgroundColor: '#34D399' }} />
      </View>
      <Text className="text-textMuted text-[10px] mt-1">{label}</Text>
    </View>
  );
}

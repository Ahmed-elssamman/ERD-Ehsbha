import React from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { TripRow } from '@/ui/TripRow';
import { EmptyState } from '@/ui/EmptyState';
import { Button } from '@/ui/Button';
import { Apps, Areas, Trips } from '@/api/endpoints';
import { t } from '@/i18n';

export default function TripsScreen() {
  const router = useRouter();
  const tripsQ = useQuery({ queryKey: ['trips', 'list', { limit: 50 }], queryFn: () => Trips.list({ limit: 50 }) });
  const appsQ = useQuery({ queryKey: ['apps', 'me'], queryFn: () => Apps.mine() });
  const areasQ = useQuery({ queryKey: ['areas'], queryFn: () => Areas.list() });

  const appMap = new Map<string, string>();
  for (const a of appsQ.data ?? []) appMap.set(a.id, a.customName ?? a.appSource?.name ?? '');
  const areaMap = new Map<string, string>();
  for (const a of areasQ.data ?? []) areaMap.set(a.id, a.name);

  const items = tripsQ.data?.items ?? [];

  return (
    <Screen scrollable={false}>
      <Header
        title={t('tabs.trips')}
        right={
          <Pressable onPress={() => router.push('/trips/new')} hitSlop={12}>
            <View className="w-9 h-9 rounded-full bg-accent items-center justify-center">
              <Text className="text-bg text-lg font-bold">+</Text>
            </View>
          </Pressable>
        }
      />
      {tripsQ.isLoading ? (
        <View className="py-10 items-center"><ActivityIndicator color="#34D399" /></View>
      ) : items.length === 0 ? (
        <EmptyState
          title={t('home.noTrips')}
          action={<Button label={t('home.addFirst')} onPress={() => router.push('/trips/new')} fullWidth={false} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }) => (
            <TripRow
              trip={item}
              appName={appMap.get(item.driverAppId)}
              areaName={item.areaId ? areaMap.get(item.areaId) : undefined}
              onPress={() => router.push(`/trips/${item.id}` as any)}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-1" />}
          contentContainerStyle={{ paddingBottom: 24 }}
          removeClippedSubviews
          windowSize={5}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
        />
      )}
    </Screen>
  );
}

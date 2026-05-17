import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { TripRow } from '@/ui/TripRow';
import { EmptyState } from '@/ui/EmptyState';
import { Button } from '@/ui/Button';
import { FilterSheet, FilterValue } from '@/ui/FilterSheet';
import { Pill } from '@/ui/Pill';
import { Apps, Areas, Trips, Vehicles } from '@/api/endpoints';
import { t } from '@/i18n';
import { go, ROUTES } from '@/constants/routes';

export default function TripsScreen(): React.ReactElement {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterValue>({});
  const [filterOpen, setFilterOpen] = useState(false);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (filter.range?.from) p.from = filter.range.from.toISOString();
    if (filter.range?.to) p.to = filter.range.to.toISOString();
    if (filter.appId) p.appId = filter.appId;
    if (filter.areaId) p.areaId = filter.areaId;
    return p;
  }, [filter]);

  const tripsQ = useQuery({
    queryKey: ['trips', 'list', { limit: 50, ...queryParams }],
    queryFn: () => Trips.list({ limit: 50, ...queryParams }),
  });
  const appsQ = useQuery({ queryKey: ['apps', 'me'], queryFn: () => Apps.mine() });
  const areasQ = useQuery({ queryKey: ['areas'], queryFn: () => Areas.list() });
  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: () => Vehicles.list() });

  const appMap = new Map<string, string>();
  for (const a of appsQ.data ?? []) appMap.set(a.id, a.customName ?? a.appSource?.name ?? '');
  const areaMap = new Map<string, string>();
  for (const a of areasQ.data ?? []) areaMap.set(a.id, a.name);

  const items = tripsQ.data?.items ?? [];

  const activeFilterCount =
    (filter.range ? 1 : 0) +
    (filter.appId ? 1 : 0) +
    (filter.areaId ? 1 : 0) +
    (filter.vehicleId ? 1 : 0);

  return (
    <Screen scrollable={false}>
      <Header
        title={t('tabs.trips')}
        right={
          <View className="flex-row items-center gap-2">
            <Pressable onPress={() => setFilterOpen(true)} hitSlop={8}>
              <View className="h-9 px-3 rounded-full bg-surface border border-border items-center justify-center flex-row gap-1.5">
                <Text className="text-text text-sm">{t('common.filter')}</Text>
                {activeFilterCount > 0 ? <Pill label={String(activeFilterCount)} tone="accent" /> : null}
              </View>
            </Pressable>
            <Pressable onPress={() => router.push(go(ROUTES.TRIP_NEW))} hitSlop={12}>
              <View className="w-9 h-9 rounded-full bg-accent items-center justify-center">
                <Text className="text-bg text-lg font-bold">+</Text>
              </View>
            </Pressable>
          </View>
        }
      />
      {tripsQ.isLoading ? (
        <View className="py-10 items-center"><ActivityIndicator color="#34D399" /></View>
      ) : items.length === 0 ? (
        <EmptyState
          title={activeFilterCount > 0 ? t('analytics.noDataForPeriod') : t('home.noTrips')}
          action={
            activeFilterCount === 0 ? (
              <Button label={t('home.addFirst')} onPress={() => router.push(go(ROUTES.TRIP_NEW))} fullWidth={false} />
            ) : (
              <Button label={t('filters.clear')} tone="tonal" onPress={() => setFilter({})} fullWidth={false} />
            )
          }
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
              onPress={() => router.push(go(ROUTES.TRIP_DETAIL, { id: item.id }))}
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

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filter}
        onApply={setFilter}
        apps={(appsQ.data ?? []).map((a: any) => ({
          id: a.id,
          label: a.customName ?? a.appSource?.name,
          color: a.color,
        }))}
        areas={(areasQ.data ?? []).map((a: any) => ({ id: a.id, label: a.name, color: a.color }))}
        vehicles={(vehiclesQ.data ?? []).map((v: any) => ({
          id: v.id,
          label: `${v.make ?? ''} ${v.model ?? ''}`.trim() || v.type,
        }))}
      />
    </Screen>
  );
}

import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Pill } from '@/ui/Pill';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Maintenance, Vehicles } from '@/api/endpoints';
import { formatKm, formatMoney } from '@/lib/format';
import { getLocale, t } from '@/i18n';

type Status = 'GREEN' | 'AMBER' | 'RED' | 'OVERDUE';

const STATUS_TONE: Record<Status, 'success' | 'warn' | 'danger' | 'default'> = {
  GREEN: 'success',
  AMBER: 'warn',
  RED: 'danger',
  OVERDUE: 'danger',
};

export default function MaintenanceHubScreen() {
  const router = useRouter();
  const locale = getLocale();

  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: () => Vehicles.list() });
  const vehicle = (vehiclesQ.data ?? []).find((v: any) => v.isActive) ?? (vehiclesQ.data ?? [])[0];

  const riskQ = useQuery({
    queryKey: ['maintenance', 'risk', vehicle?.id],
    queryFn: () => Maintenance.risk(vehicle!.id),
    enabled: !!vehicle?.id,
  });

  const recordsQ = useQuery({
    queryKey: ['maintenance', 'records', vehicle?.id],
    queryFn: () => Maintenance.records(vehicle!.id),
    enabled: !!vehicle?.id,
  });

  const risk = riskQ.data ?? [];
  const records = recordsQ.data ?? [];

  const totalSpend = useMemo(
    () => records.reduce((s: number, r: any) => s + (r.costPiastres ?? 0), 0),
    [records],
  );

  const thisMonthSpend = useMemo(() => {
    const now = new Date();
    return records
      .filter((r: any) => {
        const d = new Date(r.performedAt);
        return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
      })
      .reduce((s: number, r: any) => s + (r.costPiastres ?? 0), 0);
  }, [records]);

  if (!vehicle) {
    return (
      <Screen>
        <Header title={t('maintenance.hub')} back />
        <EmptyState title={t('profile.vehicles')} body={locale === 'ar' ? 'ضيف عربية الأول من البروفايل' : 'Add a vehicle first from Profile'} />
      </Screen>
    );
  }

  const overdueCount = risk.filter((r: any) => r.status === 'OVERDUE').length;
  const redCount = risk.filter((r: any) => r.status === 'RED').length;

  return (
    <Screen>
      <Header
        title={t('maintenance.hub')}
        back
        subtitle={`${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() || vehicle.type}
        right={
          <Pressable
            onPress={() => router.push('/maintenance/new')}
            hitSlop={12}
          >
            <View className="w-9 h-9 rounded-full bg-accent items-center justify-center">
              <Text className="text-bg text-lg font-bold">+</Text>
            </View>
          </Pressable>
        }
      />

      {/* Summary cards */}
      <View className="flex-row gap-3 mb-4">
        <Card className="flex-1">
          <Text className="text-textMuted text-xs mb-1">{t('maintenance.thisMonthCost')}</Text>
          <Text className="text-text text-xl font-bold">{formatMoney(thisMonthSpend, locale)}</Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-textMuted text-xs mb-1">{t('maintenance.totals')}</Text>
          <Text className="text-text text-xl font-bold">{formatMoney(totalSpend, locale)}</Text>
        </Card>
      </View>

      {/* Cost intelligence link */}
      <Pressable onPress={() => router.push('/maintenance/costs' as any)} className="mb-4">
        <Card>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-text font-bold">{t('vehicleCosts.title')}</Text>
              <Text className="text-textMuted text-xs mt-1">{t('vehicleCosts.subtitle')}</Text>
            </View>
            <Text className="text-accent text-lg">›</Text>
          </View>
        </Card>
      </Pressable>

      {/* Alerts */}
      {overdueCount + redCount > 0 ? (
        <Card className="mb-4 border-danger/40 bg-danger/10">
          <Text className="text-danger font-bold mb-1">
            ⚠ {overdueCount > 0 ? t('maintenance.alertOverdue') : t('maintenance.alertSoon')}
          </Text>
          <Text className="text-textMuted text-xs">
            {overdueCount > 0
              ? `${overdueCount} ${t('maintenance.status.OVERDUE')}`
              : `${redCount} ${t('maintenance.status.RED')}`}
          </Text>
        </Card>
      ) : null}

      {/* Risk list */}
      <Text className="text-text font-bold text-base mb-3">{t('maintenance.items')}</Text>
      {riskQ.isLoading ? (
        <ActivityIndicator color="#34D399" />
      ) : risk.length === 0 ? (
        <EmptyState title={t('maintenance.noItems')} />
      ) : (
        <View className="gap-2">
          {risk.map((r: any) => (
            <Card key={r.item.id}>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-text font-bold">
                  {t(`maintenance.items_catalog.${r.item.code}`) || r.item.name}
                </Text>
                <Pill label={t(`maintenance.status.${r.status as Status}`)} tone={STATUS_TONE[r.status as Status]} />
              </View>
              <View className="flex-row gap-4">
                <Text className="text-textMuted text-xs">
                  {t('maintenance.kmSince')}: {formatKm(r.kmSinceLastMeters)}
                </Text>
                {r.daysSinceLast !== null ? (
                  <Text className="text-textMuted text-xs">
                    {t('maintenance.daysSince')}: {r.daysSinceLast}
                  </Text>
                ) : null}
              </View>
              {/* Risk bar */}
              <View className="mt-2 h-1.5 bg-surface2 rounded-full overflow-hidden">
                <View
                  style={{
                    width: `${Math.min(100, Math.round(r.risk * 100))}%`,
                    backgroundColor: r.status === 'GREEN' ? '#34D399' : r.status === 'AMBER' ? '#F59E0B' : '#F87171',
                    height: '100%',
                  }}
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      <View className="mt-6">
        <Button label={t('maintenance.addRecord')} onPress={() => router.push('/maintenance/new')} />
      </View>

      {/* History */}
      {records.length > 0 ? (
        <View className="mt-6">
          <Text className="text-text font-bold text-base mb-3">{t('maintenance.history')}</Text>
          <View className="gap-2">
            {records.slice(0, 20).map((r: any) => (
              <Card key={r.id}>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-text font-bold">
                    {t(`maintenance.items_catalog.${r.maintenanceItem.code}`) || r.maintenanceItem.name}
                  </Text>
                  <Text className="text-accent font-bold">{formatMoney(r.costPiastres, locale)}</Text>
                </View>
                <Text className="text-textMuted text-xs">
                  {new Date(r.performedAt).toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB')}
                  {' · '}
                  {formatKm(Number(r.odometerMeters))}
                </Text>
                {r.notes ? <Text className="text-textMuted text-xs mt-1">{r.notes}</Text> : null}
              </Card>
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

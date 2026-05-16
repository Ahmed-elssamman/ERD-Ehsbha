import React from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Trips } from '@/api/endpoints';
import { formatHours, formatKm, formatMoney, formatTime } from '@/lib/format';
import { t, getLocale } from '@/i18n';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const locale = getLocale();

  const tripQ = useQuery({
    queryKey: ['trips', 'detail', id],
    queryFn: () => Trips.get(id!),
    enabled: !!id,
  });

  const deleteM = useMutation({
    mutationFn: () => Trips.remove(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      router.back();
    },
  });

  const trip = tripQ.data;
  if (!trip) {
    return (
      <Screen>
        <Header title={t('common.loading')} back />
      </Screen>
    );
  }

  const net = trip.grossPiastres + trip.tipPiastres - trip.commissionPiastres;
  const minutes = Math.round((new Date(trip.endedAt).getTime() - new Date(trip.startedAt).getTime()) / 60_000);

  return (
    <Screen>
      <Header title={t('trip.edit')} back />
      <Card>
        <Text className="text-textMuted text-xs">{t('home.todayProfit')}</Text>
        <Text className="text-accent text-3xl font-bold mt-1">{formatMoney(net, locale)}</Text>
        <View className="mt-4 gap-1">
          <Row label={t('trip.gross')} value={formatMoney(trip.grossPiastres, locale)} />
          <Row label={t('trip.tip')} value={formatMoney(trip.tipPiastres, locale)} />
          <Row label={t('trip.commission')} value={`-${formatMoney(trip.commissionPiastres, locale)}`} />
          <Row label={t('trip.totalKm')} value={formatKm(trip.totalKmMeters)} />
          <Row label={t('trip.paidKm')} value={formatKm(trip.paidKmMeters)} />
          <Row label={t('analytics.emptyKm')} value={formatKm(trip.emptyKmMeters)} />
          <Row label={t('trip.duration')} value={formatHours(minutes, locale)} />
          <Row label={t('trip.started')} value={formatTime(trip.startedAt, locale)} />
        </View>
      </Card>

      <View className="mt-6">
        <Button
          label={t('common.delete')}
          tone="danger"
          loading={deleteM.isPending}
          onPress={() =>
            Alert.alert(t('trip.deleteConfirm'), '', [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.delete'), style: 'destructive', onPress: () => deleteM.mutate() },
            ])
          }
        />
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-textMuted text-sm">{label}</Text>
      <Text className="text-text text-sm">{value}</Text>
    </View>
  );
}

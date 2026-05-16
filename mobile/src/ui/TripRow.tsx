import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatHours, formatKm, formatMoney, formatTime } from '@/lib/format';
import { getLocale } from '@/i18n';

interface Props {
  trip: {
    id: string;
    startedAt: string;
    endedAt: string;
    grossPiastres: number;
    tipPiastres: number;
    commissionPiastres: number;
    totalKmMeters: number;
    paidKmMeters: number;
  };
  appName?: string;
  areaName?: string;
  onPress?: () => void;
}

export function TripRow({ trip, appName, areaName, onPress }: Props) {
  const net = trip.grossPiastres + trip.tipPiastres - trip.commissionPiastres;
  const start = new Date(trip.startedAt);
  const end = new Date(trip.endedAt);
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
  const locale = getLocale();
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface border border-border rounded-2xl p-4 mb-2"
    >
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-text font-bold text-base">{formatMoney(net, locale)}</Text>
        <Text className="text-textMuted text-xs">{formatTime(start, locale)}</Text>
      </View>
      <View className="flex-row items-center gap-3">
        {appName ? <Text className="text-accentAlt text-xs">{appName}</Text> : null}
        {areaName ? <Text className="text-textMuted text-xs">· {areaName}</Text> : null}
        <Text className="text-textMuted text-xs">· {formatKm(trip.totalKmMeters)}</Text>
        <Text className="text-textMuted text-xs">· {formatHours(minutes, locale)}</Text>
      </View>
    </Pressable>
  );
}

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

function TripRowImpl({ trip, appName, areaName, onPress }: Props) {
  const locale = getLocale();
  // Derive once per render — these don't change shape across re-renders.
  const net = trip.grossPiastres + trip.tipPiastres - trip.commissionPiastres;
  const start = new Date(trip.startedAt);
  const minutes = Math.max(
    0,
    Math.round((new Date(trip.endedAt).getTime() - start.getTime()) / 60_000),
  );
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

// Trip rows render heavily in lists — memo prevents re-render when sibling rows change.
export const TripRow = React.memo(TripRowImpl, (prev, next) => {
  return (
    prev.trip.id === next.trip.id &&
    prev.trip.grossPiastres === next.trip.grossPiastres &&
    prev.trip.commissionPiastres === next.trip.commissionPiastres &&
    prev.trip.totalKmMeters === next.trip.totalKmMeters &&
    prev.appName === next.appName &&
    prev.areaName === next.areaName &&
    prev.onPress === next.onPress
  );
});

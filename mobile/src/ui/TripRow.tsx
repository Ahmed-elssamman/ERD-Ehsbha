import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatHours, formatKm, formatMoney, formatTime } from '@/lib/format';
import { getLocale, t } from '@/i18n';

export interface TripRowTrip {
  id: string;
  startedAt: string;
  endedAt: string;
  grossPiastres: number;
  tipPiastres: number;
  commissionPiastres: number;
  totalKmMeters: number;
  paidKmMeters: number;
  route?: string | null;
  tripDate?: string | null;
}

interface Props {
  trip: TripRowTrip;
  appName?: string;
  areaName?: string;
  onPress?: () => void;
  onEditRoute?: (trip: TripRowTrip) => void;
}

function TripRowImpl({ trip, appName, areaName, onPress, onEditRoute }: Props) {
  const locale = getLocale();
  const net = trip.grossPiastres + trip.tipPiastres - trip.commissionPiastres;
  const start = new Date(trip.startedAt);
  const minutes = Math.max(
    0,
    Math.round((new Date(trip.endedAt).getTime() - start.getTime()) / 60_000),
  );
  const hasRoute = !!trip.route && trip.route.trim().length > 0;
  const hasDate = !!trip.tripDate && trip.tripDate.trim().length > 0;
  const buttonLabel = hasRoute || hasDate ? t('trip.editRouteDate') : t('trip.addRouteDate');

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface border border-border rounded-2xl p-4 mb-2"
    >
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-text font-bold text-base">{formatMoney(net, locale)}</Text>
        <Text className="text-textMuted text-xs">{formatTime(start, locale)}</Text>
      </View>
      <View className="flex-row items-center gap-3 flex-wrap">
        {appName ? <Text className="text-accentAlt text-xs">{appName}</Text> : null}
        {areaName ? <Text className="text-textMuted text-xs">· {areaName}</Text> : null}
        <Text className="text-textMuted text-xs">· {formatKm(trip.totalKmMeters)}</Text>
        <Text className="text-textMuted text-xs">· {formatHours(minutes, locale)}</Text>
      </View>

      {hasRoute || hasDate ? (
        <View className="flex-row items-center gap-2 mt-2 flex-wrap">
          {hasRoute ? (
            <Text className="text-text text-xs">🛣 {trip.route}</Text>
          ) : null}
          {hasDate ? (
            <Text className="text-textMuted text-xs">📅 {trip.tripDate}</Text>
          ) : null}
        </View>
      ) : null}

      {onEditRoute ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onEditRoute(trip);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          className="mt-3 self-start h-9 px-3 rounded-full bg-accent/15 border border-accent/40 flex-row items-center justify-center"
        >
          <Text className="text-accent text-xs font-medium">+ {buttonLabel}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export const TripRow = React.memo(TripRowImpl, (prev, next) => {
  return (
    prev.trip.id === next.trip.id &&
    prev.trip.grossPiastres === next.trip.grossPiastres &&
    prev.trip.commissionPiastres === next.trip.commissionPiastres &&
    prev.trip.totalKmMeters === next.trip.totalKmMeters &&
    prev.trip.route === next.trip.route &&
    prev.trip.tripDate === next.trip.tripDate &&
    prev.appName === next.appName &&
    prev.areaName === next.areaName &&
    prev.onPress === next.onPress &&
    prev.onEditRoute === next.onEditRoute
  );
});

import React from 'react';
import { Text, View } from 'react-native';
import { Card } from './Card';

interface Props {
  label: string;
  value: string;
  trend?: number;
  tone?: 'positive' | 'negative' | 'neutral';
}

export const KpiTile = React.memo(function KpiTile({ label, value, trend, tone = 'neutral' }: Props) {
  const trendColor = tone === 'positive' ? 'text-accent' : tone === 'negative' ? 'text-danger' : 'text-textMuted';
  return (
    <Card className="flex-1">
      <Text className="text-textMuted text-xs mb-2">{label}</Text>
      <Text className="text-text text-2xl font-bold" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {trend !== undefined ? (
        <Text className={`${trendColor} text-xs mt-1`}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : ''} {Math.abs(trend)}%
        </Text>
      ) : null}
    </Card>
  );
});

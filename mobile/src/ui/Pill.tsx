import React from 'react';
import { Text, View } from 'react-native';

interface Props {
  label: string;
  tone?: 'default' | 'success' | 'warn' | 'danger' | 'accent';
  size?: 'sm' | 'md';
}

export function Pill({ label, tone = 'default', size = 'sm' }: Props) {
  const toneCls = {
    default: 'bg-surface2 text-text',
    success: 'bg-accent/15 text-accent',
    warn: 'bg-warn/15 text-warn',
    danger: 'bg-danger/15 text-danger',
    accent: 'bg-accentAlt/15 text-accentAlt',
  }[tone];
  const sizeCls = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <View className={`rounded-full ${toneCls.split(' ')[0]} ${sizeCls.split(' ')[0]} ${sizeCls.split(' ')[1]}`}>
      <Text className={`${toneCls.split(' ')[1]} ${sizeCls.split(' ')[2]} font-medium`}>{label}</Text>
    </View>
  );
}

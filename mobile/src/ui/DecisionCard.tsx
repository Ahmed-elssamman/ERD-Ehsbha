import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { t } from '@/i18n';

interface Props {
  title: string;
  body: string;
  tone?: 'earn' | 'protect' | 'goal' | 'neutral';
  onDismiss?: () => void;
}

export const DecisionCard = React.memo(function DecisionCard({ title, body, tone = 'neutral', onDismiss }: Props) {
  const accentBar = {
    earn: 'bg-accent',
    protect: 'bg-warn',
    goal: 'bg-accentAlt',
    neutral: 'bg-textMuted',
  }[tone];

  return (
    <View className="bg-surface rounded-2xl border border-border overflow-hidden flex-row">
      <View className={`w-1.5 ${accentBar}`} />
      <View className="flex-1 p-4">
        <Text className="text-text font-bold text-base mb-1">{title}</Text>
        <Text className="text-textMuted text-sm leading-5">{body}</Text>
        {onDismiss ? (
          <Pressable onPress={onDismiss} className="mt-3 self-start">
            <Text className="text-accentAlt text-sm">{t('decisions.dismiss')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

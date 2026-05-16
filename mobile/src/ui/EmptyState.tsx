import React from 'react';
import { Text, View } from 'react-native';

interface Props {
  title: string;
  body?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, body, action }: Props) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <Text className="text-text text-lg font-bold text-center mb-2">{title}</Text>
      {body ? <Text className="text-textMuted text-center text-sm mb-4">{body}</Text> : null}
      {action}
    </View>
  );
}

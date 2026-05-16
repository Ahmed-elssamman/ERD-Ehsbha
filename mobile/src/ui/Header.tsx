import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
}

export function Header({ title, subtitle, back, right }: Props) {
  const router = useRouter();
  return (
    <View className="flex-row items-center justify-between pt-2 pb-4">
      <View className="flex-row items-center gap-3">
        {back ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="w-9 h-9 rounded-full bg-surface items-center justify-center border border-border"
          >
            <Text className="text-text text-base">←</Text>
          </Pressable>
        ) : null}
        <View>
          <Text className="text-text text-2xl font-bold">{title}</Text>
          {subtitle ? <Text className="text-textMuted text-sm">{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  children: React.ReactNode;
  scrollable?: boolean;
  className?: string;
}

export function Screen({ children, scrollable = true, className }: Props) {
  const inner = (
    <View className={`flex-1 px-5 pt-2 ${className ?? ''}`}>{children}</View>
  );
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      {scrollable ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Tone = 'primary' | 'tonal' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress?: () => void;
  tone?: Tone;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  leading?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  size = 'md',
  loading,
  disabled,
  leading,
  fullWidth = true,
}: Props) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;

  const toneCls = {
    primary: 'bg-accent active:bg-accent/90',
    tonal: 'bg-surface2 active:bg-surface2/80',
    ghost: 'bg-transparent active:bg-surface2/40',
    danger: 'bg-danger active:bg-danger/90',
  }[tone];

  const textCls = {
    primary: 'text-bg',
    tonal: 'text-text',
    ghost: 'text-text',
    danger: 'text-bg',
  }[tone];

  const sizeCls = {
    sm: 'h-10 px-4',
    md: 'h-12 px-5',
    lg: 'h-14 px-6',
  }[size];

  const textSize = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' }[size];

  return (
    <Animated.View style={[style, fullWidth ? { width: '100%' } : undefined]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => (scale.value = withTiming(0.97, { duration: 90 }))}
        onPressOut={() => (scale.value = withTiming(1, { duration: 120 }))}
        disabled={isDisabled}
        className={`flex-row items-center justify-center rounded-xl ${toneCls} ${sizeCls} ${isDisabled ? 'opacity-50' : ''}`}
      >
        {loading ? (
          <ActivityIndicator color={tone === 'primary' ? '#0B0F14' : '#E8ECF1'} />
        ) : (
          <View className="flex-row items-center gap-2">
            {leading}
            <Text className={`font-bold ${textCls} ${textSize}`}>{label}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function Input({ label, error, hint, leading, trailing, ...rest }: Props) {
  return (
    <View className="w-full">
      {label ? <Text className="text-text mb-2 text-sm">{label}</Text> : null}
      <View
        className={`flex-row items-center rounded-xl bg-surface px-4 h-12 border ${error ? 'border-danger' : 'border-border'}`}
      >
        {leading}
        <TextInput
          placeholderTextColor="#8B95A7"
          selectionColor="#34D399"
          {...rest}
          className="flex-1 text-text text-base h-full"
          style={[{ textAlign: rest.textAlign ?? 'right' }, rest.style as any]}
        />
        {trailing}
      </View>
      {error ? (
        <Text className="text-danger text-xs mt-1.5">{error}</Text>
      ) : hint ? (
        <Text className="text-textMuted text-xs mt-1.5">{hint}</Text>
      ) : null}
    </View>
  );
}

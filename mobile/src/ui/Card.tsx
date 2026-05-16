import React from 'react';
import { View, ViewProps } from 'react-native';

interface Props extends ViewProps {
  children: React.ReactNode;
  tone?: 'default' | 'elevated';
}

export function Card({ children, tone = 'default', className, ...rest }: Props & { className?: string }) {
  const bg = tone === 'elevated' ? 'bg-surface2' : 'bg-surface';
  return (
    <View {...rest} className={`${bg} rounded-2xl p-4 border border-border ${className ?? ''}`}>
      {children}
    </View>
  );
}

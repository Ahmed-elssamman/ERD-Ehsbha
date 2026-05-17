import React from 'react';
import { ScrollView, Text, View } from 'react-native';

interface State { error: Error | null }

export class StartupErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try { console.error('[StartupError]', error, info.componentStack); } catch {}
  }

  render() {
    const err = this.state.error;
    if (!err) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F14', paddingTop: 64, paddingHorizontal: 20 }}>
        <Text style={{ color: '#E8ECF1', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          Startup error
        </Text>
        <Text style={{ color: '#F87171', fontSize: 14, marginBottom: 16 }}>
          {err.name}: {err.message}
        </Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 80 }}>
          <Text selectable style={{ color: '#8B95A7', fontSize: 11, fontFamily: 'monospace' }}>
            {String(err.stack ?? '(no stack)')}
          </Text>
        </ScrollView>
      </View>
    );
  }
}

// Surface unhandled async errors as the same crash overlay, instead of a silent
// black screen. ErrorUtils is React Native's global handler — installing this
// at module load time means promise rejections in startup effects are visible.
let pendingError: Error | null = null;
const subscribers = new Set<(e: Error) => void>();

export function installGlobalErrorHandler() {
  const GLOBAL: any = global as any;
  const eu = GLOBAL.ErrorUtils;
  if (!eu || (eu as any).__ehsbhaInstalled) return;
  const previous = eu.getGlobalHandler?.();
  eu.setGlobalHandler((e: any, isFatal?: boolean) => {
    const err = e instanceof Error ? e : new Error(String(e));
    pendingError = err;
    subscribers.forEach((cb) => { try { cb(err); } catch {} });
    try { previous?.(e, isFatal); } catch {}
  });
  (eu as any).__ehsbhaInstalled = true;
}

export function useGlobalErrorListener(onError: (e: Error) => void) {
  React.useEffect(() => {
    subscribers.add(onError);
    if (pendingError) onError(pendingError);
    return () => { subscribers.delete(onError); };
  }, [onError]);
}

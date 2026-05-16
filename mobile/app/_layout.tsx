import 'react-native-gesture-handler';
import '../global.css';

import React, { useEffect, useState } from 'react';
import { I18nManager, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/stores/auth.store';
import { useSettings } from '@/stores/settings.store';
import { useNetwork } from '@/stores/network.store';
import { startSync } from '@/offline/sync';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 2 minutes: most KPI/list data is fine to reuse this long; per-query
      // can override (e.g. analytics today uses 60s).
      staleTime: 2 * 60_000,
      gcTime: 60 * 60 * 1000,
      retry: 1,
      retryDelay: 500,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      // Don't refetch on every screen mount — only when stale.
      refetchOnMount: false,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 0,
      networkMode: 'offlineFirst',
    },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'ehsbha.query-cache.v1' });

persistQueryClient({
  queryClient,
  persister,
  maxAge: 24 * 60 * 60 * 1000,
});

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected && state.isInternetReachable !== false);
  });
});

function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === 'active');
}

export default function RootLayout() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const hydrateAuth = useAuth((s) => s.hydrate);
  const hydrateSettings = useSettings((s) => s.hydrate);
  const setOnline = useNetwork((s) => s.setOnline);

  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppStateChange);
    NetInfo.fetch().then((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false));
    return () => sub.remove();
  }, [setOnline]);

  useEffect(() => {
    (async () => {
      await Promise.all([hydrateAuth(), hydrateSettings()]);
      const locale = useSettings.getState().locale;
      if (locale === 'ar' && !I18nManager.isRTL) {
        I18nManager.allowRTL(true);
        I18nManager.forceRTL(true);
      } else if (locale === 'en' && I18nManager.isRTL) {
        I18nManager.allowRTL(false);
        I18nManager.forceRTL(false);
      }
      startSync();
      setBootstrapped(true);
    })();
  }, [hydrateAuth, hydrateSettings]);

  if (!bootstrapped) {
    return <View style={{ flex: 1, backgroundColor: '#0B0F14' }} />;
  }

  const Root = GestureHandlerRootView as unknown as React.ComponentType<{ style?: any; children?: React.ReactNode }>;
  return (
    <Root style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AuthRedirector />
          <Slot />
        </QueryClientProvider>
      </SafeAreaProvider>
    </Root>
  );
}

function AuthRedirector() {
  const segments = useSegments();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const refresh = useAuth((s) => s.refreshToken);
  const hydrated = useAuth((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !refresh && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/home');
    } else if (!user && refresh && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    }
  }, [user, refresh, hydrated, segments, router]);

  return null;
}

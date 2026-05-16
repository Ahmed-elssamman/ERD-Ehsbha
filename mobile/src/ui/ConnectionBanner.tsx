import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { api } from '@/api/client';
import { useNetwork } from '@/stores/network.store';
import { t } from '@/i18n';

/**
 * Tiny diagnostic banner shown in development when the API isn't reachable.
 * Tells the driver exactly what's happening + the URL the app is trying to hit.
 * Hidden in production builds.
 */
export function ConnectionBanner() {
  const online = useNetwork((s) => s.online);
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const apiUrl =
    (process.env.EXPO_PUBLIC_API_URL as string | undefined) ??
    (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
    'http://10.0.2.2:4000/api/v1';

  const check = async () => {
    setChecking(true);
    try {
      const r = await api.get('/health', { timeout: 4000 });
      setApiReachable(r.status === 200);
    } catch {
      setApiReachable(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void check();
  }, []);

  if (!__DEV__) return null;
  if (apiReachable === true) return null;

  return (
    <Pressable
      onPress={check}
      className="mt-3 mb-1 rounded-xl border border-warn/50 bg-warn/10 px-3 py-2"
    >
      <Text className="text-warn text-xs font-bold mb-0.5">
        {checking
          ? t('diag.checking')
          : apiReachable === false
          ? t('diag.unreachable')
          : t('diag.connecting')}
      </Text>
      <Text className="text-textMuted text-[10px]" numberOfLines={1}>
        {apiUrl}
      </Text>
      {apiReachable === false ? (
        <Text className="text-textMuted text-[10px] mt-1">
          {t('diag.hint')}
        </Text>
      ) : null}
      {!online ? (
        <Text className="text-textMuted text-[10px] mt-1">
          {t('diag.offline')}
        </Text>
      ) : null}
    </Pressable>
  );
}

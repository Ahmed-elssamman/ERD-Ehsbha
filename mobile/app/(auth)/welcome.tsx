import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/ui/Screen';
import { Button } from '@/ui/Button';
import { ConnectionBanner } from '@/ui/ConnectionBanner';
import { t } from '@/i18n';
import { go, ROUTES } from '@/constants/routes';

export default function Welcome(): React.ReactElement {
  const router = useRouter();
  return (
    <Screen scrollable={false}>
      <View className="flex-1 justify-between py-8">
        <View className="items-center mt-16">
          <View className="w-24 h-24 rounded-3xl bg-accent items-center justify-center mb-6">
            <Text className="text-bg text-4xl font-bold">ح</Text>
          </View>
          <Text className="text-text text-3xl font-bold mb-2">{t('app.name')}</Text>
          <Text className="text-textMuted text-base">{t('app.tagline')}</Text>
        </View>

        <View className="gap-3">
          <Button label={t('auth.login')} onPress={() => router.push(go(ROUTES.LOGIN))} />
          <Button label={t('auth.createAccount')} tone="tonal" onPress={() => router.push(go(ROUTES.REGISTER))} />
          <ConnectionBanner />
        </View>
      </View>
    </Screen>
  );
}

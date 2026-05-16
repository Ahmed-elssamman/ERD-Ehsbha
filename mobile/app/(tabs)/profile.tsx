import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { useAuth } from '@/stores/auth.store';
import { useSettings } from '@/stores/settings.store';
import { Auth, Driver, Goals, Vehicles } from '@/api/endpoints';
import { formatMoney } from '@/lib/format';
import { t, getLocale } from '@/i18n';
import { I18nManager } from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const refreshToken = useAuth((s) => s.refreshToken);
  const setLocaleStore = useSettings((s) => s.setLocale);
  const locale = getLocale();

  const driverQ = useQuery({ queryKey: ['driver', 'me'], queryFn: () => Driver.me() });
  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: () => Vehicles.list() });
  const goalsQ = useQuery({ queryKey: ['goals'], queryFn: () => Goals.list() });

  const onLogout = async () => {
    try {
      if (refreshToken) await Auth.logout(refreshToken);
    } catch {}
    await clear();
    router.replace('/(auth)/welcome');
  };

  const toggleLocale = async () => {
    const next = locale === 'ar' ? 'en' : 'ar';
    await setLocaleStore(next);
    Alert.alert(
      next === 'ar' ? 'تغيير اللغة' : 'Change language',
      next === 'ar' ? 'افتح التطبيق تاني علشان تظبط الاتجاه' : 'Restart the app to apply RTL change',
    );
  };

  return (
    <Screen>
      <Header title={t('tabs.profile')} />

      <Card>
        <Text className="text-text text-lg font-bold">{driverQ.data?.displayName ?? '—'}</Text>
        <Text className="text-textMuted text-sm mt-1">{user?.phone}</Text>
      </Card>

      <View className="mt-4">
        <SectionLabel label={t('profile.vehicles')} />
        {(vehiclesQ.data ?? []).map((v: any) => (
          <Card key={v.id} className="mb-2">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-text font-bold">{v.make ?? '—'} {v.model ?? ''}</Text>
                <Text className="text-textMuted text-xs mt-1">{v.type} · {v.fuelType}</Text>
              </View>
              {v.isActive && <View className="px-2 py-1 rounded-full bg-accent/15"><Text className="text-accent text-xs">●</Text></View>}
            </View>
          </Card>
        ))}
      </View>

      <View className="mt-4">
        <SectionLabel label={t('profile.goals')} />
        {(goalsQ.data ?? []).filter((g: any) => g.isActive).map((g: any) => (
          <Card key={g.id} className="mb-2">
            <Text className="text-textMuted text-xs">{g.period}</Text>
            <Text className="text-text font-bold mt-1">{formatMoney(g.targetPiastres, locale)}</Text>
          </Card>
        ))}
      </View>

      <View className="mt-4 gap-2">
        <Pressable onPress={toggleLocale}>
          <Card>
            <Text className="text-text">{locale === 'ar' ? t('profile.toggleToEn') : t('profile.toggleToAr')}</Text>
          </Card>
        </Pressable>
        <Pressable onPress={onLogout}>
          <Card>
            <Text className="text-danger">{locale === 'ar' ? 'تسجيل الخروج' : 'Log out'}</Text>
          </Card>
        </Pressable>
      </View>
    </Screen>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text className="text-textMuted text-sm mb-2 px-1">{label}</Text>;
}

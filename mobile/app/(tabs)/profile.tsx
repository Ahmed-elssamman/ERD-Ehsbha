import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Pill } from '@/ui/Pill';
import { useAuth } from '@/stores/auth.store';
import { useSettings } from '@/stores/settings.store';
import { Auth, Driver, Goals, Vehicles } from '@/api/endpoints';
import { formatMoney } from '@/lib/format';
import { t, getLocale } from '@/i18n';

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

      {/* Quick links */}
      <View className="mt-4 gap-2">
        <RowLink
          label={t('profile.maintenance')}
          icon="🔧"
          onPress={() => router.push('/maintenance' as any)}
        />
        <RowLink
          label={t('decisions.title')}
          icon="✦"
          onPress={() => router.push('/decisions' as any)}
        />
      </View>

      {/* Vehicles */}
      <View className="mt-6">
        <SectionLabel label={t('profile.vehicles')} />
        {(vehiclesQ.data ?? []).map((v: any) => (
          <Card key={v.id} className="mb-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-text font-bold">
                  {v.make || v.model ? `${v.make ?? ''} ${v.model ?? ''}`.trim() : v.type}
                </Text>
                <Text className="text-textMuted text-xs mt-1">
                  {locale === 'ar' ? (v.type === 'CAR' ? 'عربية' : 'موتوسيكل') : v.type} · {v.fuelType}
                </Text>
              </View>
              {v.isActive ? <Pill label="●" tone="success" /> : null}
            </View>
          </Card>
        ))}
      </View>

      {/* Goals */}
      <View className="mt-4">
        <SectionLabel label={t('profile.goals')} />
        {(goalsQ.data ?? []).filter((g: any) => g.isActive).length === 0 ? (
          <Card>
            <Text className="text-textMuted text-sm">{t('common.noData')}</Text>
          </Card>
        ) : (
          (goalsQ.data ?? []).filter((g: any) => g.isActive).map((g: any) => (
            <Card key={g.id} className="mb-2">
              <Text className="text-textMuted text-xs">{periodLabel(g.period, locale)}</Text>
              <Text className="text-text font-bold mt-1">{formatMoney(g.targetPiastres, locale)}</Text>
            </Card>
          ))
        )}
      </View>

      {/* Settings */}
      <View className="mt-6">
        <SectionLabel label={t('profile.settings')} />
        <View className="gap-2">
          <Pressable onPress={toggleLocale}>
            <Card>
              <View className="flex-row items-center justify-between">
                <Text className="text-text">{t('profile.language')}</Text>
                <Text className="text-textMuted text-sm">
                  {locale === 'ar' ? 'العربية' : 'English'}
                </Text>
              </View>
            </Card>
          </Pressable>
          <Pressable onPress={onLogout}>
            <Card>
              <Text className="text-danger">{t('profile.logout')}</Text>
            </Card>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text className="text-textMuted text-sm mb-2 px-1">{label}</Text>;
}

function RowLink({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Text className="text-accent text-lg">{icon}</Text>
            <Text className="text-text font-medium">{label}</Text>
          </View>
          <Text className="text-textMuted text-lg">›</Text>
        </View>
      </Card>
    </Pressable>
  );
}

function periodLabel(p: string, locale: 'ar' | 'en'): string {
  if (locale === 'ar') {
    return p === 'DAILY' ? 'يومي' : p === 'WEEKLY' ? 'أسبوعي' : 'شهري';
  }
  return p === 'DAILY' ? 'Daily' : p === 'WEEKLY' ? 'Weekly' : 'Monthly';
}

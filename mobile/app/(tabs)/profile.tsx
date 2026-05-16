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

  const vehicles = vehiclesQ.data ?? [];
  const activeGoals = (goalsQ.data ?? []).filter((g: any) => g.isActive);

  return (
    <Screen>
      <Header title={t('tabs.profile')} />

      <Card>
        <Text className="text-text text-lg font-bold">{driverQ.data?.displayName ?? '—'}</Text>
        <Text className="text-textMuted text-sm mt-1">{user?.phone}</Text>
      </Card>

      {/* Quick links */}
      <View className="mt-4 gap-2">
        <RowLink icon="🔧" label={t('maintenance.hub')} onPress={() => router.push('/maintenance' as any)} />
        <RowLink icon="💰" label={t('vehicleCosts.title')} onPress={() => router.push('/maintenance/costs' as any)} />
        <RowLink icon="✦" label={t('decisions.title')} onPress={() => router.push('/decisions' as any)} />
      </View>

      {/* Setup: vehicles, apps, areas, goals */}
      <View className="mt-6">
        <SectionLabel label={locale === 'ar' ? 'الإعدادات الأساسية' : 'Setup'} />
        <View className="gap-2">
          <SetupRow
            icon="🚗"
            label={t('vehicles.title')}
            badge={vehicles.length > 0 ? String(vehicles.length) : undefined}
            warn={vehicles.length === 0}
            onPress={() => router.push('/vehicles/new' as any)}
            secondary={
              vehicles.length === 0
                ? t('vehicles.emptyTitle')
                : vehicles.map((v: any) => v.make || t(`onboarding.type.${v.type}` as any)).join(' · ')
            }
          />
          <SetupRow
            icon="📱"
            label={t('apps.title')}
            onPress={() => router.push('/apps' as any)}
            secondary={t('apps.subtitle')}
          />
          <SetupRow
            icon="📍"
            label={t('areas.title')}
            onPress={() => router.push('/areas' as any)}
            secondary={t('areas.subtitle')}
          />
          <SetupRow
            icon="🎯"
            label={t('goals.title')}
            badge={activeGoals.length > 0 ? String(activeGoals.length) : undefined}
            onPress={() => router.push('/goals' as any)}
            secondary={
              activeGoals[0]
                ? formatMoney(activeGoals[0].targetPiastres, locale)
                : t('goals.subtitle')
            }
          />
        </View>
      </View>

      {/* Vehicles list preview (only if exist) */}
      {vehicles.length > 0 ? (
        <View className="mt-6">
          <SectionLabel label={t('profile.vehicles')} />
          {vehicles.map((v: any) => (
            <Card key={v.id} className="mb-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-text font-bold">
                    {v.make || v.model ? `${v.make ?? ''} ${v.model ?? ''}`.trim() : t(`onboarding.type.${v.type}` as any)}
                  </Text>
                  <Text className="text-textMuted text-xs mt-1">
                    {t(`onboarding.type.${v.type}` as any)} · {t(`vehicles.fuelTypes.${v.fuelType}` as any)}
                  </Text>
                </View>
                {v.isActive ? <Pill label="●" tone="success" /> : null}
              </View>
            </Card>
          ))}
          <Pressable onPress={() => router.push('/vehicles/new' as any)}>
            <Card>
              <View className="flex-row items-center justify-center">
                <Text className="text-accent font-medium">+ {t('vehicles.new')}</Text>
              </View>
            </Card>
          </Pressable>
        </View>
      ) : null}

      {/* Account section */}
      <View className="mt-6">
        <SectionLabel label={locale === 'ar' ? 'الحساب' : 'Account'} />
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

function SetupRow({
  icon,
  label,
  badge,
  warn,
  secondary,
  onPress,
}: {
  icon: string;
  label: string;
  badge?: string;
  warn?: boolean;
  secondary?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card className={warn ? 'border-warn/40 bg-warn/5' : undefined}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1">
            <Text className="text-accent text-lg">{icon}</Text>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-text font-medium">{label}</Text>
                {badge ? (
                  <View className="px-2 py-0.5 rounded-full bg-accent/15">
                    <Text className="text-accent text-xs font-bold">{badge}</Text>
                  </View>
                ) : null}
                {warn ? <Text className="text-warn text-xs">⚠</Text> : null}
              </View>
              {secondary ? (
                <Text className="text-textMuted text-xs mt-0.5" numberOfLines={1}>{secondary}</Text>
              ) : null}
            </View>
          </View>
          <Text className="text-textMuted text-lg">›</Text>
        </View>
      </Card>
    </Pressable>
  );
}

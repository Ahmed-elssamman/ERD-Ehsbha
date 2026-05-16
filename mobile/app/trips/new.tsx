import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Apps, Areas, Trips, Vehicles } from '@/api/endpoints';
import { t, getLocale } from '@/i18n';
import { kmToMeters } from '@/lib/helpers';
import { enqueue } from '@/offline/queue';
import { useNetwork } from '@/stores/network.store';
import { showErrorAlert, toUserError } from '@/lib/errors';

const Schema = z.object({
  vehicleId: z.string().min(1),
  driverAppId: z.string().min(1),
  areaId: z.string().nullable().optional(),
  grossEgp: z.coerce.number().min(0),
  tipEgp: z.coerce.number().min(0).default(0),
  totalKm: z.coerce.number().min(0),
  paidKm: z.coerce.number().min(0),
  durationMinutes: z.coerce.number().int().min(1).max(720),
});
type Form = z.infer<typeof Schema>;

export default function NewTripScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const locale = getLocale();
  const online = useNetwork((s) => s.online);

  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: () => Vehicles.list() });
  const appsQ = useQuery({ queryKey: ['apps', 'me'], queryFn: () => Apps.mine() });
  const areasQ = useQuery({ queryKey: ['areas'], queryFn: () => Areas.list() });

  const vehicles = vehiclesQ.data ?? [];
  const apps = (appsQ.data ?? []).filter((a: any) => a.enabled);
  const areas = areasQ.data ?? [];

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: {
      vehicleId: '',
      driverAppId: '',
      areaId: null,
      grossEgp: 0,
      tipEgp: 0,
      totalKm: 0,
      paidKm: 0,
      durationMinutes: 15,
    },
  });

  useEffect(() => {
    if (!watch('vehicleId') && vehicles.length > 0) {
      setValue('vehicleId', vehicles.find((v: any) => v.isActive)?.id ?? vehicles[0].id);
    }
    if (!watch('driverAppId') && apps.length > 0) setValue('driverAppId', apps[0].id);
  }, [vehicles.length, apps.length]);

  const selectedApp = useMemo(() => apps.find((a: any) => a.id === watch('driverAppId')), [apps, watch('driverAppId')]);
  const grossEgp = watch('grossEgp') ?? 0;
  const commissionPct = selectedApp ? Number(selectedApp.commissionPct) : 0;
  const commissionEgp = Math.round(grossEgp * commissionPct) / 100;
  const tipEgp = watch('tipEgp') ?? 0;
  const netEgp = Math.max(0, grossEgp + tipEgp - commissionEgp);

  const mutation = useMutation({
    mutationFn: async (input: any) => Trips.create(input),
  });

  const onSubmit = async (data: Form) => {
    if (data.paidKm > data.totalKm) {
      Alert.alert('!', locale === 'ar' ? 'كيلومترات الراكب أكبر من الإجمالي' : 'Paid km exceeds total km');
      return;
    }
    const now = new Date();
    const start = new Date(now.getTime() - data.durationMinutes * 60_000);
    const body = {
      vehicleId: data.vehicleId,
      driverAppId: data.driverAppId,
      areaId: data.areaId ?? null,
      startedAt: start.toISOString(),
      endedAt: now.toISOString(),
      grossPiastres: Math.round(data.grossEgp * 100),
      tipPiastres: Math.round(data.tipEgp * 100),
      commissionPiastres: Math.round(commissionEgp * 100),
      totalKmMeters: kmToMeters(data.totalKm),
      paidKmMeters: kmToMeters(data.paidKm),
      clientMutationId: uuidv4(),
    };

    try {
      if (online) {
        await mutation.mutateAsync(body);
      } else {
        await enqueue({ endpoint: '/trips', method: 'POST', body });
      }
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['decisions'] });
      router.back();
    } catch (err) {
      const ue = toUserError(err);
      if (ue.isNetwork) {
        // queue offline and close — driver doesn't lose the trip
        await enqueue({ endpoint: '/trips', method: 'POST', body });
        router.back();
      } else {
        showErrorAlert(err);
      }
    }
  };

  return (
    <Screen>
      <Header title={t('trip.new')} back />

      <View className="gap-4 mt-2">
        <Card>
          <Text className="text-textMuted text-xs mb-2">{t('home.todayProfit')}</Text>
          <Text className="text-accent text-3xl font-bold">
            {locale === 'ar' ? `${netEgp.toFixed(0)} ج.م` : `EGP ${netEgp.toFixed(0)}`}
          </Text>
          {commissionEgp > 0 && (
            <Text className="text-textMuted text-xs mt-1">
              {t('trip.commission')}: {commissionEgp.toFixed(0)} ({commissionPct}%)
            </Text>
          )}
        </Card>

        <Controller
          control={control}
          name="grossEgp"
          render={({ field: { value, onChange } }) => (
            <Input
              label={t('trip.gross')}
              keyboardType="numeric"
              value={String(value || '')}
              onChangeText={(v) => onChange(v.replace(/[^\d.]/g, ''))}
              error={errors.grossEgp?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="driverAppId"
          render={({ field: { value, onChange } }) => (
            <View>
              <Text className="text-text mb-2 text-sm">{t('trip.app')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {apps.map((a: any) => {
                  const active = a.id === value;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => onChange(a.id)}
                      className={`px-4 h-10 rounded-full items-center justify-center ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
                    >
                      <Text className={`text-sm font-medium ${active ? 'text-bg' : 'text-text'}`}>
                        {a.customName ?? a.appSource?.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        />

        <Controller
          control={control}
          name="areaId"
          render={({ field: { value, onChange } }) => (
            <View>
              <Text className="text-text mb-2 text-sm">{t('trip.area')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Pressable
                  onPress={() => onChange(null)}
                  className={`px-4 h-10 rounded-full items-center justify-center ${!value ? 'bg-accent' : 'bg-surface border border-border'}`}
                >
                  <Text className={`text-sm ${!value ? 'text-bg' : 'text-text'}`}>—</Text>
                </Pressable>
                {areas.map((a: any) => {
                  const active = a.id === value;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => onChange(a.id)}
                      className={`px-4 h-10 rounded-full items-center justify-center ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
                    >
                      <Text className={`text-sm ${active ? 'text-bg' : 'text-text'}`}>{a.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="totalKm"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('trip.totalKm')}
                  keyboardType="numeric"
                  value={String(value || '')}
                  onChangeText={(v) => onChange(v.replace(/[^\d.]/g, ''))}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="paidKm"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('trip.paidKm')}
                  keyboardType="numeric"
                  value={String(value || '')}
                  onChangeText={(v) => onChange(v.replace(/[^\d.]/g, ''))}
                />
              )}
            />
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="durationMinutes"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('trip.duration')}
                  keyboardType="numeric"
                  value={String(value || '')}
                  onChangeText={(v) => onChange(v.replace(/[^\d]/g, ''))}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="tipEgp"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('trip.tip')}
                  keyboardType="numeric"
                  value={String(value || '')}
                  onChangeText={(v) => onChange(v.replace(/[^\d.]/g, ''))}
                />
              )}
            />
          </View>
        </View>

        <Button label={t('common.save')} loading={mutation.isPending} onPress={handleSubmit(onSubmit)} />
      </View>
    </Screen>
  );
}

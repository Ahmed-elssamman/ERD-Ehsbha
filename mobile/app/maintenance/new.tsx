import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Maintenance, Vehicles } from '@/api/endpoints';
import { t, getLocale } from '@/i18n';
import { showErrorAlert } from '@/lib/errors';
import { normalizeNumberInput, normalizeIntInput } from '@/lib/numbers';

const Schema = z.object({
  maintenanceItemId: z.string().min(1),
  performedAt: z.coerce.date().default(() => new Date()),
  odometerKm: z.coerce.number().min(0),
  costEgp: z.coerce.number().min(0),
  notes: z.string().max(500).optional(),
});
type Form = z.infer<typeof Schema>;

export default function NewMaintenanceScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const locale = getLocale();

  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: () => Vehicles.list() });
  const itemsQ = useQuery({ queryKey: ['maintenance', 'items'], queryFn: () => Maintenance.items() });

  const vehicle = (vehiclesQ.data ?? []).find((v: any) => v.isActive) ?? (vehiclesQ.data ?? [])[0];
  const items = (itemsQ.data ?? []).filter((it: any) =>
    vehicle?.type === 'CAR' ? it.appliesToCar : it.appliesToBike,
  );

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: {
      maintenanceItemId: '',
      performedAt: new Date(),
      odometerKm: 0,
      costEgp: 0,
    },
  });

  useEffect(() => {
    if (vehicle && items.length > 0) {
      setValue('odometerKm', Math.round(Number(vehicle.odometerMeters) / 1000));
      setValue('maintenanceItemId', items[0].id);
    }
  }, [vehicle?.id, items.length]);

  const mutation = useMutation({
    mutationFn: (b: any) => Maintenance.addRecord(vehicle!.id, b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      router.back();
    },
  });

  const onSubmit = async (data: Form) => {
    if (!vehicle) return;
    try {
      await mutation.mutateAsync({
        maintenanceItemId: data.maintenanceItemId,
        performedAt: data.performedAt.toISOString(),
        odometerMeters: Math.round(data.odometerKm * 1000),
        costPiastres: Math.round(data.costEgp * 100),
        notes: data.notes ?? null,
      });
    } catch (err) {
      showErrorAlert(err);
    }
  };

  if (!vehicle) {
    return (
      <Screen>
        <Header title={t('maintenance.addRecord')} back />
        <Text className="text-textMuted text-center mt-10">{t('maintenance.noItems')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t('maintenance.addRecord')} back />
      <View className="gap-4 mt-2">
        <Controller
          control={control}
          name="maintenanceItemId"
          render={({ field: { value, onChange } }) => (
            <View>
              <Text className="text-text mb-2 text-sm">{t('maintenance.items')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {items.map((it: any) => {
                  const active = it.id === value;
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => onChange(it.id)}
                      className={`px-4 h-11 rounded-full items-center justify-center ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
                    >
                      <Text className={`text-sm font-medium ${active ? 'text-bg' : 'text-text'}`}>
                        {t(`maintenance.items_catalog.${it.code}`) !== `maintenance.items_catalog.${it.code}`
                          ? t(`maintenance.items_catalog.${it.code}`)
                          : it.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {errors.maintenanceItemId ? (
                <Text className="text-danger text-xs mt-1">{errors.maintenanceItemId.message}</Text>
              ) : null}
            </View>
          )}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="costEgp"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('maintenance.cost')}
                  keyboardType="numeric"
                  value={String(value || '')}
                  onChangeText={(v) => onChange(normalizeNumberInput(v))}
                  error={errors.costEgp?.message}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="odometerKm"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('maintenance.odometer')}
                  keyboardType="numeric"
                  value={String(value || '')}
                  onChangeText={(v) => onChange(normalizeIntInput(v))}
                  error={errors.odometerKm?.message}
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange } }) => (
            <Input
              label={t('trip.notes')}
              value={value ?? ''}
              onChangeText={onChange}
              multiline
            />
          )}
        />

        <Button label={t('common.save')} loading={mutation.isPending} onPress={handleSubmit(onSubmit)} />
      </View>
    </Screen>
  );
}

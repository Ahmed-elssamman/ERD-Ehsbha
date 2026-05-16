import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Vehicles } from '@/api/endpoints';
import { t } from '@/i18n';
import { showErrorAlert } from '@/lib/errors';
import { normalizeNumberInput, normalizeIntInput } from '@/lib/numbers';

const TypeEnum = z.enum(['CAR', 'BIKE']);
const FuelTypeEnum = z.enum(['PETROL_80', 'PETROL_92', 'PETROL_95', 'DIESEL', 'CNG', 'ELECTRIC']);

const Schema = z.object({
  type: TypeEnum,
  make: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  year: z.coerce.number().int().min(1980).max(2100).optional(),
  fuelType: FuelTypeEnum,
  tankLiters: z.coerce.number().int().min(1).max(500),
  baselineKmPerLiter: z.coerce.number().positive().max(100),
  odometerKm: z.coerce.number().int().min(0).default(0),
});
type Form = z.infer<typeof Schema>;

export default function NewVehicleScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const { control, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: {
      type: 'CAR',
      make: '',
      model: '',
      fuelType: 'PETROL_92',
      tankLiters: 45,
      baselineKmPerLiter: 12,
      odometerKm: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (body: any) => Vehicles.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      router.back();
    },
    onError: (err) => showErrorAlert(err),
  });

  const type = watch('type');

  const onSubmit = (data: Form) => {
    mutation.mutate({
      type: data.type,
      make: data.make || undefined,
      model: data.model || undefined,
      year: data.year || undefined,
      fuelType: data.fuelType,
      tankLiters: data.tankLiters,
      baselineKmPerLiter: data.baselineKmPerLiter,
      odometerMeters: Math.round(data.odometerKm * 1000),
      isActive: true,
    });
  };

  return (
    <Screen>
      <Header title={t('vehicles.new')} back subtitle={t('vehicles.newSubtitle')} />

      <View className="gap-4 mt-2">
        {/* Type picker */}
        <Controller
          control={control}
          name="type"
          render={({ field: { value, onChange } }) => (
            <View>
              <Text className="text-text mb-2 text-sm">{t('vehicles.type')}</Text>
              <View className="flex-row gap-2">
                {(['CAR', 'BIKE'] as const).map((tp) => {
                  const active = value === tp;
                  return (
                    <Pressable
                      key={tp}
                      onPress={() => onChange(tp)}
                      className={`flex-1 h-12 rounded-xl items-center justify-center ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
                    >
                      <Text className={`text-base font-bold ${active ? 'text-bg' : 'text-text'}`}>
                        {tp === 'CAR' ? '🚗 ' : '🏍 '}{t(`onboarding.type.${tp}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="make"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('vehicles.make')}
                  value={value ?? ''}
                  onChangeText={onChange}
                  placeholder="Hyundai"
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="model"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('vehicles.model')}
                  value={value ?? ''}
                  onChangeText={onChange}
                  placeholder="Verna"
                />
              )}
            />
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="year"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('vehicles.year')}
                  keyboardType="numeric"
                  value={value ? String(value) : ''}
                  onChangeText={(v) => onChange(v ? Number(normalizeIntInput(v)) : undefined)}
                  placeholder="2019"
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="tankLiters"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('vehicles.tankLiters')}
                  keyboardType="numeric"
                  value={String(value)}
                  onChangeText={(v) => onChange(Number(normalizeIntInput(v) || '0'))}
                  error={errors.tankLiters?.message}
                />
              )}
            />
          </View>
        </View>

        {/* Fuel type */}
        <Controller
          control={control}
          name="fuelType"
          render={({ field: { value, onChange } }) => (
            <View>
              <Text className="text-text mb-2 text-sm">{t('vehicles.fuelType')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {(['PETROL_80', 'PETROL_92', 'PETROL_95', 'DIESEL', 'CNG', 'ELECTRIC'] as const).map((ft) => {
                  const active = value === ft;
                  return (
                    <Pressable
                      key={ft}
                      onPress={() => onChange(ft)}
                      className={`px-4 h-11 rounded-full items-center justify-center ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
                    >
                      <Text className={`text-sm font-medium ${active ? 'text-bg' : 'text-text'}`}>
                        {t(`vehicles.fuelTypes.${ft}` as any)}
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
          name="baselineKmPerLiter"
          render={({ field: { value, onChange } }) => (
            <Input
              label={t('vehicles.baselineKmPerLiter')}
              hint={t('vehicles.baselineKmPerLiterHint')}
              keyboardType="numeric"
              value={String(value)}
              onChangeText={(v) => onChange(Number(normalizeNumberInput(v) || '0'))}
            />
          )}
        />

        <Controller
          control={control}
          name="odometerKm"
          render={({ field: { value, onChange } }) => (
            <Input
              label={t('vehicles.odometerKm')}
              hint={t('vehicles.odometerKmHint')}
              keyboardType="numeric"
              value={String(value || '')}
              onChangeText={(v) => onChange(Number(normalizeIntInput(v) || '0'))}
            />
          )}
        />

        <Button label={t('common.save')} loading={mutation.isPending} onPress={handleSubmit(onSubmit)} />
      </View>
    </Screen>
  );
}

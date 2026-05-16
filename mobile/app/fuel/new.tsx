import React, { useEffect } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
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
import { Fuel, Vehicles } from '@/api/endpoints';
import { t, getLocale } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { enqueue } from '@/offline/queue';
import { useNetwork } from '@/stores/network.store';
import { showErrorAlert, toUserError } from '@/lib/errors';

const Schema = z.object({
  vehicleId: z.string().min(1),
  liters: z.coerce.number().positive().max(500),
  pricePerLiterEgp: z.coerce.number().positive().max(200),
  odometerKm: z.coerce.number().min(0),
  isFullTank: z.boolean().default(false),
});
type Form = z.infer<typeof Schema>;

export default function NewFuelScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const locale = getLocale();
  const online = useNetwork((s) => s.online);

  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: () => Vehicles.list() });
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { vehicleId: '', liters: 0, pricePerLiterEgp: 15.25, odometerKm: 0, isFullTank: false },
  });

  useEffect(() => {
    const v = vehiclesQ.data?.find((x: any) => x.isActive) ?? vehiclesQ.data?.[0];
    if (v && !watch('vehicleId')) {
      setValue('vehicleId', v.id);
      setValue('odometerKm', Math.round(Number(v.odometerMeters) / 1000));
    }
  }, [vehiclesQ.data]);

  const total = (watch('liters') ?? 0) * (watch('pricePerLiterEgp') ?? 0);

  const mutation = useMutation({ mutationFn: (b: any) => Fuel.create(b) });

  const onSubmit = async (data: Form) => {
    const body = {
      vehicleId: data.vehicleId,
      dateTime: new Date().toISOString(),
      liters: data.liters,
      pricePerLiterPiastres: Math.round(data.pricePerLiterEgp * 100),
      totalPiastres: Math.round(data.liters * data.pricePerLiterEgp * 100),
      odometerMeters: Math.round(data.odometerKm * 1000),
      isFullTank: data.isFullTank,
      clientMutationId: uuidv4(),
    };
    try {
      if (online) await mutation.mutateAsync(body);
      else await enqueue({ endpoint: '/fuel', method: 'POST', body });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      router.back();
    } catch (err) {
      const ue = toUserError(err);
      if (ue.isNetwork) {
        await enqueue({ endpoint: '/fuel', method: 'POST', body });
        router.back();
      } else {
        showErrorAlert(err);
      }
    }
  };

  return (
    <Screen>
      <Header title={t('fuel.new')} back />
      <View className="gap-4 mt-2">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="liters"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('fuel.liters')}
                  keyboardType="numeric"
                  value={String(value || '')}
                  onChangeText={(v) => onChange(v.replace(/[^\d.]/g, ''))}
                  error={errors.liters?.message}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="pricePerLiterEgp"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('fuel.pricePerLiter')}
                  keyboardType="numeric"
                  value={String(value || '')}
                  onChangeText={(v) => onChange(v.replace(/[^\d.]/g, ''))}
                  error={errors.pricePerLiterEgp?.message}
                />
              )}
            />
          </View>
        </View>
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-textMuted text-xs mb-1">{t('fuel.total')}</Text>
          <Text className="text-text text-2xl font-bold">
            {formatMoney(Math.round(total * 100), locale)}
          </Text>
        </View>
        <Controller
          control={control}
          name="odometerKm"
          render={({ field: { value, onChange } }) => (
            <Input
              label={t('fuel.odometer')}
              keyboardType="numeric"
              value={String(value || '')}
              onChangeText={(v) => onChange(v.replace(/[^\d]/g, ''))}
              error={errors.odometerKm?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="isFullTank"
          render={({ field: { value, onChange } }) => (
            <Pressable
              onPress={() => onChange(!value)}
              className="bg-surface rounded-xl p-4 border border-border flex-row items-center justify-between"
            >
              <Text className="text-text">{t('fuel.fullTank')}</Text>
              <View className={`w-12 h-7 rounded-full ${value ? 'bg-accent' : 'bg-surface2'} items-${value ? 'end' : 'start'} justify-center px-1`}>
                <View className="w-5 h-5 rounded-full bg-bg" />
              </View>
            </Pressable>
          )}
        />
        <Button label={t('common.save')} loading={mutation.isPending} onPress={handleSubmit(onSubmit)} />
      </View>
    </Screen>
  );
}

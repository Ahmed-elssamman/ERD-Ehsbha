import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from './Card';
import { Input } from './Input';
import { Button } from './Button';
import { Odometer } from '@/api/endpoints';
import { formatKm } from '@/lib/format';
import { t, getLocale } from '@/i18n';
import { showErrorAlert } from '@/lib/errors';
import { normalizeIntInput } from '@/lib/numbers';

/**
 * Today's odometer card — shown on Home. Lets the driver log total km driven
 * today (from the vehicle's odometer) so the system can compute empty km.
 */
export function DailyOdometerCard() {
  const qc = useQueryClient();
  const locale = getLocale();
  const [open, setOpen] = useState(false);
  const [km, setKm] = useState('');

  const odoQ = useQuery({
    queryKey: ['odometer', 'today'],
    queryFn: () => Odometer.get(),
    staleTime: 60_000,
  });

  const todayKmMeters = odoQ.data?.totalKmMeters ? Number(odoQ.data.totalKmMeters) : 0;

  const mutation = useMutation({
    mutationFn: (totalKmMeters: number) => Odometer.set({ totalKmMeters }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['odometer', 'today'] });
      qc.invalidateQueries({ queryKey: ['analytics', 'today'] });
      setOpen(false);
      setKm('');
    },
    onError: (err) => showErrorAlert(err),
  });

  useEffect(() => {
    if (open && todayKmMeters > 0) setKm(String(Math.round(todayKmMeters / 1000)));
  }, [open, todayKmMeters]);

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Card>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-textMuted text-xs mb-1">{t('odometer.title')}</Text>
              {todayKmMeters > 0 ? (
                <Text className="text-text text-xl font-bold">{formatKm(todayKmMeters)}</Text>
              ) : (
                <Text className="text-textMuted text-sm">{t('odometer.noOdometerYet')}</Text>
              )}
              <Text className="text-textMuted text-xs mt-1">{t('odometer.calcEmptyKm')}</Text>
            </View>
            <Text className="text-accent text-lg">›</Text>
          </View>
        </Card>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} className="flex-1 bg-black/60 justify-end">
          <Pressable onPress={(e) => e.stopPropagation()} className="bg-bg rounded-t-3xl pt-4 pb-8 px-5">
            <View className="items-center mb-3">
              <View className="w-10 h-1 rounded-full bg-border" />
            </View>
            <Text className="text-text text-lg font-bold mb-1">{t('odometer.title')}</Text>
            <Text className="text-textMuted text-sm mb-4">{t('odometer.subtitle')}</Text>
            <Input
              label={t('odometer.currentTotal')}
              keyboardType="numeric"
              value={km}
              onChangeText={(v) => setKm(normalizeIntInput(v))}
              placeholder="120"
            />
            <View className="mt-4">
              <Button
                label={t('odometer.saveOdometer')}
                loading={mutation.isPending}
                onPress={() => {
                  const v = Number(km);
                  if (!v || v <= 0) return;
                  mutation.mutate(v * 1000);
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

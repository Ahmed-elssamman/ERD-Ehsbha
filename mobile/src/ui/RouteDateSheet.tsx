import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, ToastAndroid, View, Platform, Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from './Input';
import { Button } from './Button';
import { Trips } from '@/api/endpoints';
import { showErrorAlert } from '@/lib/errors';
import { t } from '@/i18n';

interface Props {
  visible: boolean;
  tripId: string | null;
  initialRoute?: string | null;
  initialTripDate?: string | null;
  onClose: () => void;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === value;
}

function showSuccessToast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(message);
  }
}

export function RouteDateSheet({
  visible,
  tripId,
  initialRoute,
  initialTripDate,
  onClose,
}: Props): React.ReactElement {
  const qc = useQueryClient();
  const [route, setRoute] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setRoute(initialRoute ?? '');
    setDate(initialTripDate ?? '');
    setError(null);
  }, [visible, initialRoute, initialTripDate]);

  const mutation = useMutation({
    mutationFn: async (body: { id: string; route: string; tripDate: string }) =>
      Trips.update(body.id, { route: body.route, tripDate: body.tripDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      showSuccessToast(t('trip.routeDateSaved'));
      onClose();
    },
    onError: (err: unknown) => {
      showErrorAlert(err);
    },
  });

  const onSubmit = (): void => {
    if (!tripId) return;
    const r = route.trim();
    const d = date.trim();
    if (d.length > 0 && !isValidIsoDate(d)) {
      setError(t('trip.tripDateInvalid'));
      return;
    }
    setError(null);
    mutation.mutate({ id: tripId, route: r, tripDate: d });
  };

  const title = useMemo(
    () => (initialRoute || initialTripDate ? t('trip.editRouteDate') : t('trip.addRouteDate')),
    [initialRoute, initialTripDate],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/60 justify-end">
        <Pressable onPress={(e) => e.stopPropagation()} className="bg-bg rounded-t-3xl pt-4 pb-8 px-5">
          <View className="items-center mb-3">
            <View className="w-10 h-1 rounded-full bg-border" />
          </View>
          <Text className="text-text text-lg font-bold mb-4">{title}</Text>

          <View className="gap-4">
            <Input
              label={t('trip.route')}
              placeholder={t('trip.routePlaceholder')}
              value={route}
              onChangeText={setRoute}
              autoCapitalize="none"
              maxLength={120}
            />
            <Input
              label={t('trip.tripDate')}
              placeholder={t('trip.tripDatePlaceholder')}
              value={date}
              onChangeText={(v) => setDate(v.trim())}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              maxLength={10}
              error={error ?? undefined}
            />
          </View>

          <View className="mt-6 gap-2">
            <Button
              label={t('common.save')}
              loading={mutation.isPending}
              onPress={onSubmit}
            />
            <Button label={t('common.cancel')} tone="tonal" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

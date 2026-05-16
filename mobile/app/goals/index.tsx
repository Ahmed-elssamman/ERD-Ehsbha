import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { EmptyState } from '@/ui/EmptyState';
import { Goals } from '@/api/endpoints';
import { formatMoney } from '@/lib/format';
import { getLocale, t } from '@/i18n';
import { showErrorAlert } from '@/lib/errors';
import { normalizeNumberInput } from '@/lib/numbers';

export default function GoalsScreen() {
  const qc = useQueryClient();
  const locale = getLocale();
  const [addOpen, setAddOpen] = useState(false);
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [targetEgp, setTargetEgp] = useState('');

  const goalsQ = useQuery({ queryKey: ['goals'], queryFn: () => Goals.list() });
  const goals = goalsQ.data ?? [];

  const addMutation = useMutation({
    mutationFn: (body: any) => Goals.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
    onError: (err) => showErrorAlert(err),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: any) => Goals.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
    onError: (err) => showErrorAlert(err),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => Goals.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
    onError: (err) => showErrorAlert(err),
  });

  const handleAdd = () => {
    const target = Math.round(Number(targetEgp) * 100);
    if (!target || target <= 0) return;
    const now = new Date();
    let startsOn = new Date(now);
    let endsOn = new Date(now);
    if (period === 'DAILY') {
      startsOn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      endsOn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
    } else if (period === 'WEEKLY') {
      const dayOfWeek = now.getUTCDay() || 7;
      startsOn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek + 1));
      endsOn = new Date(startsOn.getTime() + 7 * 86_400_000 - 1);
    } else {
      startsOn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      endsOn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    }
    addMutation.mutate({
      period,
      targetPiastres: target,
      startsOn: startsOn.toISOString(),
      endsOn: endsOn.toISOString(),
    });
    setTargetEgp('');
    setAddOpen(false);
  };

  const onRemove = (g: any) => {
    Alert.alert(t('goals.removeConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => removeMutation.mutate(g.id),
      },
    ]);
  };

  const periodLabel = (p: string): string => {
    if (locale === 'ar') return p === 'DAILY' ? 'يومي' : p === 'WEEKLY' ? 'أسبوعي' : 'شهري';
    return p === 'DAILY' ? 'Daily' : p === 'WEEKLY' ? 'Weekly' : 'Monthly';
  };

  return (
    <Screen>
      <Header
        title={t('goals.title')}
        back
        subtitle={t('goals.subtitle')}
        right={
          !addOpen ? (
            <Pressable onPress={() => setAddOpen(true)} hitSlop={12}>
              <View className="w-9 h-9 rounded-full bg-accent items-center justify-center">
                <Text className="text-bg text-lg font-bold">+</Text>
              </View>
            </Pressable>
          ) : null
        }
      />

      {addOpen ? (
        <Card className="mb-4">
          <Text className="text-text font-bold mb-3">{t('goals.add')}</Text>
          <View className="gap-3">
            <View>
              <Text className="text-text mb-2 text-sm">{t('goals.period')}</Text>
              <View className="flex-row gap-2">
                {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((p) => {
                  const active = p === period;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setPeriod(p)}
                      className={`flex-1 h-11 rounded-xl items-center justify-center ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
                    >
                      <Text className={`text-sm font-medium ${active ? 'text-bg' : 'text-text'}`}>
                        {periodLabel(p)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Input
              label={t('goals.target')}
              keyboardType="numeric"
              value={targetEgp}
              onChangeText={(v) => setTargetEgp(normalizeNumberInput(v))}
              placeholder="15000"
            />
            <View className="flex-row gap-2 mt-2">
              <View className="flex-1">
                <Button label={t('common.cancel')} tone="tonal" onPress={() => setAddOpen(false)} />
              </View>
              <View className="flex-1">
                <Button label={t('common.save')} loading={addMutation.isPending} onPress={handleAdd} />
              </View>
            </View>
          </View>
        </Card>
      ) : null}

      {goalsQ.isLoading ? (
        <ActivityIndicator color="#34D399" />
      ) : goals.length === 0 ? (
        <EmptyState
          title={t('goals.emptyTitle')}
          body={t('goals.emptyBody')}
          action={<Button label={t('goals.add')} onPress={() => setAddOpen(true)} fullWidth={false} />}
        />
      ) : (
        <View className="gap-2">
          {goals.map((g: any) => (
            <Card key={g.id}>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-text font-bold">{periodLabel(g.period)}</Text>
                {g.isActive ? <Pill label="●" tone="success" /> : <Pill label="○" tone="default" />}
              </View>
              <Text className="text-accent text-2xl font-bold">{formatMoney(g.targetPiastres, locale)}</Text>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-textMuted text-xs">
                  {new Date(g.startsOn).toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB')}
                  {' → '}
                  {new Date(g.endsOn).toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB')}
                </Text>
                <Pressable onPress={() => onRemove(g)} hitSlop={8}>
                  <Text className="text-danger text-lg">🗑</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

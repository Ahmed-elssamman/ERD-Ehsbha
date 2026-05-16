import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { EmptyState } from '@/ui/EmptyState';
import { Apps } from '@/api/endpoints';
import { t } from '@/i18n';
import { showErrorAlert } from '@/lib/errors';
import { normalizeNumberInput } from '@/lib/numbers';

export default function AppsScreen() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCommission, setCustomCommission] = useState('20');

  const catalogQ = useQuery({ queryKey: ['apps', 'catalog'], queryFn: () => Apps.catalog() });
  const mineQ = useQuery({ queryKey: ['apps', 'me'], queryFn: () => Apps.mine() });

  const mine = mineQ.data ?? [];
  const catalog = catalogQ.data ?? [];

  // Apps not yet added: catalog entries where the driver doesn't have a row
  const notAdded = useMemo(
    () => catalog.filter((c: any) => !mine.some((m: any) => m.appSourceId === c.id && !m.customName)),
    [catalog, mine],
  );

  const addMutation = useMutation({
    mutationFn: (body: any) => Apps.add(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apps', 'me'] }),
    onError: (err) => showErrorAlert(err),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: any) => Apps.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apps', 'me'] }),
    onError: (err) => showErrorAlert(err),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => Apps.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apps', 'me'] }),
    onError: (err) => showErrorAlert(err),
  });

  const handleAddSystem = (appSourceId: string, defaultCommission: number) => {
    addMutation.mutate({ appSourceId, commissionPct: defaultCommission, enabled: true });
  };

  const handleAddCustom = () => {
    const name = customName.trim();
    if (name.length < 2) return;
    const pct = Number(customCommission) || 0;
    addMutation.mutate({ customName: name, commissionPct: pct, enabled: true });
    setCustomName('');
    setCustomCommission('20');
    setAddOpen(false);
  };

  const toggleEnabled = (app: any) => {
    updateMutation.mutate({ id: app.id, body: { enabled: !app.enabled } });
  };

  const updateCommission = (app: any, pct: number) => {
    updateMutation.mutate({ id: app.id, body: { commissionPct: pct } });
  };

  const onRemove = (app: any) => {
    Alert.alert(t('apps.removeConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => removeMutation.mutate(app.id),
      },
    ]);
  };

  return (
    <Screen>
      <Header title={t('apps.title')} back subtitle={t('apps.subtitle')} />

      {/* My apps */}
      <Text className="text-text font-bold text-base mb-2">{t('apps.mySection')}</Text>
      {mineQ.isLoading ? (
        <ActivityIndicator color="#34D399" />
      ) : mine.length === 0 ? (
        <EmptyState title={t('apps.emptyMine')} body={t('apps.emptyMineBody')} />
      ) : (
        <View className="gap-2">
          {mine.map((a: any) => (
            <Card key={a.id}>
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2 flex-1">
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: a.color ?? (a.enabled ? '#34D399' : '#8B95A7'),
                    }}
                  />
                  <Text className="text-text font-bold">
                    {a.customName ?? a.appSource?.name}
                  </Text>
                </View>
                <Pressable onPress={() => toggleEnabled(a)} hitSlop={8}>
                  <View
                    className={`w-12 h-7 rounded-full items-${a.enabled ? 'end' : 'start'} justify-center px-1 ${a.enabled ? 'bg-accent' : 'bg-surface2'}`}
                  >
                    <View className="w-5 h-5 rounded-full bg-bg" />
                  </View>
                </Pressable>
              </View>
              <View className="flex-row items-center gap-2 mt-1">
                <Text className="text-textMuted text-xs flex-1">
                  {t('apps.commission')}: {Number(a.commissionPct).toFixed(0)}%
                </Text>
                <CommissionStepper
                  value={Number(a.commissionPct)}
                  onChange={(v) => updateCommission(a, v)}
                />
                <Pressable onPress={() => onRemove(a)} hitSlop={6} className="ml-2">
                  <Text className="text-danger text-lg">🗑</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Catalog (apps not yet added) */}
      {notAdded.length > 0 ? (
        <View className="mt-6">
          <Text className="text-text font-bold text-base mb-2">{t('apps.catalogSection')}</Text>
          <View className="gap-2">
            {notAdded.map((c: any) => (
              <Pressable
                key={c.id}
                onPress={() => handleAddSystem(c.id, Number(c.defaultCommissionPct))}
              >
                <Card>
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-text font-bold">{c.name}</Text>
                      <Text className="text-textMuted text-xs mt-1">
                        {t('apps.defaultCommission')}: {Number(c.defaultCommissionPct).toFixed(0)}%
                      </Text>
                    </View>
                    <View className="w-9 h-9 rounded-full bg-accent items-center justify-center">
                      <Text className="text-bg text-lg font-bold">+</Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Custom app */}
      <View className="mt-6">
        <Text className="text-text font-bold text-base mb-2">{t('apps.customSection')}</Text>
        {!addOpen ? (
          <Pressable onPress={() => setAddOpen(true)}>
            <Card>
              <View className="flex-row items-center justify-between">
                <Text className="text-text">{t('apps.addCustom')}</Text>
                <Text className="text-accent text-lg">+</Text>
              </View>
            </Card>
          </Pressable>
        ) : (
          <Card>
            <View className="gap-3">
              <Input
                label={t('apps.customName')}
                value={customName}
                onChangeText={setCustomName}
                placeholder={t('apps.customNamePlaceholder')}
              />
              <Input
                label={t('apps.commission')}
                keyboardType="numeric"
                value={customCommission}
                onChangeText={(v) => setCustomCommission(normalizeNumberInput(v))}
              />
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    label={t('common.cancel')}
                    tone="tonal"
                    onPress={() => setAddOpen(false)}
                  />
                </View>
                <View className="flex-1">
                  <Button label={t('common.save')} loading={addMutation.isPending} onPress={handleAddCustom} />
                </View>
              </View>
            </View>
          </Card>
        )}
      </View>
    </Screen>
  );
}

function CommissionStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View className="flex-row items-center gap-1">
      <Pressable
        onPress={() => onChange(Math.max(0, Math.round((value - 1) * 100) / 100))}
        hitSlop={6}
        className="w-7 h-7 rounded-full bg-surface2 items-center justify-center"
      >
        <Text className="text-text text-base font-bold">−</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange(Math.min(60, Math.round((value + 1) * 100) / 100))}
        hitSlop={6}
        className="w-7 h-7 rounded-full bg-surface2 items-center justify-center"
      >
        <Text className="text-text text-base font-bold">+</Text>
      </Pressable>
    </View>
  );
}

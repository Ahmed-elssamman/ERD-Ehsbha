import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Areas } from '@/api/endpoints';
import { t } from '@/i18n';
import { showErrorAlert } from '@/lib/errors';

const COLORS = ['#34D399', '#60A5FA', '#F59E0B', '#F87171', '#A78BFA', '#22D3EE', '#FB923C', '#EC4899'];

export default function AreasScreen() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const areasQ = useQuery({ queryKey: ['areas'], queryFn: () => Areas.list() });
  const areas = areasQ.data ?? [];

  const addMutation = useMutation({
    mutationFn: (body: any) => Areas.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['areas'] }),
    onError: (err) => showErrorAlert(err),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => Areas.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['areas'] }),
    onError: (err) => showErrorAlert(err),
  });

  const handleAdd = () => {
    const trimmed = name.trim();
    if (trimmed.length < 1) return;
    addMutation.mutate({ name: trimmed, color });
    setName('');
    setColor(COLORS[0]);
    setAddOpen(false);
  };

  const onRemove = (area: any) => {
    Alert.alert(area.name, t('areas.removeConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => removeMutation.mutate(area.id),
      },
    ]);
  };

  return (
    <Screen>
      <Header
        title={t('areas.title')}
        back
        subtitle={t('areas.subtitle')}
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
          <Text className="text-text font-bold mb-3">{t('areas.add')}</Text>
          <View className="gap-3">
            <Input
              label={t('areas.name')}
              value={name}
              onChangeText={setName}
              placeholder={t('areas.namePlaceholder')}
              autoFocus
            />
            <View>
              <Text className="text-text mb-2 text-sm">{t('areas.color')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    className={`w-9 h-9 rounded-full items-center justify-center ${c === color ? 'border-2 border-text' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </View>
            </View>
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

      {areasQ.isLoading ? (
        <ActivityIndicator color="#34D399" />
      ) : areas.length === 0 ? (
        <EmptyState
          title={t('areas.emptyTitle')}
          body={t('areas.emptyBody')}
          action={<Button label={t('areas.add')} onPress={() => setAddOpen(true)} fullWidth={false} />}
        />
      ) : (
        <View className="gap-2">
          {areas.map((a: any) => (
            <Card key={a.id}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: a.color ?? '#60A5FA' }} />
                  <Text className="text-text font-medium">{a.name}</Text>
                </View>
                <Pressable onPress={() => onRemove(a)} hitSlop={8}>
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

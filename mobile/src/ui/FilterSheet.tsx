import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from './Button';
import { t } from '@/i18n';

export interface DateRange {
  from?: Date;
  to?: Date;
  preset?: 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth';
}

export interface FilterValue {
  range?: DateRange;
  appId?: string | null;
  vehicleId?: string | null;
  areaId?: string | null;
  category?: string | null;
}

interface Option {
  id: string;
  label: string;
  color?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  value: FilterValue;
  onApply: (next: FilterValue) => void;
  apps?: Option[];
  vehicles?: Option[];
  areas?: Option[];
  categories?: Option[];
}

const PRESETS: DateRange['preset'][] = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth'];

export function FilterSheet({ visible, onClose, value, onApply, apps, vehicles, areas, categories }: Props) {
  const [local, setLocal] = useState<FilterValue>(value);

  React.useEffect(() => {
    if (visible) setLocal(value);
  }, [visible, value]);

  const clear = () => setLocal({});
  const apply = () => {
    onApply(local);
    onClose();
  };

  const renderChips = (opts: Option[] | undefined, current: string | null | undefined, set: (v: string | null) => void) => {
    if (!opts || opts.length === 0) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Pressable
          onPress={() => set(null)}
          className={`px-3 h-9 rounded-full items-center justify-center ${!current ? 'bg-accent' : 'bg-surface border border-border'}`}
        >
          <Text className={`text-xs ${!current ? 'text-bg' : 'text-text'}`}>{t('filters.all')}</Text>
        </Pressable>
        {opts.map((o) => {
          const active = o.id === current;
          return (
            <Pressable
              key={o.id}
              onPress={() => set(o.id)}
              className={`px-3 h-9 rounded-full items-center justify-center flex-row gap-1.5 ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
            >
              {o.color ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: o.color }} /> : null}
              <Text className={`text-xs font-medium ${active ? 'text-bg' : 'text-text'}`}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/60 justify-end">
        <Pressable onPress={(e) => e.stopPropagation()} className="bg-bg rounded-t-3xl pt-4 pb-8 max-h-[80%]">
          <View className="items-center mb-3">
            <View className="w-10 h-1 rounded-full bg-border" />
          </View>
          <ScrollView className="px-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text text-lg font-bold">{t('filters.title')}</Text>
              <Pressable onPress={clear} hitSlop={8}>
                <Text className="text-textMuted text-sm">{t('filters.clear')}</Text>
              </Pressable>
            </View>

            {/* Date presets */}
            <Text className="text-text mb-2 text-sm">{t('filters.byDateRange')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable
                onPress={() => setLocal({ ...local, range: undefined })}
                className={`px-3 h-9 rounded-full items-center justify-center ${!local.range ? 'bg-accent' : 'bg-surface border border-border'}`}
              >
                <Text className={`text-xs ${!local.range ? 'text-bg' : 'text-text'}`}>{t('filters.all')}</Text>
              </Pressable>
              {PRESETS.map((p) => {
                const active = local.range?.preset === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setLocal({ ...local, range: { preset: p, ...rangeFromPreset(p) } })}
                    className={`px-3 h-9 rounded-full items-center justify-center ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
                  >
                    <Text className={`text-xs ${active ? 'text-bg' : 'text-text'}`}>{t(`filters.preset.${p}`)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {apps ? (
              <View className="mt-5">
                <Text className="text-text mb-2 text-sm">{t('filters.byApp')}</Text>
                {renderChips(apps, local.appId, (v) => setLocal({ ...local, appId: v }))}
              </View>
            ) : null}

            {vehicles ? (
              <View className="mt-5">
                <Text className="text-text mb-2 text-sm">{t('filters.byVehicle')}</Text>
                {renderChips(vehicles, local.vehicleId, (v) => setLocal({ ...local, vehicleId: v }))}
              </View>
            ) : null}

            {areas ? (
              <View className="mt-5">
                <Text className="text-text mb-2 text-sm">{t('filters.byArea')}</Text>
                {renderChips(areas, local.areaId, (v) => setLocal({ ...local, areaId: v }))}
              </View>
            ) : null}

            {categories ? (
              <View className="mt-5">
                <Text className="text-text mb-2 text-sm">{t('filters.byCategory')}</Text>
                {renderChips(categories, local.category, (v) => setLocal({ ...local, category: v }))}
              </View>
            ) : null}

            <View className="mt-6">
              <Button label={t('filters.apply')} onPress={apply} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function rangeFromPreset(p: DateRange['preset']): Pick<DateRange, 'from' | 'to'> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
  switch (p) {
    case 'today':
      return { from: todayStart, to: todayEnd };
    case 'yesterday':
      return {
        from: new Date(todayStart.getTime() - 86_400_000),
        to: new Date(todayStart.getTime() - 1),
      };
    case 'last7':
      return { from: new Date(todayEnd.getTime() - 7 * 86_400_000), to: todayEnd };
    case 'last30':
      return { from: new Date(todayEnd.getTime() - 30 * 86_400_000), to: todayEnd };
    case 'thisMonth':
      return {
        from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        to: todayEnd,
      };
    case 'lastMonth':
      return {
        from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
        to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59)),
      };
    default:
      return {};
  }
}

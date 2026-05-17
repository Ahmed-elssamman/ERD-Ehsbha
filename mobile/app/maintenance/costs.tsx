import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Vehicles } from '@/api/endpoints';
import { t, getLocale } from '@/i18n';
import { formatMoney, formatPercent } from '@/lib/format';
import { showErrorAlert } from '@/lib/errors';
import { normalizeNumberInput, normalizeIntInput } from '@/lib/numbers';
import { go, ROUTES } from '@/constants/routes';

interface Form {
  fuelTankCostEgp: string;
  fuelTankKmRange: string;
  oilCostEgp: string;
  oilIntervalKm: string;
  tireCostEgp: string;
  tireIntervalKm: string;
  brakesCostEgp: string;
  brakesIntervalKm: string;
  chainCostEgp: string;
  chainIntervalKm: string;
  batteryCostEgp: string;
  batteryIntervalMonths: string;
  monthlyMaintCostEgp: string;
  monthlyAvgKm: string;
}

const empty: Form = {
  fuelTankCostEgp: '',
  fuelTankKmRange: '',
  oilCostEgp: '',
  oilIntervalKm: '',
  tireCostEgp: '',
  tireIntervalKm: '',
  brakesCostEgp: '',
  brakesIntervalKm: '',
  chainCostEgp: '',
  chainIntervalKm: '',
  batteryCostEgp: '',
  batteryIntervalMonths: '',
  monthlyMaintCostEgp: '',
  monthlyAvgKm: '',
};

export default function VehicleCostsScreen(): React.ReactElement {
  const locale = getLocale();
  const qc = useQueryClient();
  const router = useRouter();

  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: () => Vehicles.list() });
  const vehicle = (vehiclesQ.data ?? []).find((v: any) => v.isActive) ?? (vehiclesQ.data ?? [])[0];

  const summaryQ = useQuery({
    queryKey: ['vehicles', vehicle?.id, 'cost-summary'],
    queryFn: () => Vehicles.costSummary(vehicle!.id),
    enabled: !!vehicle?.id,
  });

  const { control, handleSubmit, reset, watch } = useForm<Form>({ defaultValues: empty });

  useEffect(() => {
    if (!vehicle) return;
    reset({
      fuelTankCostEgp: vehicle.fuelTankCostPiastres ? String(vehicle.fuelTankCostPiastres / 100) : '',
      fuelTankKmRange: vehicle.fuelTankKmRange ? String(vehicle.fuelTankKmRange) : '',
      oilCostEgp: vehicle.oilCostPiastres ? String(vehicle.oilCostPiastres / 100) : '',
      oilIntervalKm: vehicle.oilIntervalKm ? String(vehicle.oilIntervalKm) : '',
      tireCostEgp: vehicle.tireCostPiastres ? String(vehicle.tireCostPiastres / 100) : '',
      tireIntervalKm: vehicle.tireIntervalKm ? String(vehicle.tireIntervalKm) : '',
      brakesCostEgp: vehicle.brakesCostPiastres ? String(vehicle.brakesCostPiastres / 100) : '',
      brakesIntervalKm: vehicle.brakesIntervalKm ? String(vehicle.brakesIntervalKm) : '',
      chainCostEgp: vehicle.chainCostPiastres ? String(vehicle.chainCostPiastres / 100) : '',
      chainIntervalKm: vehicle.chainIntervalKm ? String(vehicle.chainIntervalKm) : '',
      batteryCostEgp: vehicle.batteryCostPiastres ? String(vehicle.batteryCostPiastres / 100) : '',
      batteryIntervalMonths: vehicle.batteryIntervalMonths ? String(vehicle.batteryIntervalMonths) : '',
      monthlyMaintCostEgp: vehicle.monthlyMaintCostPiastres ? String(vehicle.monthlyMaintCostPiastres / 100) : '',
      monthlyAvgKm: vehicle.monthlyAvgKm ? String(vehicle.monthlyAvgKm) : '',
    });
  }, [vehicle?.id]);

  const mutation = useMutation({
    mutationFn: (body: any) => Vehicles.updateCosts(vehicle!.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      qc.invalidateQueries({ queryKey: ['vehicles', vehicle?.id, 'cost-summary'] });
    },
  });

  const onSubmit = (data: Form) => {
    const toP = (egp: string) => (egp ? Math.round(Number(egp) * 100) : null);
    const toI = (s: string) => (s ? Math.round(Number(s)) : null);
    mutation.mutate({
      fuelTankCostPiastres: toP(data.fuelTankCostEgp),
      fuelTankKmRange: toI(data.fuelTankKmRange),
      oilCostPiastres: toP(data.oilCostEgp),
      oilIntervalKm: toI(data.oilIntervalKm),
      tireCostPiastres: toP(data.tireCostEgp),
      tireIntervalKm: toI(data.tireIntervalKm),
      brakesCostPiastres: toP(data.brakesCostEgp),
      brakesIntervalKm: toI(data.brakesIntervalKm),
      chainCostPiastres: toP(data.chainCostEgp),
      chainIntervalKm: toI(data.chainIntervalKm),
      batteryCostPiastres: toP(data.batteryCostEgp),
      batteryIntervalMonths: toI(data.batteryIntervalMonths),
      monthlyMaintCostPiastres: toP(data.monthlyMaintCostEgp),
      monthlyAvgKm: toI(data.monthlyAvgKm),
    });
  };

  if (!vehicle) {
    return (
      <Screen>
        <Header title={t('vehicleCosts.title')} back />
        <View className="mt-12 items-center px-6">
          <Text className="text-text text-lg font-bold text-center mb-2">{t('vehicles.emptyTitle')}</Text>
          <Text className="text-textMuted text-center text-sm mb-4">{t('vehicles.emptyBody')}</Text>
          <Button label={t('vehicles.addFirst')} onPress={() => router.push(go(ROUTES.VEHICLE_NEW))} fullWidth={false} />
        </View>
      </Screen>
    );
  }

  const summary = summaryQ.data;
  const componentLabel: Record<string, string> = {
    fuel: t('vehicleCosts.fuelSection'),
    oil: t('vehicleCosts.oilSection'),
    tires: t('vehicleCosts.tiresSection'),
    brakes: t('vehicleCosts.brakesSection'),
    chain: t('vehicleCosts.chainSection'),
    battery: t('vehicleCosts.batterySection'),
    monthly: t('vehicleCosts.monthlySection'),
  };

  return (
    <Screen>
      <Header title={t('vehicleCosts.title')} back subtitle={t('vehicleCosts.subtitle')} />

      {summary ? (
        <Card className="mb-4">
          <Text className="text-textMuted text-xs mb-1">{t('vehicleCosts.totalPerKm')}</Text>
          <View className="flex-row items-baseline gap-2">
            <Text className="text-accent text-3xl font-bold">
              {formatMoney(Math.round(summary.totalPerKmPiastres), locale)}
            </Text>
            <Text className="text-textMuted text-sm">/{t('analytics.kmShort')}</Text>
          </View>
          <Text className="text-textMuted text-xs mt-2">{t('vehicleCosts.totalPerKmHint')}</Text>
          <View className="mt-3">
            <View className="flex-row justify-between mb-1">
              <Text className="text-textMuted text-xs">{t('vehicleCosts.completeness')}</Text>
              <Text className="text-textMuted text-xs">{formatPercent(summary.completenessBp, locale)}</Text>
            </View>
            <View className="h-1.5 bg-surface2 rounded-full overflow-hidden">
              <View
                style={{
                  width: `${summary.completenessBp / 100}%`,
                  height: '100%',
                  backgroundColor: '#34D399',
                }}
              />
            </View>
          </View>

          {/* Breakdown */}
          <View className="mt-4 gap-1.5">
            {summary.components
              .filter((c: any) => c.provided)
              .map((c: any) => (
                <View key={c.key} className="flex-row items-center justify-between">
                  <Text className="text-text text-sm">{componentLabel[c.key]}</Text>
                  <View className="flex-row gap-3 items-center">
                    <Text className="text-textMuted text-xs">{formatPercent(c.shareBp, locale)}</Text>
                    <Text className="text-text text-sm font-bold">
                      {formatMoney(Math.round(c.perKmPiastres), locale)}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        </Card>
      ) : null}

      <Card className="mb-4 bg-warn/10 border-warn/40">
        <Text className="text-warn text-xs">{t('vehicleCosts.example')}</Text>
      </Card>

      <CostSection title={t('vehicleCosts.fuelSection')}>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller control={control} name="fuelTankCostEgp" render={({ field: { value, onChange } }) => (
              <Input label={t('vehicleCosts.fuelTankCost')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeNumberInput(v))} />
            )} />
          </View>
          <View className="flex-1">
            <Controller control={control} name="fuelTankKmRange" render={({ field: { value, onChange } }) => (
              <Input label={t('vehicleCosts.fuelTankKmRange')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeIntInput(v))} />
            )} />
          </View>
        </View>
      </CostSection>

      <CostSection title={t('vehicleCosts.oilSection')}>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller control={control} name="oilCostEgp" render={({ field: { value, onChange } }) => (
              <Input label={t('vehicleCosts.oilCost')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeNumberInput(v))} />
            )} />
          </View>
          <View className="flex-1">
            <Controller control={control} name="oilIntervalKm" render={({ field: { value, onChange } }) => (
              <Input label={t('vehicleCosts.oilInterval')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeIntInput(v))} />
            )} />
          </View>
        </View>
      </CostSection>

      <CostSection title={t('vehicleCosts.tiresSection')}>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller control={control} name="tireCostEgp" render={({ field: { value, onChange } }) => (
              <Input label={t('vehicleCosts.tireCost')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeNumberInput(v))} />
            )} />
          </View>
          <View className="flex-1">
            <Controller control={control} name="tireIntervalKm" render={({ field: { value, onChange } }) => (
              <Input label={t('vehicleCosts.tireInterval')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeIntInput(v))} />
            )} />
          </View>
        </View>
      </CostSection>

      <CostSection title={t('vehicleCosts.brakesSection')}>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller control={control} name="brakesCostEgp" render={({ field: { value, onChange } }) => (
              <Input label={t('vehicleCosts.brakesCost')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeNumberInput(v))} />
            )} />
          </View>
          <View className="flex-1">
            <Controller control={control} name="brakesIntervalKm" render={({ field: { value, onChange } }) => (
              <Input label={t('vehicleCosts.brakesInterval')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeIntInput(v))} />
            )} />
          </View>
        </View>
      </CostSection>

      {vehicle.type === 'BIKE' ? (
        <CostSection title={t('vehicleCosts.chainSection')}>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller control={control} name="chainCostEgp" render={({ field: { value, onChange } }) => (
                <Input label={t('vehicleCosts.chainCost')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeNumberInput(v))} />
              )} />
            </View>
            <View className="flex-1">
              <Controller control={control} name="chainIntervalKm" render={({ field: { value, onChange } }) => (
                <Input label={t('vehicleCosts.chainInterval')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeIntInput(v))} />
              )} />
            </View>
          </View>
        </CostSection>
      ) : null}

      <CostSection title={t('vehicleCosts.batterySection')}>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller control={control} name="batteryCostEgp" render={({ field: { value, onChange } }) => (
              <Input label={t('vehicleCosts.batteryCost')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeNumberInput(v))} />
            )} />
          </View>
          <View className="flex-1">
            <Controller control={control} name="batteryIntervalMonths" render={({ field: { value, onChange } }) => (
              <Input label={t('vehicleCosts.batteryInterval')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeIntInput(v))} />
            )} />
          </View>
        </View>
      </CostSection>

      <CostSection title={t('vehicleCosts.monthlySection')}>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller control={control} name="monthlyMaintCostEgp" render={({ field: { value, onChange } }) => (
              <Input label={t('vehicleCosts.monthlyMaintCost')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeNumberInput(v))} />
            )} />
          </View>
          <View className="flex-1">
            <Controller control={control} name="monthlyAvgKm" render={({ field: { value, onChange } }) => (
              <Input label={t('vehicleCosts.monthlyAvgKm')} keyboardType="numeric" value={value} onChangeText={(v) => onChange(normalizeIntInput(v))} />
            )} />
          </View>
        </View>
      </CostSection>

      <View className="mt-4 mb-2">
        <Button label={t('vehicleCosts.save')} loading={mutation.isPending} onPress={handleSubmit(onSubmit)} />
      </View>
    </Screen>
  );
}

function CostSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="text-text font-bold mb-2">{title}</Text>
      {children}
    </View>
  );
}

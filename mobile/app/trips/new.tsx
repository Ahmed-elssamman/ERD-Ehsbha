import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Apps, Areas, Trips, Vehicles } from '@/api/endpoints';
import { t, getLocale } from '@/i18n';
import { kmToMeters } from '@/lib/helpers';
import { formatMoney } from '@/lib/format';
import { enqueue } from '@/offline/queue';
import { useNetwork } from '@/stores/network.store';
import { showErrorAlert, toUserError } from '@/lib/errors';
import { normalizeNumberInput, normalizeIntInput } from '@/lib/numbers';
import { go, ROUTES } from '@/constants/routes';

const TrafficEnum = z.enum(['LIGHT', 'MEDIUM', 'HEAVY', 'STANDSTILL']);
const WeatherEnum = z.enum(['CLEAR', 'RAIN', 'DUST', 'HOT', 'COLD']);
const CategoryEnum = z.enum(['STANDARD', 'AIRPORT', 'LONG', 'SHORT', 'DELIVERY']);

const Schema = z.object({
  vehicleId: z.string().min(1),
  driverAppId: z.string().min(1),
  areaId: z.string().nullable().optional(),
  // Shown price (gross) and what the driver actually received after platform fee.
  // If received is provided, system derives commission. Otherwise uses driver-app commission %.
  grossEgp: z.coerce.number().min(0),
  receivedEgp: z.coerce.number().min(0).optional(),
  tipEgp: z.coerce.number().min(0).default(0),
  tripKm: z.coerce.number().min(0.1),
  durationMinutes: z.coerce.number().int().min(1).max(720),
  // Optional advanced (accuracy boosters)
  waitingMinutes: z.coerce.number().int().min(0).max(180).optional(),
  trafficLevel: TrafficEnum.optional(),
  weather: WeatherEnum.optional(),
  tripCategory: CategoryEnum.optional(),
  tollEgp: z.coerce.number().min(0).optional(),
  parkingEgp: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  notes: z.string().max(500).optional(),
});
type Form = z.infer<typeof Schema>;

export default function NewTripScreen(): React.ReactElement {
  const router = useRouter();
  const qc = useQueryClient();
  const locale = getLocale();
  const online = useNetwork((s) => s.online);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: () => Vehicles.list(), staleTime: 5 * 60_000 });
  const appsQ = useQuery({ queryKey: ['apps', 'me'], queryFn: () => Apps.mine(), staleTime: 5 * 60_000 });
  const areasQ = useQuery({ queryKey: ['areas'], queryFn: () => Areas.list(), staleTime: 5 * 60_000 });

  const vehicles = vehiclesQ.data ?? [];
  const apps = useMemo(
    () => (appsQ.data ?? []).filter((a: any) => a.enabled),
    [appsQ.data],
  );
  const areas = areasQ.data ?? [];

  const isLoadingSetup = vehiclesQ.isLoading || appsQ.isLoading;
  const noVehicles = !isLoadingSetup && vehicles.length === 0;
  const noApps = !isLoadingSetup && apps.length === 0;

  const { control, handleSubmit, setValue, watch, getValues, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: {
      vehicleId: '',
      driverAppId: '',
      areaId: null,
      grossEgp: 0,
      tipEgp: 0,
      tripKm: 0,
      durationMinutes: 15,
    },
  });

  useEffect(() => {
    // Auto-pick the active vehicle + first enabled app once the data lands.
    const currentVehicleId = getValues('vehicleId');
    const currentAppId = getValues('driverAppId');
    if (!currentVehicleId && vehicles.length > 0) {
      setValue('vehicleId', vehicles.find((v: any) => v.isActive)?.id ?? vehicles[0].id);
    }
    if (!currentAppId && apps.length > 0) setValue('driverAppId', apps[0].id);
  }, [vehicles.length, apps.length]);

  // useWatch only re-renders THIS component when these specific fields change,
  // instead of re-rendering on every form interaction. Big perf win.
  const watchedDriverAppId = useWatch({ control, name: 'driverAppId' });
  const watchedGross = useWatch({ control, name: 'grossEgp' });
  const watchedReceived = useWatch({ control, name: 'receivedEgp' });
  const watchedTip = useWatch({ control, name: 'tipEgp' });
  const watchedToll = useWatch({ control, name: 'tollEgp' });
  const watchedParking = useWatch({ control, name: 'parkingEgp' });

  const selectedApp = useMemo(
    () => apps.find((a: any) => a.id === watchedDriverAppId),
    [apps, watchedDriverAppId],
  );
  const grossEgp = Number(watchedGross) || 0;
  const receivedEgp = watchedReceived;
  const tipEgp = Number(watchedTip) || 0;
  const tollEgp = Number(watchedToll) || 0;
  const parkingEgp = Number(watchedParking) || 0;
  const appCommissionPct = selectedApp ? Number(selectedApp.commissionPct) : 0;
  const commissionEgp = receivedEgp !== undefined && receivedEgp !== null && Number(receivedEgp) >= 0
    ? Math.max(0, grossEgp - Number(receivedEgp))
    : (grossEgp * appCommissionPct) / 100;
  const effectiveCommissionPct = grossEgp > 0 ? (commissionEgp / grossEgp) * 100 : 0;
  const netEgp = Math.max(0, grossEgp - commissionEgp + tipEgp - tollEgp - parkingEgp);

  const mutation = useMutation({
    mutationFn: async (input: any) => Trips.create(input),
  });

  // Single useWatch read of an array; one subscription instead of five.
  const advancedValues = useWatch({
    control,
    name: ['waitingMinutes', 'trafficLevel', 'weather', 'tripCategory', 'rating'],
  });
  const advancedFieldsTouched = advancedValues.some((v) => v !== undefined);

  const [submitError, setSubmitError] = useState<string | null>(null);

  const onInvalid = (errs: any) => {
    // Surface the first validation error so the user sees something tangible.
    const firstErrorField = Object.keys(errs)[0];
    if (firstErrorField === 'tripKm') {
      setSubmitError(t('trip.errKmRequired'));
    } else if (firstErrorField === 'grossEgp') {
      setSubmitError(t('trip.errGrossRequired'));
    } else if (firstErrorField === 'vehicleId') {
      setSubmitError(t('trip.errVehicleRequired'));
    } else if (firstErrorField === 'driverAppId') {
      setSubmitError(t('trip.errAppRequired'));
    } else {
      setSubmitError(t('errors.VALIDATION_ERROR'));
    }
  };

  const onSubmit = async (data: Form) => {
    setSubmitError(null);
    const now = new Date();
    const start = new Date(now.getTime() - data.durationMinutes * 60_000);

    // New empty-km model: per-trip empty is 0. Daily empty is derived from
    // daily odometer reading minus sum of trip km. Trip stores km as both
    // totalKm and paidKm for backward compatibility with current aggregate logic.
    const tripMeters = kmToMeters(data.tripKm);

    // Build notes JSON with optional advanced fields so analytics can opt-in later.
    const meta: Record<string, unknown> = {};
    if (data.waitingMinutes !== undefined) meta.waitingMinutes = data.waitingMinutes;
    if (data.trafficLevel) meta.trafficLevel = data.trafficLevel;
    if (data.weather) meta.weather = data.weather;
    if (data.tripCategory) meta.tripCategory = data.tripCategory;
    if (data.rating) meta.rating = data.rating;
    const notesJson = Object.keys(meta).length > 0
      ? JSON.stringify(meta) + (data.notes ? `\n${data.notes}` : '')
      : data.notes ?? '';

    const body = {
      vehicleId: data.vehicleId,
      driverAppId: data.driverAppId,
      areaId: data.areaId ?? null,
      startedAt: start.toISOString(),
      endedAt: now.toISOString(),
      grossPiastres: Math.round(data.grossEgp * 100),
      receivedPiastres: data.receivedEgp !== undefined && data.receivedEgp !== null
        ? Math.round(Number(data.receivedEgp) * 100)
        : null,
      tipPiastres: Math.round(data.tipEgp * 100),
      // If received is set, server derives commission from gross-received.
      // We still send commissionPiastres as a hint based on app % so the server
      // can fall back if received is missing.
      commissionPiastres: Math.round(commissionEgp * 100),
      tollPiastres: Math.round((data.tollEgp ?? 0) * 100),
      parkingPiastres: Math.round((data.parkingEgp ?? 0) * 100),
      totalKmMeters: tripMeters,
      paidKmMeters: tripMeters,
      notes: notesJson || null,
      clientMutationId: uuidv4(),
    };

    try {
      if (online) {
        await mutation.mutateAsync(body);
      } else {
        await enqueue({ endpoint: '/trips', method: 'POST', body });
      }
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['decisions'] });
      router.back();
    } catch (err) {
      const ue = toUserError(err);
      if (ue.isNetwork) {
        await enqueue({ endpoint: '/trips', method: 'POST', body });
        router.back();
      } else {
        showErrorAlert(err);
      }
    }
  };

  if (isLoadingSetup) {
    return (
      <Screen>
        <Header title={t('trip.new')} back />
        <View className="py-12 items-center">
          <Text className="text-textMuted">{t('common.loading')}</Text>
        </View>
      </Screen>
    );
  }

  if (noVehicles) {
    return (
      <Screen>
        <Header title={t('trip.new')} back />
        <View className="mt-8 items-center px-6">
          <Text className="text-text text-lg font-bold mb-2 text-center">{t('vehicles.emptyTitle')}</Text>
          <Text className="text-textMuted text-sm mb-5 text-center">{t('vehicles.emptyBody')}</Text>
          <Button label={t('vehicles.addFirst')} onPress={() => router.push(go(ROUTES.VEHICLE_NEW))} fullWidth={false} />
        </View>
      </Screen>
    );
  }

  if (noApps) {
    return (
      <Screen>
        <Header title={t('trip.new')} back />
        <View className="mt-8 items-center px-6">
          <Text className="text-text text-lg font-bold mb-2 text-center">{t('apps.emptyMine')}</Text>
          <Text className="text-textMuted text-sm mb-5 text-center">{t('apps.emptyMineBody')}</Text>
          <Button label={t('apps.title')} onPress={() => router.push(go(ROUTES.APPS))} fullWidth={false} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t('trip.new')} back />

      <View className="gap-4 mt-2">
        {/* Net profit preview card */}
        <Card>
          <Text className="text-textMuted text-xs mb-2">{t('home.todayProfit')}</Text>
          <Text className="text-accent text-3xl font-bold">{formatMoney(Math.round(netEgp * 100), locale)}</Text>
          {commissionEgp > 0 ? (
            <Text className="text-textMuted text-xs mt-1.5">
              {t('trip.commission')}: −{formatMoney(Math.round(commissionEgp * 100), locale)} ({effectiveCommissionPct.toFixed(0)}%)
            </Text>
          ) : null}
          {(tollEgp > 0 || parkingEgp > 0) ? (
            <Text className="text-textMuted text-xs mt-0.5">
              {t('trip.tollPiastres')} + {t('trip.parkingPiastres')}: −{formatMoney(Math.round((tollEgp + parkingEgp) * 100), locale)}
            </Text>
          ) : null}
        </Card>

        {/* Shown vs received: most accurate input — drives auto-commission */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="grossEgp"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('trip.gross')}
                  keyboardType="numeric"
                  value={String(value || '')}
                  onChangeText={(v) => onChange(normalizeNumberInput(v))}
                  error={errors.grossEgp?.message}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="receivedEgp"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('trip.receivedAfterFees')}
                  hint={t('trip.receivedHint')}
                  keyboardType="numeric"
                  value={value !== undefined && value !== null ? String(value) : ''}
                  onChangeText={(v) => {
                    const s = normalizeNumberInput(v);
                    onChange(s === '' ? undefined : Number(s));
                  }}
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="driverAppId"
          render={({ field: { value, onChange } }) => (
            <View>
              <Text className="text-text mb-2 text-sm">{t('trip.app')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {apps.map((a: any) => {
                  const active = a.id === value;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => onChange(a.id)}
                      className={`px-4 h-11 rounded-full items-center justify-center ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
                    >
                      <Text className={`text-sm font-medium ${active ? 'text-bg' : 'text-text'}`}>
                        {a.customName ?? a.appSource?.name}
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
          name="areaId"
          render={({ field: { value, onChange } }) => (
            <View>
              <Text className="text-text mb-2 text-sm">{t('trip.area')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Pressable
                  onPress={() => onChange(null)}
                  className={`px-4 h-11 rounded-full items-center justify-center ${!value ? 'bg-accent' : 'bg-surface border border-border'}`}
                >
                  <Text className={`text-sm ${!value ? 'text-bg' : 'text-text'}`}>—</Text>
                </Pressable>
                {areas.map((a: any) => {
                  const active = a.id === value;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => onChange(a.id)}
                      className={`px-4 h-11 rounded-full items-center justify-center ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
                    >
                      <Text className={`text-sm ${active ? 'text-bg' : 'text-text'}`}>{a.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="tripKm"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('trip.tripKm')}
                  hint={t('trip.tripKmHint')}
                  keyboardType="numeric"
                  value={String(value || '')}
                  onChangeText={(v) => onChange(normalizeNumberInput(v))}
                  error={errors.tripKm?.message}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="durationMinutes"
              render={({ field: { value, onChange } }) => (
                <Input
                  label={t('trip.duration')}
                  keyboardType="numeric"
                  value={String(value || '')}
                  onChangeText={(v) => onChange(normalizeIntInput(v))}
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="tipEgp"
          render={({ field: { value, onChange } }) => (
            <Input
              label={t('trip.tip')}
              keyboardType="numeric"
              value={String(value || '')}
              onChangeText={(v) => onChange(normalizeNumberInput(v))}
            />
          )}
        />

        {/* Advanced fields collapsible */}
        <Pressable
          onPress={() => setShowAdvanced((s) => !s)}
          className="bg-surface border border-border rounded-2xl p-4"
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-text font-bold">{t('trip.advanced')}</Text>
            <Text className="text-accent text-lg">{showAdvanced ? '−' : '+'}</Text>
          </View>
          {!showAdvanced && !advancedFieldsTouched ? (
            <Text className="text-textMuted text-xs mt-1.5">⚠ {t('trip.advancedHint')}</Text>
          ) : null}
        </Pressable>

        {showAdvanced ? (
          <View className="gap-4">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="tollEgp"
                  render={({ field: { value, onChange } }) => (
                    <Input
                      label={t('trip.tollPiastres')}
                      keyboardType="numeric"
                      value={value !== undefined ? String(value) : ''}
                      onChangeText={(v) => onChange(v === '' ? undefined : Number(normalizeNumberInput(v)))}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="parkingEgp"
                  render={({ field: { value, onChange } }) => (
                    <Input
                      label={t('trip.parkingPiastres')}
                      keyboardType="numeric"
                      value={value !== undefined ? String(value) : ''}
                      onChangeText={(v) => onChange(v === '' ? undefined : Number(normalizeNumberInput(v)))}
                    />
                  )}
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="waitingMinutes"
                  render={({ field: { value, onChange } }) => (
                    <Input
                      label={t('trip.waitingMinutes')}
                      keyboardType="numeric"
                      value={value !== undefined ? String(value) : ''}
                      onChangeText={(v) => onChange(v === '' ? undefined : Number(normalizeIntInput(v)))}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="rating"
                  render={({ field: { value, onChange } }) => (
                    <Input
                      label={t('trip.rating')}
                      keyboardType="numeric"
                      value={value !== undefined ? String(value) : ''}
                      onChangeText={(v) => {
                        const n = Number(normalizeIntInput(v));
                        onChange(v === '' ? undefined : Math.min(5, Math.max(1, n)));
                      }}
                    />
                  )}
                />
              </View>
            </View>

            <ChipPicker
              label={t('trip.trafficLevel')}
              optionsKey="trip.traffic"
              options={['LIGHT', 'MEDIUM', 'HEAVY', 'STANDSTILL']}
              control={control}
              name="trafficLevel"
            />
            <ChipPicker
              label={t('trip.weather')}
              optionsKey="trip.weatherTypes"
              options={['CLEAR', 'RAIN', 'DUST', 'HOT', 'COLD']}
              control={control}
              name="weather"
            />
            <ChipPicker
              label={t('trip.tripCategory')}
              optionsKey="trip.categories"
              options={['STANDARD', 'AIRPORT', 'LONG', 'SHORT', 'DELIVERY']}
              control={control}
              name="tripCategory"
            />

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
          </View>
        ) : null}

        {submitError ? (
          <View className="bg-danger/10 border border-danger/40 rounded-xl p-3">
            <Text className="text-danger text-sm text-center">{submitError}</Text>
          </View>
        ) : null}

        <Button label={t('common.save')} loading={mutation.isPending} onPress={handleSubmit(onSubmit, onInvalid)} />
      </View>
    </Screen>
  );
}

function ChipPicker({
  label,
  options,
  optionsKey,
  control,
  name,
}: {
  label: string;
  options: string[];
  optionsKey: string;
  control: any;
  name: any;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }) => (
        <View>
          <Text className="text-text mb-2 text-sm">{label} <Text className="text-textMuted text-xs">({t('common.optional')})</Text></Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable
              onPress={() => onChange(undefined)}
              className={`px-3 h-9 rounded-full items-center justify-center ${!value ? 'bg-accent' : 'bg-surface border border-border'}`}
            >
              <Text className={`text-xs ${!value ? 'text-bg' : 'text-text'}`}>—</Text>
            </Pressable>
            {options.map((o) => {
              const active = o === value;
              return (
                <Pressable
                  key={o}
                  onPress={() => onChange(o)}
                  className={`px-3 h-9 rounded-full items-center justify-center ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
                >
                  <Text className={`text-xs font-medium ${active ? 'text-bg' : 'text-text'}`}>
                    {t(`${optionsKey}.${o}`)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    />
  );
}

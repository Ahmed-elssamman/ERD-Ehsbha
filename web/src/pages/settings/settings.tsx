import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Car,
  Download,
  LogOut,
  Plus,
  Smartphone,
  Target,
  Trash2,
  User,
  MapPin,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import { useTheme } from '@/providers/theme-provider';
import {
  AppsApi,
  AreasApi,
  AuthApi,
  DriverApi,
  GoalsApi,
  VehiclesApi,
  type Area,
  type DriverApp,
  type Vehicle,
} from '@/lib/api/endpoints';
import { formatDate, formatMoney } from '@/lib/format';
import { useAuth } from '@/stores/auth.store';
import { queryClient } from '@/providers/query-provider';
import { toDateInputValue } from '@/lib/time';
import { vehicleLabel } from '@/hooks/use-vehicle-selector';
import { cn } from '@/lib/utils';
import { readApiError } from '@/lib/api/client';
import { openInstallDialog } from '@/components/pwa/update-prompt';

export function SettingsPage() {
  const { t, locale, toggleLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const refreshToken = useAuth((s) => s.refreshToken);
  const clear = useAuth((s) => s.clear);

  const handleLogout = async () => {
    try {
      if (refreshToken) await AuthApi.logout(refreshToken);
    } catch {
      // ignore
    }
    clear();
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <ProfileSection />
      <VehiclesSection />
      <AppsSection />
      <AreasSection />
      <GoalsSection />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.appearance')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('theme.toggle')}</p>
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`rounded-full px-3 py-1 text-xs ${theme === 'light' ? 'bg-card font-semibold shadow-soft' : 'text-muted-foreground'}`}
              >
                {t('theme.light')}
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`rounded-full px-3 py-1 text-xs ${theme === 'dark' ? 'bg-card font-semibold shadow-soft' : 'text-muted-foreground'}`}
              >
                {t('theme.dark')}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('language.label')}</p>
            <Button variant="outline" size="sm" onClick={toggleLocale}>
              {locale === 'ar' ? 'English' : 'العربية'}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" aria-hidden />
              <p className="text-sm font-medium">{t('pwa.installable')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={openInstallDialog}>
              {t('pwa.dialog.openSettings')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3 text-destructive">
            <LogOut className="h-5 w-5" aria-hidden />
            <p className="font-medium">{t('settings.logout')}</p>
          </div>
          <Button variant="destructive" onClick={handleLogout}>{t('common.logout')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------- Profile ------------------------------------------------------- */

const profileSchema = z.object({
  displayName: z.string().min(2).max(80),
  baseCity: z.string().max(80).optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

function ProfileSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['driver', 'me'], queryFn: DriverApi.me });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: '', baseCity: '' },
    values: data
      ? { displayName: data.displayName, baseCity: data.baseCity ?? '' }
      : undefined,
  });

  const updateMut = useMutation({
    mutationFn: DriverApi.update,
    onSuccess: (d) => {
      qc.setQueryData(['driver', 'me'], d);
      reset({ displayName: d.displayName, baseCity: d.baseCity ?? '' });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" aria-hidden /> {t('settings.profile')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <form
            onSubmit={handleSubmit((v) =>
              updateMut.mutateAsync({
                displayName: v.displayName,
                baseCity: v.baseCity?.trim() || null,
              }),
            )}
            className="grid gap-4 sm:grid-cols-2"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="displayName">{t('settings.profileFields.displayName')}</Label>
              <Input id="displayName" {...register('displayName')} invalid={!!errors.displayName} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="baseCity">{t('settings.profileFields.baseCity')}</Label>
              <Input id="baseCity" {...register('baseCity')} />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={!isDirty} loading={isSubmitting || updateMut.isPending}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/* -------- Vehicles ------------------------------------------------------ */

const vehicleSchema = z.object({
  type: z.enum(['CAR', 'BIKE']),
  make: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  year: z.coerce.number().int().min(1980).max(2100).optional(),
  fuelType: z.enum(['PETROL_80', 'PETROL_92', 'PETROL_95', 'DIESEL', 'CNG', 'ELECTRIC']),
  tankLiters: z.coerce.number().int().min(1).max(500).default(45),
  baselineKmPerLiter: z.coerce.number().min(1).max(100).default(12),
  odometerKm: z.coerce.number().int().min(0).default(0),
});
type VehicleForm = z.input<typeof vehicleSchema>;

function VehiclesSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['vehicles'], queryFn: VehiclesApi.list });
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const removeMut = useMutation({
    mutationFn: (id: string) => VehiclesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Car className="h-4 w-4 text-primary" aria-hidden /> {t('settings.vehicles')}
        </CardTitle>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> {t('common.add')}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t('common.noData')}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {data.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <button onClick={() => setEditing(v)} className="flex min-w-0 items-center gap-3 text-start">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Car className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{vehicleLabel(v)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(`settings.fuelTypes.${v.fuelType}`)} · {v.baselineKmPerLiter} km/L
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  {v.isActive ? <Badge variant="success">{t('common.active')}</Badge> : null}
                  <Button variant="ghost" size="icon" onClick={() => setConfirmId(v.id)} aria-label={t('common.delete')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <VehicleDialog
        open={adding || !!editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        vehicle={editing}
      />

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && removeMut.mutate(confirmId, { onSuccess: () => setConfirmId(null) })}
        title={t('common.confirmDelete')}
        body={t('common.confirmDeleteBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={removeMut.isPending}
      />
    </Card>
  );
}

function VehicleDialog({
  open,
  onClose,
  vehicle,
}: {
  open: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const blankVehicle: VehicleForm = {
    type: 'CAR',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    fuelType: 'PETROL_92',
    tankLiters: 45,
    baselineKmPerLiter: 12,
    odometerKm: 0,
  };

  const valuesFor = (v: Vehicle | null): VehicleForm =>
    v
      ? {
          type: v.type,
          make: v.make ?? '',
          model: v.model ?? '',
          year: v.year ?? new Date().getFullYear(),
          fuelType: v.fuelType,
          tankLiters: v.tankLiters,
          baselineKmPerLiter: v.baselineKmPerLiter,
          odometerKm: Math.floor(v.odometerMeters / 1000),
        }
      : blankVehicle;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleForm>({ resolver: zodResolver(vehicleSchema), defaultValues: valuesFor(vehicle) });

  // Re-apply values only when the dialog opens or the target vehicle changes,
  // not on every render (which would clobber the user's typing).
  useEffect(() => {
    if (!open) return;
    reset(valuesFor(vehicle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicle?.id]);

  const createMut = useMutation({
    mutationFn: VehiclesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      reset(blankVehicle);
      onClose();
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Vehicle> }) => VehiclesApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      reset(blankVehicle);
      onClose();
    },
  });

  const submit = handleSubmit((v) => {
    const body = {
      type: v.type,
      make: v.make?.trim() || undefined,
      model: v.model?.trim() || undefined,
      year: v.year ? Number(v.year) : undefined,
      fuelType: v.fuelType,
      tankLiters: Number(v.tankLiters),
      baselineKmPerLiter: Number(v.baselineKmPerLiter),
      odometerMeters: Math.round(Number(v.odometerKm) * 1000),
    };
    if (vehicle) return updateMut.mutateAsync({ id: vehicle.id, body });
    return createMut.mutateAsync(body);
  });

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset(valuesFor(vehicle));
        onClose();
      }}
      title={vehicle ? t('common.edit') : t('common.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={isSubmitting || createMut.isPending || updateMut.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="type">{t('settings.vehicleFields.type')}</Label>
          <Select id="type" {...register('type')}>
            <option value="CAR">{t('settings.vehicleType.CAR')}</option>
            <option value="BIKE">{t('settings.vehicleType.BIKE')}</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fuelType">{t('settings.vehicleFields.fuelType')}</Label>
          <Select id="fuelType" {...register('fuelType')}>
            {(['PETROL_80', 'PETROL_92', 'PETROL_95', 'DIESEL', 'CNG', 'ELECTRIC'] as const).map((f) => (
              <option key={f} value={f}>{t(`settings.fuelTypes.${f}`)}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="make">{t('settings.vehicleFields.make')}</Label>
          <Input id="make" {...register('make')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="model">{t('settings.vehicleFields.model')}</Label>
          <Input id="model" {...register('model')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="year">{t('settings.vehicleFields.year')}</Label>
          <Input id="year" type="number" dir="ltr" {...register('year')} invalid={!!errors.year} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tankLiters">{t('settings.vehicleFields.tankLiters')}</Label>
          <Input id="tankLiters" type="number" dir="ltr" {...register('tankLiters')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="baselineKmPerLiter">{t('settings.vehicleFields.kpl')}</Label>
          <Input id="baselineKmPerLiter" type="number" step="0.1" dir="ltr" {...register('baselineKmPerLiter')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="odometerKm">{t('settings.vehicleFields.odometer')}</Label>
          <Input id="odometerKm" type="number" dir="ltr" {...register('odometerKm')} />
        </div>
      </form>
    </Dialog>
  );
}

/* -------- Apps ---------------------------------------------------------- */

function AppsSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const mineQ = useQuery({ queryKey: ['apps', 'mine'], queryFn: AppsApi.mine });
  const catalogQ = useQuery({ queryKey: ['apps', 'catalog'], queryFn: AppsApi.catalog });
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DriverApp | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const removeMut = useMutation({
    mutationFn: (id: string) => AppsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apps'] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4 text-primary" aria-hidden /> {t('settings.apps')}
        </CardTitle>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> {t('common.add')}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {mineQ.isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !mineQ.data || mineQ.data.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t('common.noData')}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {mineQ.data.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-start hover:bg-accent/40"
                >
                  <span
                    className="h-9 w-9 shrink-0 rounded-lg"
                    style={{ background: a.color ?? 'hsl(var(--muted))' }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.customName ?? a.appSource?.name ?? '—'}</p>
                    <p className="num-tabular text-xs text-muted-foreground">
                      {Number(a.commissionPct)}% {t('settings.appFields.commission')}
                      {a.enabled ? '' : ` · ${t('common.inactive')}`}
                    </p>
                  </div>
                </button>
                <Button variant="ghost" size="icon" onClick={() => setConfirmId(a.id)} aria-label={t('common.delete')}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AddAppDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        catalog={catalogQ.data ?? []}
        myAppIds={new Set((mineQ.data ?? []).map((m) => m.appSourceId).filter(Boolean) as string[])}
      />

      <EditAppDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        app={editing}
      />

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && removeMut.mutate(confirmId, { onSuccess: () => setConfirmId(null) })}
        title={t('common.confirmDelete')}
        body={t('common.confirmDeleteBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={removeMut.isPending}
      />
    </Card>
  );
}

const CUSTOM_SENTINEL = '__custom__';

interface CatalogApp {
  id: string;
  name: string;
  defaultCommissionPct: number | string;
}

function AddAppDialog({
  open,
  onClose,
  catalog,
  myAppIds,
}: {
  open: boolean;
  onClose: () => void;
  catalog: CatalogApp[];
  myAppIds: Set<string>;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const availableCatalog = catalog.filter((c) => !myAppIds.has(c.id));

  // Fully controlled local state — no react-hook-form for the selection itself.
  const [selectedId, setSelectedId] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [commissionPct, setCommissionPct] = useState<string>('20');
  const [color, setColor] = useState('#34D399');
  const [error, setError] = useState<string | null>(null);

  // Initialize when the dialog opens or when the catalog availability changes.
  useEffect(() => {
    if (!open) return;
    const first = availableCatalog[0];
    setSelectedId(first ? first.id : CUSTOM_SENTINEL);
    setCustomName('');
    setCommissionPct(first ? String(Number(first.defaultCommissionPct ?? 20)) : '20');
    setColor('#34D399');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, availableCatalog.length]);

  const pickSource = (id: string) => {
    setSelectedId(id);
    setError(null);
    if (id !== CUSTOM_SENTINEL) {
      const found = availableCatalog.find((c) => c.id === id);
      if (found) setCommissionPct(String(Number(found.defaultCommissionPct ?? 20)));
    }
  };

  const addMut = useMutation({
    mutationFn: AppsApi.add,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apps'] });
      onClose();
    },
    onError: (err) => {
      setError(readApiError(err).message || t('errors.UNKNOWN'));
    },
  });

  const isCustom = !selectedId || selectedId === CUSTOM_SENTINEL;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    const pct = Number(commissionPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 60) {
      setError(t('settings.appFields.commissionInvalid'));
      return;
    }

    if (isCustom) {
      const name = customName.trim();
      if (name.length < 2) {
        setError(t('settings.appFields.customNameRequired'));
        return;
      }
      addMut.mutate({
        customName: name,
        commissionPct: pct,
        color,
        enabled: true,
      } as Parameters<typeof AppsApi.add>[0]);
      return;
    }

    addMut.mutate({
      appSourceId: selectedId,
      commissionPct: pct,
      color,
      enabled: true,
    } as Parameters<typeof AppsApi.add>[0]);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('settings.apps')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => submit()} loading={addMut.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label>{t('settings.appFields.name')}</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {availableCatalog.length === 0 ? (
              <p className="col-span-full rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                {t('settings.appFields.allAdded')}
              </p>
            ) : (
              availableCatalog.map((c) => {
                const isSelected = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickSource(c.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-start text-sm transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/30'
                        : 'border-border/60 bg-card hover:bg-accent/40',
                    )}
                  >
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="num-tabular text-xs text-muted-foreground">
                      {Number(c.defaultCommissionPct)}%
                    </span>
                  </button>
                );
              })
            )}
            <button
              key="__custom__"
              type="button"
              onClick={() => pickSource(CUSTOM_SENTINEL)}
              aria-pressed={isCustom}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors',
                isCustom
                  ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/30'
                  : 'border-border bg-card hover:bg-accent/40',
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('settings.appFields.custom')}</span>
            </button>
          </div>
        </div>

        {isCustom ? (
          <div className="space-y-1.5">
            <Label htmlFor="customName">{t('settings.appFields.customName')}</Label>
            <Input
              id="customName"
              autoFocus
              placeholder={t('settings.appFields.customNamePlaceholder')}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="commissionPct">{t('settings.appFields.commission')}</Label>
            <Input
              id="commissionPct"
              type="number"
              step="0.5"
              min={0}
              max={60}
              dir="ltr"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color">{t('settings.appFields.color')}</Label>
            <Input
              id="color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 p-1"
            />
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

/* -------- Edit app ------------------------------------------------------ */

const editAppSchema = z.object({
  customName: z.string().min(2).max(40).optional().or(z.literal('')),
  commissionPct: z.coerce.number().min(0).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  enabled: z.boolean().default(true),
});
type EditAppForm = z.input<typeof editAppSchema>;

function EditAppDialog({
  open,
  onClose,
  app,
}: {
  open: boolean;
  onClose: () => void;
  app: DriverApp | null;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const blank: EditAppForm = { customName: '', commissionPct: 20, color: '#34D399', enabled: true };
  const valuesFor = (a: DriverApp | null): EditAppForm =>
    a
      ? {
          customName: a.customName ?? '',
          commissionPct: Number(a.commissionPct),
          color: a.color ?? '#34D399',
          enabled: a.enabled,
        }
      : blank;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditAppForm>({
    resolver: zodResolver(editAppSchema),
    defaultValues: valuesFor(app),
  });

  useEffect(() => {
    if (!open) return;
    reset(valuesFor(app));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, app?.id]);

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<DriverApp> }) => AppsApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apps'] });
      onClose();
    },
  });

  const submit = handleSubmit((v) => {
    if (!app) return;
    return updateMut.mutateAsync({
      id: app.id,
      body: {
        commissionPct: Number(v.commissionPct),
        color: v.color,
        enabled: v.enabled,
        customName: v.customName?.trim() ? v.customName.trim() : null,
      } as Partial<DriverApp>,
    });
  });

  const title = app?.customName ?? app?.appSource?.name ?? t('common.edit');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={isSubmitting || updateMut.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="edit-customName">{t('settings.appFields.customName')}</Label>
          <Input
            id="edit-customName"
            placeholder={app?.appSource?.name ?? ''}
            invalid={!!errors.customName}
            {...register('customName')}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-commissionPct">{t('settings.appFields.commission')}</Label>
            <Input
              id="edit-commissionPct"
              type="number"
              step="0.5"
              min={0}
              max={60}
              dir="ltr"
              invalid={!!errors.commissionPct}
              {...register('commissionPct')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-color">{t('settings.appFields.color')}</Label>
            <Input id="edit-color" type="color" {...register('color')} className="h-11 p-1" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('enabled')} className="h-4 w-4 accent-primary" />
          <span>{t('settings.appFields.enabled')}</span>
        </label>
      </form>
    </Dialog>
  );
}

/* -------- Areas --------------------------------------------------------- */

const areaSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
type AreaForm = z.input<typeof areaSchema>;

function AreasSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['areas'], queryFn: AreasApi.list });
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Area | null>(null);

  const removeMut = useMutation({
    mutationFn: (id: string) => AreasApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['areas'] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-primary" aria-hidden /> {t('settings.areas')}
        </CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> {t('common.add')}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5"><Skeleton className="h-10 w-full" /></div>
        ) : !data || data.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t('common.noData')}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {data.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <button onClick={() => { setEditing(a); setOpen(true); }} className="flex items-center gap-3 text-start">
                  <span
                    className="h-7 w-7 rounded-md"
                    style={{ background: a.color ?? 'hsl(var(--muted))' }}
                    aria-hidden
                  />
                  <p className="font-medium">{a.name}</p>
                </button>
                <Button variant="ghost" size="icon" onClick={() => setConfirmId(a.id)} aria-label={t('common.delete')}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AreaDialog
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        area={editing}
      />

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && removeMut.mutate(confirmId, { onSuccess: () => setConfirmId(null) })}
        title={t('common.confirmDelete')}
        body={t('common.confirmDeleteBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={removeMut.isPending}
      />
    </Card>
  );
}

function AreaDialog({ open, onClose, area }: { open: boolean; onClose: () => void; area: Area | null }) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const blank: AreaForm = { name: '', color: '#60A5FA' };
  const valuesFor = (a: Area | null): AreaForm =>
    a ? { name: a.name, color: a.color ?? '#60A5FA' } : blank;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AreaForm>({ resolver: zodResolver(areaSchema), defaultValues: valuesFor(area) });

  useEffect(() => {
    if (!open) return;
    reset(valuesFor(area));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, area?.id]);

  const createMut = useMutation({
    mutationFn: AreasApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['areas'] });
      reset(blank);
      onClose();
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<{ name: string; color: string }> }) => AreasApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['areas'] });
      reset(blank);
      onClose();
    },
  });

  const submit = handleSubmit((v) => {
    if (area) return updateMut.mutateAsync({ id: area.id, body: { name: v.name, color: v.color } });
    return createMut.mutateAsync({ name: v.name, color: v.color });
  });

  return (
    <Dialog
      open={open}
      onClose={() => { reset(valuesFor(area)); onClose(); }}
      title={area ? t('common.edit') : t('common.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={isSubmitting || createMut.isPending || updateMut.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">{t('settings.areaFields.name')}</Label>
          <Input id="name" {...register('name')} invalid={!!errors.name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="color">{t('settings.areaFields.color')}</Label>
          <Input id="color" type="color" {...register('color')} className="h-11 p-1" />
        </div>
      </form>
    </Dialog>
  );
}

/* -------- Goals --------------------------------------------------------- */

const goalSchema = z.object({
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  targetEgp: z.coerce.number().min(1),
  startsOn: z.string().min(1),
  endsOn: z.string().min(1),
});
type GoalForm = z.input<typeof goalSchema>;

function GoalsSection() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['goals'], queryFn: GoalsApi.list });
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const removeMut = useMutation({
    mutationFn: (id: string) => GoalsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" aria-hidden /> {t('settings.goals')}
        </CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> {t('common.add')}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5"><Skeleton className="h-10 w-full" /></div>
        ) : !data || data.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t('common.noData')}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {data.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{t(`settings.periods.${g.period}`)}</p>
                    {g.isActive ? <Badge variant="success">{t('common.active')}</Badge> : <Badge variant="muted">{t('common.inactive')}</Badge>}
                  </div>
                  <p className="num-tabular text-xs text-muted-foreground">
                    {formatMoney(g.targetPiastres, locale)}
                    {' · '}
                    {formatDate(g.startsOn, locale)} → {formatDate(g.endsOn, locale)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setConfirmId(g.id)} aria-label={t('common.delete')}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <GoalDialog open={open} onClose={() => setOpen(false)} />

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && removeMut.mutate(confirmId, { onSuccess: () => setConfirmId(null) })}
        title={t('common.confirmDelete')}
        body={t('common.confirmDeleteBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={removeMut.isPending}
      />
    </Card>
  );
}

function GoalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const computeDefaults = (): GoalForm => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      period: 'MONTHLY',
      targetEgp: 0,
      startsOn: toDateInputValue(firstOfMonth),
      endsOn: toDateInputValue(lastOfMonth),
    };
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GoalForm>({ resolver: zodResolver(goalSchema), defaultValues: computeDefaults() });

  useEffect(() => {
    if (!open) return;
    reset(computeDefaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const createMut = useMutation({
    mutationFn: GoalsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); reset(computeDefaults()); onClose(); },
  });

  const submit = handleSubmit((v) =>
    createMut.mutateAsync({
      period: v.period,
      targetPiastres: Math.round(Number(v.targetEgp) * 100),
      startsOn: new Date(v.startsOn).toISOString(),
      endsOn: new Date(v.endsOn).toISOString(),
    }),
  );

  return (
    <Dialog
      open={open}
      onClose={() => { reset(computeDefaults()); onClose(); }}
      title={t('settings.goals')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={isSubmitting || createMut.isPending}>{t('common.save')}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="period">{t('settings.goalFields.period')}</Label>
          <Select id="period" {...register('period')}>
            <option value="DAILY">{t('settings.periods.DAILY')}</option>
            <option value="WEEKLY">{t('settings.periods.WEEKLY')}</option>
            <option value="MONTHLY">{t('settings.periods.MONTHLY')}</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="targetEgp">{t('settings.goalFields.target')}</Label>
          <Input id="targetEgp" type="number" min={1} step="1" dir="ltr" {...register('targetEgp')} invalid={!!errors.targetEgp} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="startsOn">{t('settings.goalFields.startsOn')}</Label>
          <Input id="startsOn" type="date" {...register('startsOn')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endsOn">{t('settings.goalFields.endsOn')}</Label>
          <Input id="endsOn" type="date" {...register('endsOn')} />
        </div>
      </form>
    </Dialog>
  );
}


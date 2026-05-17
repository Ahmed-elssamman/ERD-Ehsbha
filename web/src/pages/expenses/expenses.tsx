import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import { ExpensesApi, VehiclesApi, type ExpenseCategory } from '@/lib/api/endpoints';
import { formatDate, formatMoney } from '@/lib/format';
import { toDatetimeLocalValue } from '@/lib/time';

const CATEGORIES: ExpenseCategory[] = ['RENT', 'INSURANCE', 'FINE', 'TOLL', 'FOOD', 'PHONE', 'WASH', 'PARKING', 'OTHER'];

const schema = z.object({
  category: z.enum(['RENT', 'INSURANCE', 'FINE', 'TOLL', 'FOOD', 'PHONE', 'WASH', 'PARKING', 'OTHER']),
  amountEgp: z.coerce.number().min(0.01),
  dateTime: z.string().min(1),
  vehicleId: z.string().optional(),
  isRecurring: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});
type FormValues = z.input<typeof schema>;

export function ExpensesPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data: items, isLoading } = useQuery({
    queryKey: ['expenses', { since }],
    queryFn: () => ExpensesApi.list({ from: since, limit: 50 }),
    staleTime: 30_000,
  });

  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: VehiclesApi.list });

  const monthTotal = (items ?? []).reduce((s, e) => s + e.amountPiastres, 0);
  const byCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of items ?? []) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amountPiastres);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const removeMut = useMutation({
    mutationFn: (id: string) => ExpensesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      setConfirmId(null);
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('expenses.title')}
        subtitle={t('expenses.subtitle')}
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden /> {t('expenses.add')}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('expenses.totalMonth')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="num-tabular text-3xl font-bold tracking-tight">{formatMoney(monthTotal, locale)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('expenses.byCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {byCategory.slice(0, 5).map(([cat, amt]) => {
                  const pct = monthTotal > 0 ? (amt / monthTotal) * 100 : 0;
                  return (
                    <li key={cat}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{t(`expenses.category.${cat}`)}</span>
                        <span className="num-tabular text-muted-foreground">{formatMoney(amt, locale)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className="h-full rounded-full bg-primary/70"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <ul className="divide-y divide-border/60">
              {[0, 1, 2].map((i) => (
                <li key={i} className="px-5 py-4">
                  <Skeleton className="h-12 w-full" />
                </li>
              ))}
            </ul>
          ) : !items || items.length === 0 ? (
            <EmptyState
              Icon={Receipt}
              title={t('expenses.empty')}
              body={t('expenses.emptyBody')}
              action={
                <Button onClick={() => setOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> {t('expenses.add')}
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((e) => (
                <motion.li
                  key={e.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16 }}
                  className="flex items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{t(`expenses.category.${e.category}`)}</span>
                      {e.isRecurring ? <Badge variant="muted">{t('expenses.field.recurring')}</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(e.dateTime, locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {e.notes ? ` · ${e.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="num-tabular font-semibold">{formatMoney(e.amountPiastres, locale)}</span>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmId(e.id)} aria-label={t('common.delete')}>
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                    </Button>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ExpenseDialog open={open} onClose={() => setOpen(false)} vehicleOptions={vehiclesQ.data ?? []} />

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && removeMut.mutate(confirmId)}
        title={t('common.confirmDelete')}
        body={t('common.confirmDeleteBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={removeMut.isPending}
      />
    </div>
  );
}

function ExpenseDialog({
  open,
  onClose,
  vehicleOptions,
}: {
  open: boolean;
  onClose: () => void;
  vehicleOptions: Array<{ id: string; make?: string | null; model?: string | null; type: string }>;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const defaults: FormValues = {
    category: 'FOOD',
    amountEgp: 0,
    dateTime: toDatetimeLocalValue(new Date()),
    vehicleId: '',
    isRecurring: false,
    notes: '',
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  const createMut = useMutation({
    mutationFn: ExpensesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      reset(defaults);
      onClose();
    },
  });

  const submit = handleSubmit((v) =>
    createMut.mutateAsync({
      category: v.category,
      amountPiastres: Math.round(Number(v.amountEgp) * 100),
      dateTime: new Date(v.dateTime).toISOString(),
      vehicleId: v.vehicleId || null,
      isRecurring: v.isRecurring,
      notes: v.notes?.trim() || null,
    }),
  );

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset(defaults);
        onClose();
      }}
      title={t('expenses.add')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={isSubmitting || createMut.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="category">{t('expenses.field.category')}</Label>
            <Select id="category" {...register('category')}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`expenses.category.${c}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amountEgp">{t('expenses.field.amount')}</Label>
            <Input
              id="amountEgp"
              type="number"
              step="0.01"
              min={0.01}
              dir="ltr"
              invalid={!!errors.amountEgp}
              {...register('amountEgp')}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="dateTime">{t('expenses.field.dateTime')}</Label>
            <Input id="dateTime" type="datetime-local" {...register('dateTime')} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="vehicleId">{t('expenses.field.vehicle')}</Label>
            <Select id="vehicleId" {...register('vehicleId')}>
              <option value="">—</option>
              {vehicleOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {[v.make, v.model].filter(Boolean).join(' ') || v.type}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" {...register('isRecurring')} className="h-4 w-4 accent-primary" />
            <span>{t('expenses.field.recurring')}</span>
          </label>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">{t('expenses.field.notes')}</Label>
            <Textarea id="notes" rows={2} {...register('notes')} />
          </div>
        </div>
      </form>
    </Dialog>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, HeartPulse, Settings as SettingsIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { VehiclesApi } from '@/lib/api/endpoints';
import { formatMoney } from '@/lib/format';
import { useVehicleSelector, vehicleLabel } from '@/hooks/use-vehicle-selector';

const PALETTE = ['#34D399', '#60A5FA', '#F59E0B', '#F87171', '#A78BFA', '#22D3EE', '#FB7185', '#FACC15'];

export function VehicleHealthPage() {
  const { t, locale } = useI18n();
  const { vehicles, selectedId, setSelectedId, isLoading } = useVehicleSelector();

  const summaryQ = useQuery({
    queryKey: ['vehicle', selectedId, 'cost-summary'],
    queryFn: () => VehiclesApi.costSummary(selectedId),
    enabled: !!selectedId,
  });

  if (!isLoading && vehicles.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title={t('vehicleHealth.title')} subtitle={t('vehicleHealth.subtitle')} />
        <EmptyState
          Icon={HeartPulse}
          title={t('vehicleHealth.noVehicles')}
          action={
            <Button asChild>
              <Link to="/settings">{t('nav.settings')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const data = summaryQ.data;
  const completenessPct = data ? data.completenessBp / 100 : 0;
  const components = data?.components ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('vehicleHealth.title')}
        subtitle={t('vehicleHealth.subtitle')}
        actions={
          vehicles.length > 1 ? (
            <Select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="min-w-[12rem]"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {vehicleLabel(v)}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" aria-hidden /> {t('vehicleHealth.totalPerKm')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQ.isLoading ? (
              <Skeleton className="h-12 w-32" />
            ) : !data ? (
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            ) : (
              <>
                <p className="num-tabular text-3xl font-bold tracking-tight">
                  {formatMoney(data.totalPerKmPiastres, locale)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t('common.perKm')}</p>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">{t('vehicleHealth.completeness')}</p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-secondary"
                      initial={{ width: 0 }}
                      animate={{ width: `${completenessPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="num-tabular mt-1 text-sm font-semibold">{Math.round(completenessPct)}%</p>
                </div>
                <Button variant="outline" className="mt-5 w-full gap-2" asChild>
                  <Link to="/settings">
                    <SettingsIcon className="h-4 w-4" /> {t('vehicleHealth.configure')}
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('vehicleHealth.components')}</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQ.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : components.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            ) : (
              <div className="grid items-center gap-4 sm:grid-cols-5">
                <div className="h-56 sm:col-span-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={components.map((c) => ({ name: c.key, value: c.perKmPiastres }))}
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {components.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 12,
                          color: 'hsl(var(--card-foreground))',
                        }}
                        formatter={(value: number) => formatMoney(value, locale)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2 sm:col-span-3">
                  {components.map((c, i) => (
                    <li key={c.key} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: PALETTE[i % PALETTE.length] }}
                          aria-hidden
                        />
                        <span className="truncate font-medium">{c.key}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="num-tabular text-muted-foreground">
                          {formatMoney(c.perKmPiastres, locale)} {t('common.perKm')}
                        </span>
                        <span className="num-tabular w-12 text-end text-xs text-muted-foreground">
                          {c.sharePct.toFixed(0)}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

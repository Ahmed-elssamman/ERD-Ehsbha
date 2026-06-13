import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Star } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { driversApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import { cn, formatNumber, formatPiastres } from '@/lib/utils';

interface DriverData {
  id: string;
  displayName: string;
  baseCity: string | null;
  createdAt: string;
  user: { phone: string; email: string | null; status: string };
  vehicles: Array<{ id: string; type: string; make: string | null; model: string | null; year: number | null; isActive: boolean; fuelType: string; odometerMeters: bigint | number | string }>;
  driverApps: Array<{ id: string; enabled: boolean; commissionPct: string; customName: string | null; appSource: { code: string; name: string } }>;
  areas: Array<{ id: string; name: string }>;
  _count: { trips: number; fuelLogs: number; expenses: number; maintenanceRecords: number };
  latestScore: { overall: number; efficiency: number; profit: number; safety: number; consistency: number; date: string } | null;
  scoreHistory: Array<{ date: string; overall: number; efficiency: number; profit: number; safety: number; consistency: number }>;
  last30DaysAggregates: Array<{ date: string; tripCount: number; grossPiastres: number; netProfitPiastres: number; totalKmMeters: number }>;
  areaBreakdown: Array<{ areaId: string; areaName: string; tripCount: number; grossPiastres: number; netProfitPiastres: number }>;
  appBreakdown: Array<{ driverAppId: string; appName: string; tripCount: number; grossPiastres: number; netProfitPiastres: number }>;
  totals: { netProfitPiastres: number; grossPiastres: number; totalKmMeters: number; fuelPiastres: number; expensePiastres: number };
}

interface RecentTrip {
  id: string;
  startedAt: string;
  endedAt: string;
  grossPiastres: number;
  totalKmMeters: number;
  emptyKmMeters: number;
  appName: string;
  areaName: string | null;
}

type TabKey = 'overview' | 'trips' | 'vehicles' | 'apps' | 'score' | 'analytics';

export function DriverDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [tab, setTab] = useState<TabKey>('overview');

  const { data, isLoading, error } = useQuery<DriverData>({
    queryKey: ['admin', 'driver', id],
    queryFn: () => driversApi.get(id),
    enabled: Boolean(id),
  });

  const recentTrips = useQuery<RecentTrip[]>({
    queryKey: ['admin', 'driver', id, 'trips'],
    queryFn: () => driversApi.recentTrips(id, 20),
    enabled: Boolean(id) && tab === 'trips',
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center text-danger">
        Failed to load driver. <Link to="/drivers" className="text-primary underline">{t('common.back')}</Link>
      </div>
    );
  }

  const TABS: Array<{ key: TabKey; label: string }> = [
    { key: 'overview', label: t('drivers.tabs.overview') },
    { key: 'trips', label: t('drivers.tabs.trips') },
    { key: 'vehicles', label: t('drivers.tabs.vehicles') },
    { key: 'apps', label: t('drivers.tabs.apps') },
    { key: 'score', label: t('drivers.tabs.score') },
    { key: 'analytics', label: t('drivers.tabs.analytics') },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/drivers')} className="mb-4">
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </Button>

      <PageHeader
        title={data.displayName}
        description={`${data.user.phone} · ${t('drivers.baseCity')}: ${data.baseCity ?? '—'}`}
      />

      <div className="mb-6 flex flex-wrap gap-1 border-b">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === tb.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab data={data} />}
      {tab === 'trips' && <TripsTab driverId={id} trips={recentTrips.data} loading={recentTrips.isLoading} />}
      {tab === 'vehicles' && <VehiclesTab vehicles={data.vehicles} />}
      {tab === 'apps' && <AppsTab apps={data.driverApps} />}
      {tab === 'score' && <ScoreTab latest={data.latestScore} history={data.scoreHistory} />}
      {tab === 'analytics' && <AnalyticsTab data={data} />}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function OverviewTab({ data }: { data: DriverData }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label={t('drivers.netProfit')} value={formatPiastres(data.totals.netProfitPiastres)} />
        <StatTile label={t('drivers.gross')} value={formatPiastres(data.totals.grossPiastres)} />
        <StatTile label={t('drivers.distance')} value={`${formatNumber(Math.round(data.totals.totalKmMeters / 1000))} km`} />
        <StatTile label={t('drivers.tabs.trips')} value={formatNumber(data._count.trips)} />
        <StatTile label={t('drivers.fuelLogs')} value={formatNumber(data._count.fuelLogs)} />
      </div>

      <Card>
        <CardHeader><CardTitle>{t('drivers.last7Days')}</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.last30DaysAggregates.slice(-7)}>
              <defs>
                <linearGradient id="dDriver" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Area type="monotone" dataKey="netProfitPiastres" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#dDriver)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function TripsTab({ driverId, trips, loading }: { driverId: string; trips: RecentTrip[] | undefined; loading: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (!trips || trips.length === 0) return <div className="text-sm text-muted-foreground">{t('analytics.noData')}</div>;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-start font-medium">{t('trips.started')}</th>
            <th className="px-4 py-2 text-start font-medium">{t('trips.app')}</th>
            <th className="px-4 py-2 text-start font-medium">{t('trips.area')}</th>
            <th className="px-4 py-2 text-end font-medium">{t('trips.grossLabel')}</th>
            <th className="px-4 py-2 text-end font-medium">{t('trips.distance')}</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((tr) => (
            <tr key={tr.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/30" onClick={() => navigate(`/trips/${tr.id}`)}>
              <td className="px-4 py-2 text-muted-foreground">{new Date(tr.startedAt).toLocaleString()}</td>
              <td className="px-4 py-2"><Badge variant="outline">{tr.appName}</Badge></td>
              <td className="px-4 py-2">{tr.areaName ?? '—'}</td>
              <td className="px-4 py-2 text-end font-medium">{formatPiastres(tr.grossPiastres)}</td>
              <td className="px-4 py-2 text-end">{formatNumber(Math.round(tr.totalKmMeters / 1000))} km</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t p-2 text-end">
        <Link to={`/trips?driverId=${driverId}`} className="text-xs text-primary hover:underline">
          {t('drivers.tabs.trips')} →
        </Link>
      </div>
    </div>
  );
}

function VehiclesTab({ vehicles }: { vehicles: DriverData['vehicles'] }) {
  const { t } = useI18n();
  if (vehicles.length === 0) return <div className="text-sm text-muted-foreground">{t('drivers.none')}</div>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {vehicles.map((v) => (
        <Card key={v.id}>
          <CardContent className="space-y-2 pt-4 text-sm">
            <div className="flex items-center justify-between">
              <Badge variant={v.type === 'CAR' ? 'default' : 'outline'}>{v.type}</Badge>
              {v.isActive ? <Badge variant="success">{t('vehicles.on')}</Badge> : <Badge variant="muted">{t('vehicles.off')}</Badge>}
            </div>
            <div className="break-words font-medium">{[v.make, v.model, v.year].filter(Boolean).join(' ') || t('vehicles.unspecified')}</div>
            <div className="text-xs text-muted-foreground">
              <Badge variant="outline">{v.fuelType}</Badge>
              <span className="ms-2">{formatNumber(Math.round(Number(v.odometerMeters) / 1000))} km</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AppsTab({ apps }: { apps: DriverData['driverApps'] }) {
  const { t } = useI18n();
  if (apps.length === 0) return <div className="text-sm text-muted-foreground">{t('drivers.none')}</div>;
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {apps.map((a) => (
        <Card key={a.id}>
          <CardContent className="flex items-center justify-between gap-2 pt-4">
            <div className="min-w-0">
              <div className="truncate font-medium">{a.customName ?? a.appSource.name}</div>
              <div className="text-xs text-muted-foreground">{a.appSource.code}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge variant="outline">{Number(a.commissionPct).toFixed(0)}%</Badge>
              {a.enabled ? <Badge variant="success">{t('vehicles.on')}</Badge> : <Badge variant="muted">{t('vehicles.off')}</Badge>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ScoreTab({ latest, history }: { latest: DriverData['latestScore']; history: DriverData['scoreHistory'] }) {
  const { t } = useI18n();
  if (!latest) return <div className="text-sm text-muted-foreground">{t('drivers.noSnapshot')}</div>;
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="inline-flex items-center gap-1.5"><Star className="h-4 w-4 text-warning" /> {t('drivers.latestScore')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-5">
            {(['overall', 'efficiency', 'profit', 'safety', 'consistency'] as const).map((k) => (
              <div key={k} className="rounded-lg border bg-card p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t(`drivers.${k}`)}</div>
                <div className="mt-0.5 text-2xl font-semibold">{latest[k]}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-end text-[10px] text-muted-foreground">{t('drivers.asOf')} {new Date(latest.date).toLocaleDateString()}</div>
        </CardContent>
      </Card>

      {history.length > 1 && (
        <Card>
          <CardHeader><CardTitle>{t('drivers.tabs.score')}</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Line type="monotone" dataKey="overall" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AnalyticsTab({ data }: { data: DriverData }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle>{t('analytics.tripsByApp')}</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.appBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="appName" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Bar dataKey="grossPiastres" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('analytics.tripsByArea')}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{t('common.name')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('drivers.tabs.trips')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('drivers.gross')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('drivers.netProfit')}</th>
                </tr>
              </thead>
              <tbody>
                {data.areaBreakdown.map((a) => (
                  <tr key={a.areaId} className="border-b last:border-0">
                    <td className="px-3 py-2">{a.areaName}</td>
                    <td className="px-3 py-2 text-end">{formatNumber(a.tripCount)}</td>
                    <td className="px-3 py-2 text-end">{formatPiastres(a.grossPiastres)}</td>
                    <td className="px-3 py-2 text-end font-semibold">{formatPiastres(a.netProfitPiastres)}</td>
                  </tr>
                ))}
                {data.areaBreakdown.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{t('analytics.noData')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

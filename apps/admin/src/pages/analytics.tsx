import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ThumbsUp, MessageSquare } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { analyticsApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n/provider';
import { formatNumber, formatPiastres } from '@/lib/utils';

export function AnalyticsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'analytics', 'overview'],
    queryFn: () => analyticsApi.overview(),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
        </div>
      </div>
    );
  }
  if (error || !data) {
    return <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{t('common.error')}</div>;
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t('analytics.title')} description={t('analytics.subtitleFmt', { date: new Date(data.since).toLocaleDateString() })} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('analytics.grossPiastres')} value={formatPiastres(data.totals.grossPiastres)} />
        <Stat label={t('analytics.netProfit')} value={formatPiastres(data.totals.netProfitPiastres)} />
        <Stat label={t('analytics.distance')} value={`${formatNumber(Math.round(data.totals.totalKmMeters / 1000))} km`} />
        <Stat label={t('analytics.fuel')} value={formatPiastres(data.totals.fuelPiastres)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('analytics.tripsPerDay')}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.tripsByDay}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Area type="monotone" dataKey="trips" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('analytics.tripsByApp')}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.tripsByApp}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="appName" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="tripCount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
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
                  </tr>
                </thead>
                <tbody>
                  {data.tripsByArea.slice(0, 10).map((a) => (
                    <tr key={a.areaId ?? a.areaName} className="border-b last:border-0">
                      <td className="px-3 py-2">{a.areaName}</td>
                      <td className="px-3 py-2 text-end">{formatNumber(a.tripCount)}</td>
                      <td className="px-3 py-2 text-end font-semibold">{formatPiastres(a.grossPiastres)}</td>
                    </tr>
                  ))}
                  {data.tripsByArea.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">{t('analytics.noData')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('analytics.topDrivers')}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">{t('drivers.title')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('analytics.period')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('drivers.netProfit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topDriversByProfit.slice(0, 10).map((d) => (
                    <tr
                      key={`${d.driverId}-${d.year}-${d.month}`}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                      onClick={() => navigate(`/drivers/${d.driverId}`)}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{d.displayName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{d.phone}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{d.year}-{String(d.month).padStart(2, '0')}</td>
                      <td className="px-3 py-2 text-end font-semibold">{formatPiastres(d.netProfitPiastres)}</td>
                    </tr>
                  ))}
                  {data.topDriversByProfit.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">{t('analytics.noData')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="inline-flex items-center gap-1.5"><ThumbsUp className="h-4 w-4" /> {t('analytics.topPosts')}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.topPosts.slice(0, 10).map((p) => (
                <li
                  key={p.id}
                  className="cursor-pointer rounded-md border p-2.5 transition-colors hover:bg-muted/30"
                  onClick={() => navigate('/community')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{p.title}</span>
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                      <ThumbsUp className="h-3 w-3" /> {formatNumber(p.likeCount)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="me-1.5">{p.category.replace(/_/g, ' ')}</Badge>
                    {p.driverDisplayName}
                  </div>
                </li>
              ))}
              {data.topPosts.length === 0 && <li className="text-center text-sm text-muted-foreground">{t('analytics.noData')}</li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="inline-flex items-center gap-1.5"><MessageSquare className="h-4 w-4" /> {t('analytics.topTickets')}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">{t('support.category')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('common.status')}</th>
                    <th className="px-3 py-2 text-end font-medium">#</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topTicketSubjects.slice(0, 10).map((row, i) => (
                    <tr
                      key={`${row.category}-${row.status}-${i}`}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                      onClick={() => navigate(`/support?status=${row.status}&category=${row.category}`)}
                    >
                      <td className="px-3 py-2"><Badge variant="outline">{row.category.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-3 py-2">{row.status.replace('_', ' ')}</td>
                      <td className="px-3 py-2 text-end font-semibold">{formatNumber(row.count)}</td>
                    </tr>
                  ))}
                  {data.topTicketSubjects.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">{t('analytics.noData')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

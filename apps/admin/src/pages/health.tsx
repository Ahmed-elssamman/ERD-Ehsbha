import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { miscApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import { formatNumber } from '@/lib/utils';

interface Snapshot {
  checks: Record<string, { ok: boolean; message: string }>;
  counts: {
    users: number;
    drivers: number;
    trips: number;
    activeDriverRefreshTokens: number;
    activeAdminRefreshTokens: number;
    openSupportTickets: number;
  };
  generatedAt: string;
}

export function HealthPage() {
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () => miscApi.health() as Promise<Snapshot>,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (error || !data) return <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{t('common.error')}</div>;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t('health.title')} description={t('health.subtitleFmt', { time: new Date(data.generatedAt).toLocaleString() })} />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('health.checks')}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(data.checks).map(([k, v]) => (
            <Card key={k}>
              <CardContent className="flex items-start gap-2 pt-4">
                {v.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 text-danger" />}
                <div>
                  <div className="font-medium capitalize">{k}</div>
                  <p className="text-sm text-muted-foreground">{v.message}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('health.liveCounts')}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            { label: t('nav.users'), value: data.counts.users },
            { label: t('nav.drivers'), value: data.counts.drivers },
            { label: t('nav.trips'), value: data.counts.trips },
            { label: t('health.activeDriverSessions'), value: data.counts.activeDriverRefreshTokens },
            { label: t('health.activeAdminSessions'), value: data.counts.activeAdminRefreshTokens },
            { label: t('health.openTickets'), value: data.counts.openSupportTickets },
          ].map((m) => (
            <Card key={m.label}>
              <CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-semibold">{formatNumber(m.value)}</div></CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

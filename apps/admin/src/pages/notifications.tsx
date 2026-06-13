import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Send } from 'lucide-react';
import { notificationsApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/provider';

const SEVERITY_VARIANT = {
  info: 'default',
  medium: 'warning',
  high: 'warning',
  critical: 'danger',
} as const;

export function NotificationsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'alerts' | 'outbound'>('alerts');

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t('notifs.title')} description={t('notifs.subtitle')} />
      <div className="mb-4 inline-flex rounded-md border bg-card p-0.5">
        {(
          [
            { v: 'alerts', label: t('notifs.alertsTab'), icon: Bell },
            { v: 'outbound', label: t('notifs.outboundTab'), icon: Send },
          ] as const
        ).map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === v ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'alerts' ? <AlertsTab /> : <OutboundTab />}
    </div>
  );
}

function AlertsTab() {
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'alerts'],
    queryFn: () => notificationsApi.alerts({ limit: 30 }),
  });

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (error) return <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{t('common.error')}</div>;
  if (!data || data.items.length === 0) {
    return <EmptyState icon={Bell} title={t('notifs.noAlerts')} description={t('notifs.quietPlatform')} />;
  }

  return (
    <div className="space-y-2">
      {data.items.map((a, i) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.2) }}
        >
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={SEVERITY_VARIANT[a.severity]}>{a.severity}</Badge>
                    <code className="text-[10px] text-muted-foreground">{a.code}</code>
                    {a.resolvedAt && <Badge variant="success">Resolved</Badge>}
                  </div>
                  <h3 className="mt-1.5 font-semibold">{a.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function OutboundTab() {
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'outbound-notifs'],
    queryFn: () => notificationsApi.outbound({ limit: 30 }),
  });

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (error) return <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{t('common.error')}</div>;
  if (!data || data.items.length === 0) {
    return <EmptyState icon={Send} title={t('notifs.noNotifs')} description={t('notifs.outboundEmpty')} />;
  }

  return (
    <div className="space-y-2">
      {data.items.map((n, i) => (
        <motion.div
          key={n.id}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.2) }}
        >
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{n.channel}</Badge>
                    {n.readAt && <Badge variant="success">Read</Badge>}
                    <span className="text-xs text-muted-foreground">
                      to <span className="font-medium text-foreground">{n.driverDisplayName}</span> · {n.driverPhone}
                    </span>
                  </div>
                  <h3 className="mt-1.5 font-semibold">{n.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(n.sentAt).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { NotificationsApi } from '@/lib/api/endpoints';
import { formatDate, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export function NotificationsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => NotificationsApi.list({ limit: 50 }),
  });

  const markMut = useMutation({
    mutationFn: (id: string) => NotificationsApi.markRead(id) as Promise<unknown>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = data?.items ?? [];
  const unread = items.filter((n) => !n.readAt);

  const markAll = async () => {
    await Promise.all(unread.map((n) => NotificationsApi.markRead(n.id)));
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        actions={
          unread.length > 0 ? (
            <Button variant="outline" onClick={markAll} className="gap-2">
              <Check className="h-4 w-4" /> {t('notifications.markAllRead')}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <ul className="divide-y divide-border/60">
              {[0, 1, 2].map((i) => (
                <li key={i} className="p-5">
                  <Skeleton className="h-12 w-full" />
                </li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            <EmptyState Icon={Bell} title={t('notifications.empty')} />
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((n, i) => (
                <motion.li
                  key={n.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, delay: Math.min(i, 10) * 0.02 }}
                  className={cn('flex items-start justify-between gap-3 px-5 py-4', !n.readAt && 'bg-primary/5')}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        'mt-1 h-2 w-2 shrink-0 rounded-full',
                        n.readAt ? 'bg-muted-foreground/40' : 'bg-primary',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{n.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {formatDate(n.sentAt, locale, { day: 'numeric', month: 'short' })} ·{' '}
                        <span dir="ltr">{formatTime(n.sentAt, locale)}</span>
                      </p>
                    </div>
                  </div>
                  {!n.readAt ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markMut.mutate(n.id)}
                      className="gap-1.5 text-xs"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t('notifications.markRead')}
                    </Button>
                  ) : null}
                </motion.li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

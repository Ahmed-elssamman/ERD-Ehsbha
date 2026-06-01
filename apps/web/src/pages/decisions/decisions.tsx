import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import { RecommendationsApi } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';

const TONE_STYLES: Record<string, string> = {
  earn: 'bg-success/10 text-success border-success/30',
  protect: 'bg-warning/10 text-warning border-warning/30',
  goal: 'bg-secondary/10 text-secondary border-secondary/30',
};

const TONE_BADGE: Record<string, string> = {
  earn: 'bg-success/15 text-success',
  protect: 'bg-warning/15 text-warning',
  goal: 'bg-secondary/15 text-secondary',
};

export function DecisionsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['recommendations', 'all'],
    queryFn: () => RecommendationsApi.list('home'),
  });

  const dismissMut = useMutation({
    mutationFn: (id: string) => RecommendationsApi.dismiss(id) as Promise<unknown>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recommendations'] });
      qc.invalidateQueries({ queryKey: ['decisions'] });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('decisions.title')} subtitle={t('decisions.subtitle')} />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState Icon={Sparkles} title={t('decisions.empty')} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <AnimatePresence>
            {data.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: 12 }}
                transition={{ duration: 0.2, delay: Math.min(i, 6) * 0.04 }}
                className={cn(
                  'group relative rounded-2xl border p-4 sm:p-5',
                  d.tone ? TONE_STYLES[d.tone] ?? 'border-border bg-card' : 'border-border bg-card',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                      d.tone ? TONE_BADGE[d.tone] ?? 'bg-muted text-muted-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Lightbulb className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-snug">{d.title}</h3>
                      {d.tone ? (
                        <Badge variant="muted" className="shrink-0">{t(`decisions.tone.${d.tone}`)}</Badge>
                      ) : null}
                    </div>
                    {d.body ? <p className="mt-1 text-sm opacity-90">{d.body}</p> : null}
                    <div className="mt-3 flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissMut.mutate(d.id)}
                        className="gap-1.5 text-xs"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                        {t('decisions.dismiss')}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

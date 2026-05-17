import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lightbulb, Sparkles, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DecisionCard as DecisionCardT } from '@/lib/api/endpoints';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

interface Props {
  data: DecisionCardT[] | undefined;
  loading: boolean;
}

const TONE_STYLES: Record<string, string> = {
  earn: 'bg-success/10 text-success border-success/20',
  protect: 'bg-warning/10 text-warning border-warning/20',
  goal: 'bg-secondary/10 text-secondary border-secondary/20',
};

export function DecisionsCard({ data, loading }: Props) {
  const t = useT();
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Card className="group">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-primary" aria-hidden />
            {t('dashboard.decisions')}
          </CardTitle>
          <Link
            to="/smart-decisions"
            aria-label={t('dashboard.viewDetails')}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            {t('common.viewAll')}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !data || data.length === 0 ? (
            <Link
              to="/smart-decisions"
              className="flex flex-col items-center gap-2 rounded-lg py-6 text-center transition-colors hover:bg-accent/30"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-sm text-muted-foreground">{t('dashboard.decisionsEmpty')}</p>
            </Link>
          ) : (
            <ul className="space-y-2">
              {data.slice(0, 3).map((d, i) => (
                <motion.li
                  key={d.id}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, delay: i * 0.05 }}
                >
                  <Link
                    to="/smart-decisions"
                    className={cn(
                      'block rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent/30',
                      d.tone ? TONE_STYLES[d.tone] ?? 'border-border' : 'border-border',
                    )}
                  >
                    <p className="text-sm font-semibold">{d.title}</p>
                    {d.body ? <p className="mt-1 text-xs opacity-90">{d.body}</p> : null}
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

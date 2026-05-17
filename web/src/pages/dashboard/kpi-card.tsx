import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  Icon?: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
  index?: number;
}

const TONE: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
};

export function KpiCard({ label, value, hint, Icon, loading, tone = 'default', index = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: 'easeOut' }}
    >
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {Icon ? (
            <span className={cn('grid h-9 w-9 place-items-center rounded-lg', TONE[tone])}>
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
          ) : null}
        </div>
        <div className="mt-2 min-h-[2.5rem]">
          {loading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <p className="num-tabular text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{value}</p>
          )}
        </div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </Card>
    </motion.div>
  );
}

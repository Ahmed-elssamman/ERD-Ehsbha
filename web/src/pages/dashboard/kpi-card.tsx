import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
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
  /** Where clicking the card navigates to. Omit for static cards. */
  to?: string;
  /** Aria label for the link when `to` is set. */
  linkLabel?: string;
}

const TONE: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
};

export function KpiCard({
  label,
  value,
  hint,
  Icon,
  loading,
  tone = 'default',
  index = 0,
  to,
  linkLabel,
}: KpiCardProps) {
  const inner = (
    <Card
      className={cn(
        'group relative h-full p-4 sm:p-5',
        to ? 'cursor-pointer transition-all hover:border-primary/40 hover:shadow-elevated' : '',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? (
          <motion.span
            whileHover={to ? { rotate: -6, scale: 1.06 } : undefined}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
            className={cn('grid h-9 w-9 place-items-center rounded-lg', TONE[tone])}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </motion.span>
        ) : null}
      </div>

      <div className="mt-2 min-h-[2.5rem]">
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p className="num-tabular text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {value}
          </p>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        {hint ? (
          <p className="num-tabular text-xs text-muted-foreground">{hint}</p>
        ) : (
          <span />
        )}
        {to ? (
          <ChevronRight
            className="h-3.5 w-3.5 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
            aria-hidden
          />
        ) : null}
      </div>
    </Card>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={to ? { y: -3 } : undefined}
      className="h-full"
    >
      {to ? (
        <Link to={to} aria-label={linkLabel ?? label} className="block h-full">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </motion.div>
  );
}

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: Props) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center',
        className,
      )}
    >
      <div className="min-w-0 max-w-full">
        <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1 break-words text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  key: T;
  label: string;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function Tabs<T extends string>({ items, value, onChange, className, size = 'md' }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 p-1',
        className,
      )}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={cn(
              'relative inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium transition-colors',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active ? (
              <motion.span
                layoutId="tabs-active-pill"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="absolute inset-0 rounded-full bg-card shadow-soft"
                aria-hidden
              />
            ) : null}
            <span className="relative z-10">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

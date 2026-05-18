import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

interface Props {
  value: number;
  onChange?: (next: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
  ariaLabel?: string;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

export function StarRating({ value, onChange, size = 'md', readOnly, ariaLabel, className }: Props) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const interactive = !readOnly && !!onChange;
  const displayed = hover ?? value;

  return (
    <div
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={ariaLabel ?? t('reviews.rating')}
      className={cn('inline-flex items-center gap-0.5', className)}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= displayed;
        const filled = n <= value;
        const star = (
          <Star
            className={cn(
              SIZE_CLASSES[size],
              'transition-colors',
              active
                ? 'fill-amber-400 text-amber-400'
                : filled
                  ? 'fill-amber-300/70 text-amber-300/70'
                  : 'text-muted-foreground/40',
            )}
            aria-hidden
          />
        );

        if (!interactive) return <span key={n}>{star}</span>;

        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t('reviews.rateLabel', { n })}
            tabIndex={0}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => onChange?.(n)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                onChange?.(Math.min(5, value + 1));
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                onChange?.(Math.max(1, value - 1));
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange?.(n);
              }
            }}
            className="rounded-md p-0.5 hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

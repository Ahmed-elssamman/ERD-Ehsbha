import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { StarRating } from '@/components/ui/star-rating';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicReviewsApi, type PlatformReview } from '@/lib/api/endpoints';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

interface Props {
  limit?: number;
  variant?: 'grid' | 'compact';
  className?: string;
  /** Hide the heading — useful when the parent supplies its own copy. */
  hideHeading?: boolean;
}

export function FeaturedTestimonials({
  limit = 6,
  variant = 'grid',
  className,
  hideHeading,
}: Props) {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['public-reviews-featured', limit],
    queryFn: () => PublicReviewsApi.featured(limit),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const items = data ?? [];

  if (!isLoading && items.length === 0) return null;

  return (
    <section className={cn('space-y-5', className)}>
      {!hideHeading ? (
        <div className="text-center sm:text-start">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t('reviews.featuredTitle')}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
            {t('reviews.featuredSubtitle')}
          </h2>
        </div>
      ) : null}

      <div
        className={cn(
          variant === 'compact'
            ? 'grid gap-3 sm:grid-cols-2'
            : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {isLoading
          ? Array.from({ length: Math.min(limit, 3) }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))
          : items.map((r, i) => <TestimonialCard key={r.id} review={r} index={i} compact={variant === 'compact'} />)}
      </div>
    </section>
  );
}

function TestimonialCard({
  review,
  index,
  compact,
}: {
  review: PlatformReview;
  index: number;
  compact?: boolean;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.05, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-shadow hover:shadow-elevated',
        compact ? 'p-4' : 'p-5',
      )}
    >
      <Quote
        className="pointer-events-none absolute -top-2 end-2 h-12 w-12 text-primary/10 group-hover:text-primary/20 transition-colors"
        aria-hidden
      />
      <div className="flex items-center justify-between gap-3">
        <StarRating value={review.rating} readOnly size="sm" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {review.author.baseCity ?? ''}
        </span>
      </div>
      {review.title ? (
        <h3 className="mt-3 text-sm font-semibold leading-snug">{review.title}</h3>
      ) : null}
      <p className={cn('mt-2 leading-relaxed text-foreground/85', compact ? 'text-sm' : 'text-[15px]')}>
        {review.body}
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {review.author.displayName.trim().charAt(0)}
        </span>
        <span className="font-medium">{review.author.displayName}</span>
      </div>
    </motion.article>
  );
}

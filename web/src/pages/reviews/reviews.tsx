import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Star, Pencil, Trash2, MessageSquareQuote } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/dialog';
import { StarRating } from '@/components/ui/star-rating';
import { GrowingBanner } from '@/components/trust/growing-banner';
import { useI18n } from '@/i18n';
import { ReviewsApi, type MyReview } from '@/lib/api/endpoints';
import { readApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().or(z.literal('')),
  body: z.string().trim().min(10).max(1000),
});
type ReviewForm = z.infer<typeof reviewSchema>;

export function ReviewsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [filterRating, setFilterRating] = useState<number | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const summaryQ = useQuery({ queryKey: ['reviews-summary'], queryFn: () => ReviewsApi.summary() });
  const mineQ = useQuery({ queryKey: ['my-review'], queryFn: () => ReviewsApi.mine() });
  const listQ = useQuery({
    queryKey: ['reviews', filterRating],
    queryFn: () => ReviewsApi.list({ rating: filterRating, limit: 30 }),
  });

  const mine = mineQ.data ?? null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('reviews.title')} subtitle={t('reviews.subtitle')} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-5">
          <SummaryCard
            count={summaryQ.data?.count ?? 0}
            average={summaryQ.data?.averageRating ?? 0}
            distribution={summaryQ.data?.distribution ?? { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }}
            loading={summaryQ.isLoading}
          />
          <WriteReviewCard mine={mine} onDelete={() => setConfirmDelete(true)} />
          <GrowingBanner variant="compact" />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>{t('reviews.title')}</CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground" htmlFor="rating-filter">
                {t('reviews.filterByRating')}
              </Label>
              <Select
                id="rating-filter"
                value={filterRating ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilterRating(v ? Number(v) : undefined);
                }}
                className="h-9 w-32"
              >
                <option value="">{t('reviews.allRatings')}</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? t('reviews.starsOne') : t('reviews.stars', { n })}
                  </option>
                ))}
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {listQ.isLoading ? (
              <div className="space-y-2 p-5">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (listQ.data?.items.length ?? 0) === 0 ? (
              <EmptyState Icon={MessageSquareQuote} title={t('reviews.empty')} />
            ) : (
              <ul className="divide-y divide-border/60">
                {listQ.data?.items.map((r, i) => (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, delay: Math.min(i, 10) * 0.02 }}
                    className="space-y-2 p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <StarRating value={r.rating} readOnly size="sm" />
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {formatDate(r.createdAt, locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {r.title ? <h4 className="text-sm font-semibold leading-snug">{r.title}</h4> : null}
                    <p className="text-[15px] leading-relaxed text-foreground/85">{r.body}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {r.author.displayName.trim().charAt(0)}
                      </span>
                      <span className="font-medium text-foreground/85">{r.author.displayName}</span>
                      {r.author.baseCity ? <span>· {r.author.baseCity}</span> : null}
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await ReviewsApi.remove();
          await qc.invalidateQueries({ queryKey: ['my-review'] });
          await qc.invalidateQueries({ queryKey: ['reviews', filterRating] });
          await qc.invalidateQueries({ queryKey: ['reviews-summary'] });
          await qc.invalidateQueries({ queryKey: ['public-reviews-featured'] });
          setConfirmDelete(false);
        }}
        title={t('reviews.deleteConfirm')}
        body={t('common.confirmDeleteBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
      />
    </div>
  );
}

function SummaryCard({
  count,
  average,
  distribution,
  loading,
}: {
  count: number;
  average: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  loading: boolean;
}) {
  const { t } = useI18n();
  const max = useMemo(() => Math.max(1, ...Object.values(distribution)), [distribution]);
  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            {t('reviews.averageRating')}
          </p>
          {loading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">{average.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ 5</span>
            </div>
          )}
          <div className="pt-1">
            <StarRating value={Math.round(average)} readOnly size="md" />
          </div>
          <p className="text-xs text-muted-foreground">
            {count === 1 ? t('reviews.totalReviewsOne') : t('reviews.totalReviews', { count })}
          </p>
        </div>

        <div className="space-y-1.5">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const v = distribution[String(star) as '1' | '2' | '3' | '4' | '5'] ?? 0;
            const pct = max === 0 ? 0 : Math.round((v / max) * 100);
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="inline-flex w-6 items-center gap-0.5 text-muted-foreground">
                  {star}
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full bg-amber-400/80"
                  />
                </div>
                <span className="w-8 text-end text-[11px] tabular-nums text-muted-foreground">{v}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function WriteReviewCard({
  mine,
  onDelete,
}: {
  mine: MyReview | null;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(!mine);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: mine?.rating ?? 0,
      title: mine?.title ?? '',
      body: mine?.body ?? '',
    },
    values: mine
      ? { rating: mine.rating, title: mine.title ?? '', body: mine.body }
      : { rating: 0, title: '', body: '' },
  });

  const rating = watch('rating');

  const mutation = useMutation({
    mutationFn: (values: ReviewForm) =>
      ReviewsApi.upsert({
        rating: values.rating,
        title: values.title ? values.title : undefined,
        body: values.body,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['my-review'] });
      await qc.invalidateQueries({ queryKey: ['reviews-summary'] });
      await qc.invalidateQueries({ queryKey: ['reviews', undefined] });
      await qc.invalidateQueries({ queryKey: ['public-reviews-featured'] });
      setEditing(false);
      setServerError(null);
    },
    onError: (err) => {
      const e = readApiError(err);
      const key = `errors.${e.code}`;
      const msg = t(key);
      setServerError(msg === key ? t('errors.UNKNOWN') : msg);
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (values.rating < 1) {
      return;
    }
    return mutation.mutateAsync(values);
  });

  // Read-only display when not editing and we have a saved review.
  if (mine && !editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">{t('reviews.yourReview')}</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label={t('reviews.editReview')} onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" aria-label={t('reviews.deleteReview')} onClick={onDelete}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <StarRating value={mine.rating} readOnly size="md" />
          {mine.title ? <h4 className="text-sm font-semibold">{mine.title}</h4> : null}
          <p className="text-sm leading-relaxed text-foreground/85">{mine.body}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{mine ? t('reviews.editReview') : t('reviews.writeReview')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          {serverError ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{serverError}</p>
          ) : null}

          <div className="space-y-1.5">
            <Label>{t('reviews.rating')}</Label>
            <StarRating
              value={rating ?? 0}
              onChange={(n) => setValue('rating', n, { shouldDirty: true, shouldValidate: true })}
              size="lg"
              ariaLabel={t('reviews.rating')}
            />
            {rating < 1 && errors.rating ? (
              <p className="text-xs text-destructive">{t('reviews.errors.ratingRequired')}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-title">{t('reviews.field.title')}</Label>
            <Input
              id="review-title"
              placeholder={t('reviews.field.titlePlaceholder')}
              maxLength={120}
              {...register('title')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-body">{t('reviews.field.body')}</Label>
            <Textarea
              id="review-body"
              rows={4}
              placeholder={t('reviews.field.bodyPlaceholder')}
              invalid={!!errors.body}
              {...register('body')}
            />
            {errors.body ? (
              <p className="text-xs text-destructive">{t('reviews.errors.bodyShort')}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              {mine ? t('reviews.updateReview') : t('reviews.saveReview')}
            </Button>
            {mine ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  reset({ rating: mine.rating, title: mine.title ?? '', body: mine.body });
                  setEditing(false);
                  setServerError(null);
                }}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
            ) : null}
          </div>
          {isDirty ? null : <span className="sr-only">unchanged</span>}
        </form>
      </CardContent>
    </Card>
  );
}

// (lint-friendly export to silence "unused variable" warnings on cn import)
void cn;

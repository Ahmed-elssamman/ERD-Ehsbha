import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Bug,
  Lightbulb,
  HelpCircle,
  Sparkles,
  MessageCircle,
  PlusCircle,
  CheckCircle2,
  Clock,
  Eye,
  CircleDot,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { GrowingBanner } from '@/components/trust/growing-banner';
import { useI18n } from '@/i18n';
import {
  SupportApi,
  type SupportTicket,
  type TicketCategory,
  type TicketStatus,
} from '@/lib/api/endpoints';
import { readApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const CATEGORIES: TicketCategory[] = ['BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'QUESTION', 'OTHER'];

const CATEGORY_ICONS: Record<TicketCategory, LucideIcon> = {
  BUG: Bug,
  FEATURE_REQUEST: Lightbulb,
  IMPROVEMENT: Sparkles,
  QUESTION: HelpCircle,
  OTHER: MessageCircle,
};

const STATUS_ICONS: Record<TicketStatus, LucideIcon> = {
  OPEN: CircleDot,
  IN_REVIEW: Eye,
  PLANNED: Clock,
  RESOLVED: CheckCircle2,
  CLOSED: XCircle,
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  IN_REVIEW: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  PLANNED: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  RESOLVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  CLOSED: 'bg-muted text-muted-foreground',
};

const schema = z.object({
  category: z.enum(['BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'QUESTION', 'OTHER']),
  subject: z.string().trim().min(3).max(140),
  body: z.string().trim().min(10).max(2000),
});
type FormValues = z.infer<typeof schema>;

export function SupportPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const ticketsQ = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => SupportApi.list({ limit: 50 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'BUG', subject: '', body: '' },
  });

  const category = watch('category');

  const mutation = useMutation({
    mutationFn: (values: FormValues) => SupportApi.create(values),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['support-tickets'] });
      reset({ category: 'BUG', subject: '', body: '' });
      setSuccess(true);
      setServerError(null);
      window.setTimeout(() => setSuccess(false), 4000);
    },
    onError: (err) => {
      const e = readApiError(err);
      const key = `errors.${e.code}`;
      const msg = t(key);
      setServerError(msg === key ? t('errors.UNKNOWN') : msg);
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutateAsync(values));

  const items = ticketsQ.data?.items ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('support.title')} subtitle={t('support.subtitle')} />

      <Card className="overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(40% 40% at 80% 0%, hsl(var(--primary) / 0.08), transparent 60%)',
          }}
        />
        <CardHeader>
          <CardTitle>{t('support.introTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('support.introBody')}</p>
        </CardHeader>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlusCircle className="h-4 w-4 text-primary" aria-hidden />
              {t('support.newTicket')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              {serverError ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {serverError}
                </p>
              ) : null}
              {success ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {t('support.submitted')}
                </motion.p>
              ) : null}

              <div className="space-y-2">
                <Label>{t('support.field.category')}</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {CATEGORIES.map((c) => {
                    const Icon = CATEGORY_ICONS[c];
                    const active = category === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setValue('category', c, { shouldDirty: true })}
                        aria-pressed={active}
                        className={cn(
                          'rounded-xl border p-3 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active
                            ? 'border-primary/60 bg-primary/5 shadow-soft'
                            : 'border-border/70 bg-card hover:border-primary/30 hover:bg-accent/40',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            className={cn(
                              'h-4 w-4',
                              active ? 'text-primary' : 'text-muted-foreground',
                            )}
                            aria-hidden
                          />
                          <span className="text-sm font-semibold">
                            {t(`support.categories.${c}`)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(`support.categoryHints.${c}`)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subject">{t('support.field.subject')}</Label>
                <Input
                  id="subject"
                  placeholder={t('support.field.subjectPlaceholder')}
                  maxLength={140}
                  invalid={!!errors.subject}
                  {...register('subject')}
                />
                {errors.subject ? (
                  <p className="text-xs text-destructive">{t('support.errors.subjectShort')}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ticket-body">{t('support.field.body')}</Label>
                <Textarea
                  id="ticket-body"
                  rows={6}
                  placeholder={t('support.field.bodyPlaceholder')}
                  invalid={!!errors.body}
                  maxLength={2000}
                  {...register('body')}
                />
                {errors.body ? (
                  <p className="text-xs text-destructive">{t('support.errors.bodyShort')}</p>
                ) : null}
              </div>

              <Button type="submit" loading={isSubmitting || mutation.isPending}>
                {mutation.isPending ? t('support.submitting') : t('support.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('support.trustNoteTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('support.trustNoteBody')}
              </p>
            </CardContent>
          </Card>
          <GrowingBanner variant="compact" />
        </aside>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('support.myTickets')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ticketsQ.isLoading ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              Icon={MessageCircle}
              title={t('support.noTickets')}
              body={t('support.noTicketsBody')}
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((ticket, i) => (
                <TicketRow key={ticket.id} ticket={ticket} index={i} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TicketRow({ ticket, index }: { ticket: SupportTicket; index: number }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const closeMut = useMutation({
    mutationFn: () => SupportApi.close(ticket.id) as Promise<unknown>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tickets'] }),
  });

  const Icon = CATEGORY_ICONS[ticket.category];
  const StatusIcon = STATUS_ICONS[ticket.status];

  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.02 }}
      className="space-y-2 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <Icon className="h-3 w-3" aria-hidden />
          {t(`support.categories.${ticket.category}`)}
        </Badge>
        <Badge className={cn('gap-1', STATUS_COLORS[ticket.status])}>
          <StatusIcon className="h-3 w-3" aria-hidden />
          {t(`support.statuses.${ticket.status}`)}
        </Badge>
        <span className="ms-auto text-[11px] uppercase tracking-wide text-muted-foreground">
          {formatDate(ticket.createdAt, locale, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <h4 className="text-sm font-semibold leading-snug">{ticket.subject}</h4>
      <p
        className={cn(
          'whitespace-pre-line text-sm leading-relaxed text-foreground/85',
          !expanded && 'line-clamp-2',
        )}
      >
        {ticket.body}
      </p>
      {ticket.adminNote ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            {t('support.adminNote')}
          </p>
          <p className="mt-1 text-foreground/90">{ticket.adminNote}</p>
        </div>
      ) : null}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          className="text-primary underline-offset-4 hover:underline"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? t('common.less') : t('common.more')}
        </button>
        {ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED' ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => closeMut.mutate()}
            disabled={closeMut.isPending}
            className="ms-auto h-7 px-2 text-xs"
          >
            {t('support.close')}
          </Button>
        ) : null}
      </div>
    </motion.li>
  );
}

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  CommunityApi,
  type CommunityPost,
  type ReactionKind,
  type CommunityCategory,
} from '@/lib/api/endpoints';
import { useI18n } from '@/i18n';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  post: CommunityPost;
  index?: number;
}

const CATEGORY_COLORS: Record<CommunityCategory, string> = {
  BEST_APPS: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  EXPERIENCE_UBER: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  EXPERIENCE_INDRIVE: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  EXPERIENCE_DIDI: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300',
  EXPERIENCE_OTHER: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  FUEL_SAVING: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
  BEST_HOURS: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
  MAINTENANCE_ADVICE: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  EFFICIENCY_TIPS: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  OPERATIONAL_MISTAKES: 'bg-red-500/10 text-red-600 dark:text-red-300',
  WEEKLY_LESSON: 'bg-purple-500/10 text-purple-600 dark:text-purple-300',
  SAFETY_ADVICE: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-200',
  GENERAL: 'bg-muted text-muted-foreground',
};

export function CommunityPostCard({ post, index = 0 }: Props) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reactMut = useMutation({
    mutationFn: (kind: ReactionKind) => CommunityApi.react(post.id, kind),
    onMutate: async (kind) => {
      // Optimistic: bump local counts.
      await qc.cancelQueries({ queryKey: ['community-posts'] });
      return { kind };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['community-posts'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => CommunityApi.remove(post.id) as Promise<unknown>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-posts'] });
    },
  });

  const my = post.myReaction;

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index, 8) * 0.03 }}
      className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-shadow hover:shadow-elevated"
    >
      <header className="flex flex-wrap items-center gap-2">
        <Badge className={cn('font-medium', CATEGORY_COLORS[post.category])}>
          {t(`community.categories.${post.category}`)}
        </Badge>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {formatDate(post.createdAt, locale, { day: 'numeric', month: 'short' })}
        </span>
        {post.isOwn ? (
          <Badge variant="outline" className="border-primary/30 text-primary">
            {t('community.you')}
          </Badge>
        ) : null}
        <span className="ms-auto" />
        {post.isOwn ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('community.delete')}
            onClick={() => setConfirmDelete(true)}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </header>

      <h3 className="mt-3 text-base font-semibold leading-snug">{post.title}</h3>
      <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground/85">
        {post.body}
      </p>

      <footer className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {post.author.displayName.trim().charAt(0)}
          </span>
          <span className="font-medium text-foreground/85">{post.author.displayName}</span>
          {post.author.baseCity ? <span>· {post.author.baseCity}</span> : null}
        </div>
        <div className="flex items-center gap-1">
          <ReactionButton
            kind="LIKE"
            active={my === 'LIKE'}
            count={post.likeCount}
            disabled={reactMut.isPending}
            onClick={() => reactMut.mutate('LIKE')}
            ariaLabel={t('community.like')}
          />
          <ReactionButton
            kind="DISLIKE"
            active={my === 'DISLIKE'}
            count={post.dislikeCount}
            disabled={reactMut.isPending}
            onClick={() => reactMut.mutate('DISLIKE')}
            ariaLabel={t('community.dislike')}
          />
        </div>
      </footer>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteMut.mutateAsync();
          setConfirmDelete(false);
        }}
        title={t('community.deleteConfirm')}
        body={t('community.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={deleteMut.isPending}
      />
    </motion.article>
  );
}

function ReactionButton({
  kind,
  active,
  count,
  disabled,
  onClick,
  ariaLabel,
}: {
  kind: ReactionKind;
  active: boolean;
  count: number;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  const Icon = kind === 'LIKE' ? ThumbsUp : ThumbsDown;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:opacity-60 disabled:pointer-events-none active:scale-95',
        active
          ? kind === 'LIKE'
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
            : 'border-destructive/50 bg-destructive/10 text-destructive'
          : 'border-border/70 bg-background text-muted-foreground hover:text-foreground hover:bg-accent',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

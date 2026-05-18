import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Users,
  Plus,
  Flame,
  Award,
  Clock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  CommunityApi,
  type CommunityCategory,
  type CommunitySort,
} from '@/lib/api/endpoints';
import { useT } from '@/i18n';
import { CommunityPostCard } from './post-card';
import { PostComposer } from './post-composer';
import { cn } from '@/lib/utils';

const CATEGORIES: CommunityCategory[] = [
  'BEST_APPS',
  'EXPERIENCE_UBER',
  'EXPERIENCE_INDRIVE',
  'EXPERIENCE_DIDI',
  'EXPERIENCE_OTHER',
  'FUEL_SAVING',
  'BEST_HOURS',
  'MAINTENANCE_ADVICE',
  'EFFICIENCY_TIPS',
  'OPERATIONAL_MISTAKES',
  'WEEKLY_LESSON',
  'SAFETY_ADVICE',
  'GENERAL',
];

type TabKey = 'all' | 'trending' | 'top' | 'mine';

const TAB_TO_SORT: Record<TabKey, CommunitySort> = {
  all: 'latest',
  trending: 'trending',
  top: 'top',
  mine: 'latest',
};

const TAB_META: Record<TabKey, { Icon: LucideIcon; key: string }> = {
  all: { Icon: Clock, key: 'community.tabs.all' },
  trending: { Icon: Flame, key: 'community.tabs.trending' },
  top: { Icon: Award, key: 'community.tabs.top' },
  mine: { Icon: Users, key: 'community.tabs.mine' },
};

export function CommunityPage() {
  const t = useT();
  const [tab, setTab] = useState<TabKey>('all');
  const [category, setCategory] = useState<CommunityCategory | ''>('');
  const [composerOpen, setComposerOpen] = useState(false);

  const sort = TAB_TO_SORT[tab];
  const mine = tab === 'mine';

  const queryKey = useMemo(
    () => ['community-posts', tab, category || 'all', sort, mine] as const,
    [tab, category, sort, mine],
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      CommunityApi.list({
        sort,
        category: category || undefined,
        mine: mine || undefined,
        limit: 30,
      }),
  });

  const items = data?.items ?? [];
  const emptyKey = mine ? 'community.emptyMine' : 'community.empty';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('community.title')}
        subtitle={t('community.subtitle')}
        actions={
          <Button onClick={() => setComposerOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden />
            {t('community.newPost')}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5 min-w-0">
          <Tabs<TabKey>
            value={tab}
            onChange={setTab}
            items={(Object.keys(TAB_META) as TabKey[]).map((k) => ({
              key: k,
              label: t(TAB_META[k].key),
            }))}
            className="flex flex-wrap"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="category-filter" className="text-xs text-muted-foreground">
              {t('community.filters.category')}
            </Label>
            <Select
              id="category-filter"
              value={category}
              onChange={(e) => setCategory((e.target.value || '') as CommunityCategory | '')}
              className="h-9 max-w-[14rem]"
            >
              <option value="">{t('community.filters.all')}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`community.categories.${c}`)}
                </option>
              ))}
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-2xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  Icon={Users}
                  title={t(emptyKey)}
                  action={
                    <Button onClick={() => setComposerOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" aria-hidden />
                      {t('community.newPost')}
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map((p, i) => (
                <CommunityPostCard key={p.id} post={p} index={i} />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <CategoriesCard
            value={category}
            onChange={setCategory}
          />
          <GuidelinesCard />
        </aside>
      </div>

      <PostComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        defaultCategory={(category || 'GENERAL') as CommunityCategory}
      />
    </div>
  );
}

function CategoriesCard({
  value,
  onChange,
}: {
  value: CommunityCategory | '';
  onChange: (next: CommunityCategory | '') => void;
}) {
  const t = useT();
  return (
    <Card>
      <CardContent className="p-4">
        <h4 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('community.filters.category')}
        </h4>
        <ul className="space-y-0.5">
          <li>
            <CategoryChip active={value === ''} onClick={() => onChange('')} label={t('community.filters.all')} />
          </li>
          {CATEGORIES.map((c) => (
            <li key={c}>
              <CategoryChip
                active={value === c}
                onClick={() => onChange(c)}
                label={t(`community.categories.${c}`)}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-start text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-primary/10 text-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <span className="truncate">{label}</span>
      {active ? (
        <motion.span layoutId="cat-pill" className="h-1.5 w-1.5 rounded-full bg-primary" />
      ) : null}
    </button>
  );
}

function GuidelinesCard() {
  const t = useT();
  const items: Array<{ Icon: LucideIcon; key: string }> = [
    { Icon: Sparkles, key: 'community.guidelines.useful' },
    { Icon: ShieldCheck, key: 'community.guidelines.respectful' },
    { Icon: ShieldCheck, key: 'community.guidelines.noSpam' },
    { Icon: ShieldCheck, key: 'community.guidelines.noReplies' },
  ];
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h4 className="text-sm font-semibold">{t('community.guidelinesTitle')}</h4>
        <ul className="space-y-2 text-xs text-muted-foreground">
          {items.map(({ Icon, key }) => (
            <li key={key} className="flex items-start gap-2 leading-relaxed">
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              {t(key)}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

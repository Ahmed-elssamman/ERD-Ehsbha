import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  variant?: 'page' | 'compact';
}

export function GrowingBanner({ className, variant = 'page' }: Props) {
  const t = useT();
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-card to-secondary/5 shadow-soft',
        variant === 'page' ? 'p-6 sm:p-8' : 'p-5',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(40% 40% at 80% 0%, hsl(var(--primary) / 0.12), transparent 60%), radial-gradient(40% 40% at 0% 100%, hsl(var(--secondary) / 0.1), transparent 60%)',
        }}
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" aria-hidden />
            {t('trust.badge')}
          </span>
          <h3
            className={cn(
              'font-bold tracking-tight',
              variant === 'page' ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg',
            )}
          >
            {t('trust.growingTitle')}
          </h3>
          <p className={cn('leading-relaxed text-muted-foreground', variant === 'page' ? 'text-sm sm:text-base' : 'text-sm')}>
            {t('trust.growingBody')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default" size={variant === 'page' ? 'lg' : 'default'}>
            <Link to="/support" className="gap-2">
              <MessageSquare className="h-4 w-4" aria-hidden />
              {t('trust.shareIdea')}
            </Link>
          </Button>
          <Button asChild variant="outline" size={variant === 'page' ? 'lg' : 'default'}>
            <Link to="/community" className="gap-2">
              <Users className="h-4 w-4" aria-hidden />
              {t('trust.joinCommunity')}
            </Link>
          </Button>
        </div>
      </div>
    </motion.section>
  );
}

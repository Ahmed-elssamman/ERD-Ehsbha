import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-soft"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 17l4-8 5 6 5-8" />
          <circle cx="19" cy="7" r="1.6" fill="currentColor" />
        </svg>
      </span>
      {withText ? <span className="text-lg font-bold tracking-tight">{t('app.name')}</span> : null}
    </div>
  );
}

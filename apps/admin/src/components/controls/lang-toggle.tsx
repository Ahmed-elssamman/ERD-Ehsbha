import { Languages } from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/utils';

export function LangToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="inline-flex items-center rounded-md border bg-card p-0.5">
      <Languages className="mx-1 h-3.5 w-3.5 text-muted-foreground" />
      {(['en', 'ar'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-label={l === 'en' ? 'English' : 'العربية'}
          className={cn(
            'rounded-sm px-2 py-0.5 text-xs font-medium uppercase transition-colors',
            locale === l ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50',
          )}
        >
          {l === 'en' ? 'EN' : 'ع'}
        </button>
      ))}
    </div>
  );
}

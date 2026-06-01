import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

export function LangToggle() {
  const { locale, toggleLocale, t } = useI18n();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t('language.toggle')}
      onClick={toggleLocale}
      className="gap-1.5 px-3"
    >
      <Languages className="h-4 w-4" aria-hidden />
      <span className="text-xs font-semibold">{locale === 'ar' ? 'EN' : 'AR'}</span>
    </Button>
  );
}

import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/stores/admin-auth.store';
import { ThemeToggle } from '@/components/controls/theme-toggle';
import { LangToggle } from '@/components/controls/lang-toggle';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/utils';

export function Topbar() {
  const session = useAdminAuth((s) => s.session);
  const clearSession = useAdminAuth((s) => s.clearSession);
  const navigate = useNavigate();
  const { t } = useI18n();
  const env = (import.meta.env.MODE ?? 'dev').toUpperCase();

  function logout() {
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
      <div className="flex-1" />
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider',
          env === 'PRODUCTION'
            ? 'bg-danger/10 text-danger'
            : 'bg-warning/10 text-warning',
        )}
      >
        {env}
      </span>
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {session?.admin.roles[0] ?? '—'}
      </span>
      <LangToggle />
      <ThemeToggle />
      <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1 text-sm">
        <div className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[10px] font-semibold uppercase text-primary-foreground">
          {session?.admin.displayName?.[0] ?? '?'}
        </div>
        <span className="font-medium">{session?.admin.displayName ?? 'Admin'}</span>
      </div>
      <Button variant="outline" size="sm" onClick={logout}>
        <LogOut className="h-3.5 w-3.5" />
        {t('common.signOut')}
      </Button>
    </header>
  );
}

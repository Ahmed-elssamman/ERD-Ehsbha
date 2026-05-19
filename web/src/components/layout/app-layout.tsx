import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/controls/theme-toggle';
import { LangToggle } from '@/components/controls/lang-toggle';
import { Sidebar } from './sidebar';
import { useAuth } from '@/stores/auth.store';
import { AuthApi } from '@/lib/api/endpoints';
import { useI18n, useT } from '@/i18n';
import { queryClient } from '@/providers/query-provider';

export function AppLayout() {
  const t = useT();
  const { dir } = useI18n();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const refreshToken = useAuth((s) => s.refreshToken);
  const clear = useAuth((s) => s.clear);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileNavOpen]);

  // Drawer is anchored at `start-0` (left in LTR, right in RTL) — same side
  // as the hamburger trigger, so it slides in from where the user tapped.
  const drawerOffscreen = dir === 'rtl' ? '100%' : '-100%';

  const handleLogout = async () => {
    try {
      if (refreshToken) await AuthApi.logout(refreshToken);
    } catch {
      // ignore — we clear locally regardless
    }
    clear();
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Skip to main content — first focusable element for keyboard / screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:shadow-elevated"
      >
        {t('common.skipToContent')}
      </a>
      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-e border-border/70 bg-card/40 backdrop-blur lg:block" aria-label={t('common.primaryNavigation')}>
          <div className="flex h-16 items-center px-5">
            <Logo to="/" />
          </div>
          <div className="h-[calc(100dvh-4rem)] overflow-y-auto scrollbar-thin">
            <Sidebar />
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex items-center gap-2 lg:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={mobileNavOpen ? t('common.closeMenu') : t('common.openMenu')}
                  aria-expanded={mobileNavOpen}
                  onClick={() => setMobileNavOpen((o) => !o)}
                >
                  <motion.span
                    key={mobileNavOpen ? 'x' : 'menu'}
                    initial={{ opacity: 0, rotate: -90, scale: 0.85 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="inline-flex"
                  >
                    {mobileNavOpen ? (
                      <X className="h-5 w-5" aria-hidden />
                    ) : (
                      <Menu className="h-5 w-5" aria-hidden />
                    )}
                  </motion.span>
                </Button>
                <Logo withText={false} to="/" />
              </div>
              <div className="flex items-center gap-1">
                <LangToggle />
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.logout')}
                  onClick={handleLogout}
                >
                  <LogOut className="h-[18px] w-[18px]" aria-hidden />
                </Button>
              </div>
            </div>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none focus-visible:ring-0 sm:px-6 lg:px-8 lg:py-8"
          >
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileNavOpen ? (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <motion.aside
              key="drawer"
              initial={{ x: drawerOffscreen }}
              animate={{ x: 0 }}
              exit={{ x: drawerOffscreen }}
              transition={{ type: 'spring', stiffness: 340, damping: 38, mass: 0.7 }}
              className="fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col border-e border-border/70 bg-card shadow-elevated lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label={t('common.navigation')}
            >
              <div className="flex h-16 shrink-0 items-center justify-between px-4">
                <div onClick={() => setMobileNavOpen(false)}>
                  <Logo to="/" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.closeMenu')}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <X className="h-5 w-5" aria-hidden />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
                <Sidebar onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

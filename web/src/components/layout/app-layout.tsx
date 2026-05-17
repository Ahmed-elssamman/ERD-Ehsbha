import { useState } from 'react';
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
import { useT } from '@/i18n';
import { queryClient } from '@/providers/query-provider';

export function AppLayout() {
  const t = useT();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const refreshToken = useAuth((s) => s.refreshToken);
  const clear = useAuth((s) => s.clear);

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
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-e border-border/70 bg-card/40 backdrop-blur lg:block" aria-label="Primary navigation">
          <div className="flex h-16 items-center px-5">
            <Logo />
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
                  aria-label="Open menu"
                  aria-expanded={mobileNavOpen}
                  onClick={() => setMobileNavOpen(true)}
                >
                  <Menu className="h-5 w-5" aria-hidden />
                </Button>
                <Logo withText={false} />
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
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <motion.aside
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 end-0 z-50 w-72 max-w-[85vw] border-s border-border/70 bg-card shadow-elevated lg:hidden"
              role="dialog"
              aria-label="Navigation"
            >
              <div className="flex h-16 items-center justify-between px-4">
                <Logo />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close menu"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <X className="h-5 w-5" aria-hidden />
                </Button>
              </div>
              <div className="h-[calc(100dvh-4rem)] overflow-y-auto scrollbar-thin">
                <Sidebar onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { InstallAppDialog } from './install-dialog';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'ehsbha.pwa-install-dismissed';
const FIRST_PROMPT_DELAY_MS = 25_000;

/** Dispatch this event from anywhere to open the install dialog manually. */
export const OPEN_INSTALL_EVENT = 'ehsbha:open-install';
export function openInstallDialog() {
  window.dispatchEvent(new CustomEvent(OPEN_INSTALL_EVENT));
}

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaPrompts() {
  const { t } = useI18n();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const standalone = useMemo(() => isStandalone(), []);
  const isIos = useMemo(() => detectIos(), []);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) {
        setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
      }
    },
  });

  // Capture the install prompt event
  useEffect(() => {
    if (standalone) return;
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      window.localStorage.setItem(DISMISS_KEY, '1');
      setInstallDismissed(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [standalone]);

  // Auto-open the dialog ~25s into the session (only once, if not dismissed)
  useEffect(() => {
    if (standalone || installDismissed) return;
    if (!installEvent && !isIos) return;
    const id = setTimeout(() => setDialogOpen(true), FIRST_PROMPT_DELAY_MS);
    return () => clearTimeout(id);
  }, [installEvent, isIos, standalone, installDismissed]);

  // Listen for manual open requests (e.g. from a "Install app" button in Settings)
  useEffect(() => {
    const onOpen = () => setDialogOpen(true);
    window.addEventListener(OPEN_INSTALL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_INSTALL_EVENT, onOpen);
  }, []);

  const persistDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setInstallDismissed(true);
    setDialogOpen(false);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    // Soft dismiss for this session — don't kill forever unless user clicks install or later
    persistDismiss();
  };

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:items-end sm:px-6"
        aria-live="polite"
      >
        <AnimatePresence>
          {needRefresh ? (
            <motion.div
              key="update"
              role="status"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-elevated"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <RefreshCw className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{t('pwa.updateTitle')}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t('pwa.updateBody')}</p>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
                      {t('pwa.updateDismiss')}
                    </Button>
                    <Button size="sm" onClick={() => updateServiceWorker(true)}>
                      {t('pwa.updateAction')}
                    </Button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNeedRefresh(false)}
                  aria-label={t('common.close')}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </motion.div>
          ) : null}

          {/* Floating install pill — appears only after dialog has been dismissed once */}
          {!standalone && installDismissed && (installEvent || isIos) && !dialogOpen && !needRefresh ? (
            <motion.button
              key="install-pill"
              type="button"
              onClick={() => setDialogOpen(true)}
              initial={{ y: 24, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-secondary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevated"
            >
              <Download className="h-4 w-4" aria-hidden />
              {t('pwa.installAction')}
            </motion.button>
          ) : null}

          {errorBanner ? (
            <motion.div
              key="install-error"
              role="status"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="pointer-events-auto w-full max-w-sm rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive shadow-elevated"
            >
              <div className="flex items-start justify-between gap-3">
                <span>{errorBanner}</span>
                <button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  aria-label={t('common.close')}
                  className="grid h-7 w-7 place-items-center rounded-md text-destructive/80 hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <InstallAppDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        installEvent={installEvent}
        isIos={isIos}
        onInstalled={() => {
          window.localStorage.setItem(DISMISS_KEY, '1');
          setInstallDismissed(true);
        }}
        onInstallError={(msg) => setErrorBanner(msg)}
      />
    </>
  );
}

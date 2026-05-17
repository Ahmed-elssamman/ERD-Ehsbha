import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export function PwaPrompts() {
  const { t } = useI18n();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) {
        // Check for updates every 60 minutes while the app is open
        setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
      }
    },
  });

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } finally {
      setInstallEvent(null);
    }
  };

  const showUpdate = needRefresh;
  const showInstall = !!installEvent && !installDismissed && !needRefresh;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:items-end sm:px-6"
      aria-live="polite"
    >
      <AnimatePresence>
        {showUpdate ? (
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

        {showInstall ? (
          <motion.div
            key="install"
            role="status"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-elevated"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary/15 text-secondary">
                <Download className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{t('pwa.installable')}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{t('pwa.installBody')}</p>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setInstallDismissed(true)}>
                    {t('pwa.installDismiss')}
                  </Button>
                  <Button size="sm" onClick={handleInstall}>
                    {t('pwa.installAction')}
                  </Button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInstallDismissed(true)}
                aria-label={t('common.close')}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

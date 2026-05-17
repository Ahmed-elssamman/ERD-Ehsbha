import { useEffect, useMemo, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import {
  CheckCircle2,
  Download,
  Home,
  Share,
  Sparkles,
  Wifi,
  X,
  Zap,
  Lock,
  Plus as PlusIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  installEvent: BeforeInstallPromptEvent | null;
  isIos: boolean;
  onInstalled?: () => void;
  onInstallError?: (msg: string) => void;
}

const cardEnter: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 24 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 280, damping: 26 },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: 16,
    transition: { duration: 0.18, ease: [0.55, 0, 0.55, 0.2] },
  },
};

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.12 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export function InstallAppDialog({
  open,
  onClose,
  installEvent,
  isIos,
  onInstalled,
  onInstallError,
}: Props) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [installed, setInstalled] = useState(false);

  // Lock scroll + ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const perks = useMemo(
    () => [
      { Icon: Zap, titleKey: 'pwa.dialog.perk1Title', bodyKey: 'pwa.dialog.perk1Body', tone: 'primary' },
      { Icon: Home, titleKey: 'pwa.dialog.perk2Title', bodyKey: 'pwa.dialog.perk2Body', tone: 'secondary' },
      { Icon: Wifi, titleKey: 'pwa.dialog.perk3Title', bodyKey: 'pwa.dialog.perk3Body', tone: 'success' },
      { Icon: Lock, titleKey: 'pwa.dialog.perk4Title', bodyKey: 'pwa.dialog.perk4Body', tone: 'warning' },
    ],
    [],
  );

  const handleInstall = async () => {
    if (!installEvent) {
      onInstallError?.(t('pwa.installFailed'));
      return;
    }
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        onInstalled?.();
        setTimeout(() => onClose(), 1600);
      } else {
        onClose();
      }
    } catch (err) {
      console.warn('PWA install failed', err);
      onInstallError?.(t('pwa.installFailed'));
    }
  };

  const canPrompt = !!installEvent;

  return (
    <AnimatePresence>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-dialog-title"
          className="fixed inset-0 z-50 grid place-items-end overflow-hidden p-0 sm:place-items-center sm:p-4"
        >
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-foreground/30 backdrop-blur-md"
          />

          {/* Card */}
          <motion.div
            variants={cardEnter}
            initial="hidden"
            animate="show"
            exit="exit"
            className={cn(
              'relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-border/60 bg-card text-card-foreground shadow-elevated',
              'sm:rounded-3xl',
            )}
          >
            {/* Animated gradient backdrop inside the card */}
            <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
              <motion.div
                className="absolute inset-0 opacity-70"
                style={{
                  background:
                    'radial-gradient(50% 40% at 50% 0%, hsl(var(--primary) / 0.30), transparent 70%), radial-gradient(50% 40% at 100% 100%, hsl(var(--secondary) / 0.28), transparent 70%)',
                }}
                animate={
                  reduce
                    ? undefined
                    : {
                        backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
                      }
                }
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="group absolute end-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-card/70 text-muted-foreground transition-all hover:bg-card hover:text-foreground"
            >
              <X className="h-4 w-4 transition-transform group-hover:rotate-90" aria-hidden />
            </button>

            {/* INSTALLED state */}
            {installed ? (
              <motion.div
                key="installed"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="px-6 py-12 text-center sm:px-8"
              >
                <motion.span
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                  className="inline-grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-success to-primary text-primary-foreground shadow-elevated"
                >
                  <CheckCircle2 className="h-10 w-10" aria-hidden />
                </motion.span>
                <p className="mt-5 text-lg font-semibold">{t('pwa.dialog.installed')}</p>
              </motion.div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show" className="px-6 pb-6 pt-10 sm:px-8 sm:pt-12">
                {/* App icon hero */}
                <motion.div variants={fadeUp} className="relative mx-auto h-24 w-24">
                  {!reduce ? (
                    <>
                      {/* Animated rings */}
                      <motion.span
                        className="absolute inset-0 rounded-3xl border-2 border-primary/30"
                        animate={{ scale: [1, 1.35, 1.35], opacity: [0.6, 0, 0] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
                        aria-hidden
                      />
                      <motion.span
                        className="absolute inset-0 rounded-3xl border-2 border-secondary/30"
                        animate={{ scale: [1, 1.35, 1.35], opacity: [0.6, 0, 0] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 1.2 }}
                        aria-hidden
                      />
                    </>
                  ) : null}
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.05 }}
                    className="relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-elevated"
                  >
                    <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 17l4-8 5 6 5-8" />
                      <circle cx="19" cy="7" r="1.6" fill="currentColor" />
                    </svg>
                    <motion.span
                      className="pointer-events-none absolute inset-0 rounded-3xl"
                      style={{
                        background:
                          'linear-gradient(120deg, transparent 30%, hsl(var(--primary-foreground) / 0.45) 50%, transparent 70%)',
                      }}
                      animate={reduce ? undefined : { x: ['-100%', '100%'] }}
                      transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}
                      aria-hidden
                    />
                  </motion.span>
                </motion.div>

                <motion.p
                  variants={fadeUp}
                  className="mt-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-primary"
                >
                  <Sparkles className="me-1 inline h-3 w-3 align-[-2px]" />
                  {t('pwa.dialog.eyebrow')}
                </motion.p>

                <motion.h2
                  id="install-dialog-title"
                  variants={fadeUp}
                  className="mt-2 text-center text-2xl font-extrabold tracking-tight sm:text-3xl"
                >
                  {t('pwa.dialog.title')}
                </motion.h2>

                <motion.p
                  variants={fadeUp}
                  className="mt-2 text-balance text-center text-sm text-muted-foreground"
                >
                  {t('pwa.dialog.subtitle')}
                </motion.p>

                {/* Perks grid */}
                <motion.ul variants={stagger} className="mt-6 grid grid-cols-2 gap-2.5">
                  {perks.map(({ Icon, titleKey, bodyKey, tone }) => (
                    <motion.li
                      key={titleKey}
                      variants={fadeUp}
                      whileHover={{ y: -2 }}
                      className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-background/70 p-3 backdrop-blur-sm"
                    >
                      <span
                        className={cn(
                          'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                          tone === 'primary' && 'bg-primary/15 text-primary',
                          tone === 'secondary' && 'bg-secondary/15 text-secondary',
                          tone === 'success' && 'bg-success/15 text-success',
                          tone === 'warning' && 'bg-warning/15 text-warning',
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{t(titleKey)}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t(bodyKey)}</p>
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>

                {/* Action zone */}
                {isIos && !canPrompt ? (
                  <motion.div variants={fadeUp} className="mt-6 space-y-3">
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-sm">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span>{t('pwa.dialog.iosStep1')}</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                          <Share className="h-3.5 w-3.5" aria-hidden /> {t('pwa.dialog.iosShare')}
                        </span>
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span>{t('pwa.dialog.iosStep2')}</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-secondary/15 px-2 py-0.5 font-semibold text-secondary">
                          <PlusIcon className="h-3.5 w-3.5" aria-hidden /> {t('pwa.dialog.iosAddToHome')}
                        </span>
                      </p>
                    </div>
                    <Button variant="ghost" fullWidth onClick={onClose}>
                      {t('pwa.dialog.later')}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div variants={fadeUp} className="mt-6 space-y-2.5">
                    {/* Big install CTA with pulsing glow */}
                    <div className="relative">
                      {!reduce && canPrompt ? (
                        <motion.span
                          aria-hidden
                          className="absolute inset-0 -z-10 rounded-lg bg-primary/40 blur-xl"
                          animate={{ opacity: [0.35, 0.7, 0.35] }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      ) : null}
                      <Button
                        fullWidth
                        size="lg"
                        onClick={handleInstall}
                        disabled={!canPrompt}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        {t('pwa.dialog.installNow')}
                      </Button>
                    </div>
                    <Button variant="ghost" fullWidth onClick={onClose}>
                      {t('pwa.dialog.later')}
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

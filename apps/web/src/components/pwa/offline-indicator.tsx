import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useI18n } from '@/i18n';

export function OfflineIndicator() {
  const { t } = useI18n();
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online ? (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -24, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="pointer-events-none fixed inset-x-0 top-0 z-50 grid place-items-center pt-[calc(env(safe-area-inset-top)+0.5rem)]"
        >
          <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/15 px-3 py-1.5 text-xs font-semibold text-warning shadow-soft backdrop-blur">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            {t('pwa.offline')}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

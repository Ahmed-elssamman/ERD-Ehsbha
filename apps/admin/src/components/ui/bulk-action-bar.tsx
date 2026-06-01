import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';
import { useI18n } from '@/i18n/provider';

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  children: ReactNode;
}

/** Floating bar that slides in when items are selected, holding bulk action buttons. */
export function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
        >
          <div className="pointer-events-auto flex max-w-3xl items-center gap-2 rounded-full border bg-card px-3 py-2 shadow-lg">
            <Button variant="ghost" size="sm" onClick={onClear} aria-label={t('common.cancel')}>
              <X className="h-3.5 w-3.5" />
            </Button>
            <span className="text-sm font-medium tabular-nums">
              {count} {t('common.rows')}
            </span>
            <div className="mx-1 h-5 w-px bg-border" />
            <div className="flex flex-wrap items-center gap-1.5">{children}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

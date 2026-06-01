import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /**
   * Controls the dialog's max-width.
   *  - sm  (28rem)  — confirm / single field
   *  - md  (32rem)  — default; standard form
   *  - lg  (42rem)  — wide form / multi-section
   *  - xl  (56rem)  — extra content like the OCR multi-trip review
   */
  size?: DialogSize;
}

const SIZE_TO_MAX_WIDTH: Record<DialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
}: DialogProps) {
  const t = useT();
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

  return (
    <AnimatePresence>
      {open ? (
        // Outer flex container caps the dialog at viewport height (using `dvh`
        // so the mobile address bar's collapse/expand doesn't clip the
        // sticky footer) and centres on desktop, bottom-sheets on mobile.
        // `safe-area-inset-bottom` reserves the iOS home-indicator gutter.
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'dialog-title' : undefined}
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            // Three-row grid: header (auto) / body (1fr scroll) / footer (auto).
            // `max-h-[100dvh]` on mobile makes the sheet sit flush at the
            // bottom while body content scrolls inside; `sm:max-h-[calc(100dvh-2rem)]`
            // leaves a 1rem gap on each side on desktop.
            className={cn(
              'relative z-10 flex w-full flex-col overflow-hidden border border-border bg-card text-card-foreground shadow-elevated',
              'max-h-[100dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
              'sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:pb-0',
              SIZE_TO_MAX_WIDTH[size],
              className,
            )}
          >
            {(title || description) ? (
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 p-5">
                <div className="min-w-0">
                  {title ? (
                    <h2 id="dialog-title" className="text-base font-semibold">
                      {title}
                    </h2>
                  ) : null}
                  {description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                  ) : null}
                </div>
                <Button variant="ghost" size="icon" aria-label={t('common.close')} onClick={onClose}>
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 scroll-smooth">
              {children}
            </div>
            {footer ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/60 bg-muted/30 p-4">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  loading?: boolean;
} & PropsWithChildren) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={body}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

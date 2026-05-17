import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
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
        <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center">
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
            className={cn(
              'relative z-10 w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card text-card-foreground shadow-elevated sm:rounded-2xl',
              className,
            )}
          >
            {(title || description) ? (
              <div className="flex items-start justify-between gap-3 border-b border-border/60 p-5">
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
                <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : null}
            <div className="p-5">{children}</div>
            {footer ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 bg-muted/30 p-4">
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

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
  );
}

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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement) ?? null;

    // Defer initial focus until the panel is mounted in the DOM, then move
    // focus to the first focusable child (or the panel itself as fallback).
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusable(panel);
      // Prefer first non-close-button focusable so screen-reader users land
      // on the dialog's primary content rather than the dismiss button.
      const target = focusables.find((el) => el.getAttribute('aria-label') !== t('common.close'))
        ?? focusables[0]
        ?? panel;
      target.focus({ preventScroll: true });
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusable(panel);
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      // Return focus to whatever opened the dialog so keyboard users don't
      // lose their place. Guard for elements that left the DOM mid-dialog.
      const opener = openerRef.current;
      if (opener && document.body.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open, onClose, t]);

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
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'dialog-title' : undefined}
            tabIndex={-1}
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

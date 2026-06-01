import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id'>) => void;
  remove: (id: string) => void;
}

const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) => useToasts.getState().push({ kind: 'success', title, description }),
  error: (title: string, description?: string) => useToasts.getState().push({ kind: 'error', title, description }),
  info: (title: string, description?: string) => useToasts.getState().push({ kind: 'info', title, description }),
  warning: (title: string, description?: string) => useToasts.getState().push({ kind: 'warning', title, description }),
};

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS: Record<ToastKind, string> = {
  success: 'border-success/30 bg-success/5 text-success',
  error: 'border-danger/30 bg-danger/5 text-danger',
  info: 'border-primary/30 bg-primary/5 text-primary',
  warning: 'border-warning/30 bg-warning/5 text-warning',
};

export function ToastViewport() {
  const toasts = useToasts((s) => s.toasts);
  const remove = useToasts((s) => s.remove);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col-reverse gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-card p-3 shadow-md',
                COLORS[t.kind],
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>
                )}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

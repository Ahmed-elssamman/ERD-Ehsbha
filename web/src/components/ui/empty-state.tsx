import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  Icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ Icon, title, body, action, className }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {body ? <p className="max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </motion.div>
  );
}

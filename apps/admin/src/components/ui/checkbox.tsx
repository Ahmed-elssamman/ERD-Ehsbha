import { forwardRef, type InputHTMLAttributes } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, checked, ...props }, ref) => {
    return (
      <span className={cn('relative inline-flex h-4 w-4 select-none items-center justify-center', className)}>
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          className={cn(
            'peer h-4 w-4 cursor-pointer appearance-none rounded border bg-background transition-colors',
            'border-input hover:border-primary/50',
            'checked:border-primary checked:bg-primary',
            indeterminate && 'border-primary bg-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          onClick={(e) => e.stopPropagation()}
          {...props}
        />
        {indeterminate ? (
          <Minus className="pointer-events-none absolute h-3 w-3 text-primary-foreground" />
        ) : (
          <Check className="pointer-events-none absolute h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100" />
        )}
      </span>
    );
  },
);
Checkbox.displayName = 'Checkbox';

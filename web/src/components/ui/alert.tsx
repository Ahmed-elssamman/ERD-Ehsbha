import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:start-4 [&>svg]:top-3.5 [&>svg]:text-foreground [&>svg~*]:ps-7',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground border-border',
        destructive: 'bg-destructive/10 text-destructive border-destructive/30 [&>svg]:text-destructive',
        success: 'bg-success/10 text-success border-success/30 [&>svg]:text-success',
        warning: 'bg-warning/10 text-warning border-warning/30 [&>svg]:text-warning',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export const Alert = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(
  function Alert({ className, variant, ...props }, ref) {
    return <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
  },
);

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm opacity-90 [&_p]:leading-relaxed', className)} {...props} />;
}

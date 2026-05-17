import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl border border-border/70 bg-card text-card-foreground shadow-soft',
          'transition-shadow hover:shadow-elevated',
          className,
        )}
        {...props}
      />
    );
  },
);

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5 sm:p-6', className)} {...props} />;
  },
);

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <h3 ref={ref} className={cn('text-base font-semibold leading-none tracking-tight', className)} {...props} />
    );
  },
);

export const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription({ className, ...props }, ref) {
    return <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />;
  },
);

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />;
  },
);

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return <div ref={ref} className={cn('flex items-center p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />;
  },
);

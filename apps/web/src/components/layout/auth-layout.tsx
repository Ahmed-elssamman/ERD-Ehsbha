import type { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/controls/theme-toggle';
import { LangToggle } from '@/components/controls/lang-toggle';
import { FeaturedTestimonials } from '@/components/testimonials/featured-testimonials';
import { useT } from '@/i18n';

interface AuthLayoutProps {
  /** Set to false to hide the featured testimonials strip below the form (default true). */
  showTestimonials?: boolean;
}

export function AuthLayout({ children, showTestimonials = true }: PropsWithChildren<AuthLayoutProps>) {
  const t = useT();
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60% 50% at 80% 0%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(60% 60% at 0% 80%, hsl(var(--secondary) / 0.18), transparent 60%)',
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
        <div className="flex items-center gap-1">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 px-4 pb-12 pt-6 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:pt-12">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="hidden flex-col justify-center lg:flex"
        >
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            <span className="gradient-text">{t('app.name')}</span>
            <br />
            {t('auth.tagline')}
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            {t('app.tagline')}
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {['netProfit', 'distance', 'hours', 'profitPerHour'].map((k) => (
              <li key={k} className="flex items-center gap-3 text-foreground/80">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                {t(`dashboard.${k}`)}
              </li>
            ))}
          </ul>
          {showTestimonials ? (
            <div className="mt-10">
              <FeaturedTestimonials limit={3} variant="compact" />
            </div>
          ) : null}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
          className="flex items-center justify-center"
        >
          <div className="w-full max-w-md">{children}</div>
        </motion.section>

        {showTestimonials ? (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.15 }}
            className="lg:col-span-2 lg:hidden"
          >
            <FeaturedTestimonials limit={3} variant="compact" />
          </motion.section>
        ) : null}
      </main>
    </div>
  );
}

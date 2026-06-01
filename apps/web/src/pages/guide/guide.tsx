import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import {
  Activity,
  BarChart3,
  Bike,
  CalendarClock,
  Car,
  CheckCircle2,
  Clock,
  Coins,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  Lightbulb,
  Minus,
  Plus,
  Receipt,
  Route as RouteIcon,
  Sigma,
  Sparkles,
  Target,
  Timer,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

/* -------- Animation primitives ------------------------------------------ */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 12 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 240, damping: 20 },
  },
};

function useSection() {
  const reduce = useReducedMotion();
  return {
    initial: reduce ? false : 'hidden',
    whileInView: 'show' as const,
    viewport: { once: true, margin: '-80px' },
  };
}

/* -------- Page ---------------------------------------------------------- */

export function GuidePage() {
  return (
    <div className="space-y-12 pb-8 animate-fade-in">
      <Hero />
      <TableOfContents />
      <StepsSection />
      <FeaturesSection />
      <TipsSection />
      <FaqSection />
      <FooterCta />
    </div>
  );
}

/* -------- Hero ---------------------------------------------------------- */

function Hero() {
  const { t } = useI18n();
  const reduce = useReducedMotion();

  return (
    <section className="relative -mx-4 overflow-hidden rounded-2xl sm:-mx-8 sm:rounded-3xl">
      {/* Animated gradient backdrop */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <motion.div
          className="absolute -inset-[20%] rounded-full opacity-60 blur-3xl"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, hsl(var(--primary) / 0.45), transparent 50%), radial-gradient(circle at 70% 70%, hsl(var(--secondary) / 0.45), transparent 50%)',
          }}
          animate={reduce ? undefined : { rotate: [0, 360] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 px-6 py-14 text-center sm:px-12 sm:py-20"
      >
        <motion.div variants={fadeUp}>
          <Badge variant="default" className="px-3 py-1">
            <Sparkles className="h-3.5 w-3.5" /> {t('guide.heroEyebrow')}
          </Badge>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="mt-6 text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl"
        >
          {t('guide.heroLine1')}{' '}
          <span className="gradient-text">{t('guide.heroLine2')}</span>{' '}
          {t('guide.heroLine3')}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mx-auto mt-4 max-w-xl text-balance text-base text-muted-foreground sm:text-lg"
        >
          {t('guide.heroBody')}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <a href="#steps">{t('guide.ctaStart')}</a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/trips/new">{t('guide.ctaTrips')}</Link>
          </Button>
        </motion.div>

        {/* Floating glyphs */}
        {!reduce ? <FloatingGlyphs /> : null}
      </motion.div>
    </section>
  );
}

function FloatingGlyphs() {
  const glyphs: Array<{ Icon: LucideIcon; left: string; top: string; delay: number; size: number }> = [
    { Icon: Car, left: '8%', top: '15%', delay: 0, size: 28 },
    { Icon: Coins, left: '85%', top: '18%', delay: 0.6, size: 24 },
    { Icon: Gauge, left: '12%', top: '70%', delay: 1.2, size: 32 },
    { Icon: RouteIcon, left: '88%', top: '72%', delay: 1.8, size: 28 },
    { Icon: HeartPulse, left: '50%', top: '8%', delay: 2.2, size: 22 },
    { Icon: Bike, left: '78%', top: '45%', delay: 0.9, size: 26 },
  ];
  return (
    <>
      {glyphs.map(({ Icon, left, top, delay, size }, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute text-primary/40"
          style={{ left, top, fontSize: size }}
          initial={{ opacity: 0, y: 12 }}
          animate={{
            opacity: [0, 0.6, 0.6, 0],
            y: [-6, 6, -6],
          }}
          transition={{
            duration: 6,
            delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <Icon style={{ width: size, height: size }} />
        </motion.span>
      ))}
    </>
  );
}

/* -------- Table of Contents -------------------------------------------- */

function TableOfContents() {
  const { t } = useI18n();
  const section = useSection();
  const items: Array<{ key: string; href: string; Icon: LucideIcon }> = [
    { key: 'steps', href: '#steps', Icon: CheckCircle2 },
    { key: 'features', href: '#features', Icon: LayoutDashboard },
    { key: 'tips', href: '#tips', Icon: Lightbulb },
    { key: 'faq', href: '#faq', Icon: Sparkles },
  ];

  return (
    <motion.section variants={stagger} {...section}>
      <motion.h2 variants={fadeUp} className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t('guide.tableOfContents')}
      </motion.h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(({ key, href, Icon }) => (
          <motion.a
            key={key}
            href={href}
            variants={popIn}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.97 }}
            className="group flex flex-col items-start gap-2 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <p className="text-sm font-semibold">{t(`guide.toc.${key}`)}</p>
          </motion.a>
        ))}
      </div>
    </motion.section>
  );
}

/* -------- Steps --------------------------------------------------------- */

function StepsSection() {
  const { t } = useI18n();
  const section = useSection();
  const steps: Array<{ key: string; Icon: LucideIcon; tone: string }> = [
    { key: 'vehicle', Icon: Car, tone: 'from-primary/15 to-primary/5' },
    { key: 'apps', Icon: Sigma, tone: 'from-secondary/15 to-secondary/5' },
    { key: 'trip', Icon: RouteIcon, tone: 'from-warning/15 to-warning/5' },
    { key: 'see', Icon: Sparkles, tone: 'from-success/15 to-success/5' },
  ];

  return (
    <section id="steps" className="scroll-mt-20">
      <motion.div variants={stagger} {...section} className="mb-6 text-center">
        <motion.h2 variants={fadeUp} className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {t('guide.stepsTitle')}
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-2 text-sm text-muted-foreground sm:text-base">
          {t('guide.stepsSubtitle')}
        </motion.p>
      </motion.div>

      <motion.ol variants={stagger} {...section} className="relative grid gap-4 md:grid-cols-2">
        {steps.map(({ key, Icon, tone }, i) => (
          <motion.li
            key={key}
            variants={popIn}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5"
          >
            <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80', tone)} aria-hidden />
            <div className="relative z-10 flex items-start gap-4">
              <div className="flex flex-col items-center">
                <motion.span
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 300, damping: 16, delay: i * 0.05 }}
                  className="num-tabular grid h-10 w-10 place-items-center rounded-full bg-foreground text-background text-base font-bold shadow-soft"
                >
                  {i + 1}
                </motion.span>
                <span className="mt-2 grid h-9 w-9 place-items-center rounded-lg bg-card text-primary shadow-soft">
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold leading-snug">{t(`guide.steps.${key}.title`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`guide.steps.${key}.body`)}</p>
                <div className="mt-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs">
                  <span className="font-semibold text-primary">★ </span>
                  <span className="text-foreground/90">{t(`guide.steps.${key}.example`)}</span>
                </div>
              </div>
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}

/* -------- Features ------------------------------------------------------ */

function FeaturesSection() {
  const { t } = useI18n();
  const section = useSection();
  const features: Array<{ key: string; Icon: LucideIcon; to: string }> = [
    { key: 'dashboard', Icon: LayoutDashboard, to: '/' },
    { key: 'trips', Icon: RouteIcon, to: '/trips' },
    { key: 'expenses', Icon: Receipt, to: '/expenses' },
    { key: 'vehicleHealth', Icon: HeartPulse, to: '/vehicle-health' },
    { key: 'analytics', Icon: BarChart3, to: '/analytics' },
    { key: 'driverScore', Icon: Gauge, to: '/driver-score' },
    { key: 'decisions', Icon: Lightbulb, to: '/smart-decisions' },
    { key: 'planner', Icon: CalendarClock, to: '/work-planner' },
    { key: 'bestHours', Icon: Clock, to: '/best-hours' },
    { key: 'simulator', Icon: Sigma, to: '/profit-simulator' },
    { key: 'maintenance', Icon: Wrench, to: '/maintenance' },
    { key: 'goals', Icon: Target, to: '/settings' },
  ];

  return (
    <section id="features" className="scroll-mt-20">
      <motion.div variants={stagger} {...section} className="mb-6">
        <motion.h2 variants={fadeUp} className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {t('guide.featuresTitle')}
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-2 text-sm text-muted-foreground sm:text-base">
          {t('guide.featuresSubtitle')}
        </motion.p>
      </motion.div>

      <motion.div variants={stagger} {...section} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ key, Icon, to }) => (
          <motion.div key={key} variants={popIn} whileHover={{ y: -4 }}>
            <Link
              to={to}
              className="group flex h-full items-start gap-3 rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-elevated"
            >
              <motion.span
                whileHover={{ rotate: -8, scale: 1.08 }}
                transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 text-primary"
              >
                <Icon className="h-5 w-5" aria-hidden />
              </motion.span>
              <div className="min-w-0">
                <p className="font-semibold leading-snug">{t(`guide.features.${key}.title`)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t(`guide.features.${key}.body`)}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* -------- Tips ---------------------------------------------------------- */

function TipsSection() {
  const { t } = useI18n();
  const section = useSection();
  const tips: Array<{ key: string; Icon: LucideIcon }> = [
    { key: 'daily', Icon: CalendarClock },
    { key: 'received', Icon: Coins },
    { key: 'kmBoth', Icon: RouteIcon },
    { key: 'expenses', Icon: Receipt },
    { key: 'vehicleCosts', Icon: HeartPulse },
    { key: 'wellness', Icon: Activity },
    { key: 'goals', Icon: Target },
  ];

  return (
    <section id="tips" className="scroll-mt-20">
      <motion.div variants={stagger} {...section} className="mb-6">
        <motion.h2 variants={fadeUp} className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {t('guide.tipsTitle')}
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-2 text-sm text-muted-foreground sm:text-base">
          {t('guide.tipsSubtitle')}
        </motion.p>
      </motion.div>

      <motion.ul variants={stagger} {...section} className="space-y-2">
        {tips.map(({ key, Icon }, i) => (
          <motion.li
            key={key}
            variants={fadeUp}
            whileHover={{ x: 4 }}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:bg-accent/30"
          >
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 300, damping: 18, delay: i * 0.04 }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success/15 text-success"
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </motion.span>
            <p className="pt-1.5 text-sm">{t(`guide.tips.${key}`)}</p>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

/* -------- FAQ ----------------------------------------------------------- */

function FaqSection() {
  const { t } = useI18n();
  const section = useSection();
  const keys = ['profit', 'score', 'commission', 'vehicleCost', 'offline', 'data', 'language', 'delete'];
  const [open, setOpen] = useState<string | null>(keys[0]);

  return (
    <section id="faq" className="scroll-mt-20">
      <motion.div variants={stagger} {...section} className="mb-6">
        <motion.h2 variants={fadeUp} className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {t('guide.faqTitle')}
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-2 text-sm text-muted-foreground sm:text-base">
          {t('guide.faqSubtitle')}
        </motion.p>
      </motion.div>

      <motion.div variants={stagger} {...section} className="space-y-2">
        {keys.map((key) => {
          const isOpen = open === key;
          return (
            <motion.div
              key={key}
              variants={fadeUp}
              className={cn(
                'rounded-xl border bg-card transition-colors',
                isOpen ? 'border-primary/40 shadow-elevated' : 'border-border/60',
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : key)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start"
              >
                <span className="font-semibold leading-snug">{t(`guide.faq.${key}.q`)}</span>
                <motion.span
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: 0.18 }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                  aria-hidden
                >
                  {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    key="answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                      {t(`guide.faq.${key}.a`)}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

/* -------- Footer CTA ---------------------------------------------------- */

function FooterCta() {
  const { t } = useI18n();
  const section = useSection();
  return (
    <motion.section variants={stagger} {...section}>
      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-secondary/10">
        <CardContent className="relative p-8 text-center sm:p-12">
          <motion.div variants={popIn} className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-elevated">
            <Timer className="h-6 w-6" aria-hidden />
          </motion.div>
          <motion.p variants={fadeUp} className="mt-4 text-balance text-xl font-semibold sm:text-2xl">
            {t('guide.ctaFooter')}
          </motion.p>
          <motion.div variants={fadeUp} className="mt-6 flex items-center justify-center">
            <Button asChild size="lg">
              <Link to="/trips/new">{t('guide.ctaFooterAction')}</Link>
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.section>
  );
}

import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Route,
  Wallet,
  Wrench,
  HeartPulse,
  BarChart3,
  Gauge,
  Lightbulb,
  CalendarClock,
  Clock,
  Sigma,
  Bell,
  Settings,
  BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { useEffect } from 'react';

interface NavItem {
  to: string;
  labelKey: string;
  Icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', Icon: LayoutDashboard },
  { to: '/trips', labelKey: 'nav.trips', Icon: Route },
  { to: '/expenses', labelKey: 'nav.expenses', Icon: Wallet },
  { to: '/maintenance', labelKey: 'nav.maintenance', Icon: Wrench },
  { to: '/vehicle-health', labelKey: 'nav.vehicleHealth', Icon: HeartPulse },
  { to: '/analytics', labelKey: 'nav.analytics', Icon: BarChart3 },
  { to: '/driver-score', labelKey: 'nav.driverScore', Icon: Gauge },
  { to: '/smart-decisions', labelKey: 'nav.smartDecisions', Icon: Lightbulb },
  { to: '/work-planner', labelKey: 'nav.workPlanner', Icon: CalendarClock },
  { to: '/best-hours', labelKey: 'nav.bestHours', Icon: Clock },
  { to: '/profit-simulator', labelKey: 'nav.profitSimulator', Icon: Sigma },
  { to: '/notifications', labelKey: 'nav.notifications', Icon: Bell },
  { to: '/guide', labelKey: 'nav.guide', Icon: BookOpen },
  { to: '/settings', labelKey: 'nav.settings', Icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  const location = useLocation();
  useEffect(() => {
    onNavigate?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <nav aria-label="Primary" className="h-full">
      <ul className="flex flex-col gap-0.5 p-3">
        {NAV.map(({ to, labelKey, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                  'transition-colors',
                  isActive
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-y-1 start-0 w-1 rounded-full bg-primary"
                      aria-hidden
                    />
                  ) : null}
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className="truncate">{t(labelKey)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

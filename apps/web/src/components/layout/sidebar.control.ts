import {
  LayoutDashboard,
  Route,
  Wallet,
  Fuel,
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
  FileText,
  Users,
  Star,
  LifeBuoy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  to: string;
  labelKey: string;
  Icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', Icon: LayoutDashboard },
  { to: '/trips', labelKey: 'nav.trips', Icon: Route },
  { to: '/expenses', labelKey: 'nav.expenses', Icon: Wallet },
  { to: '/fuel', labelKey: 'nav.fuel', Icon: Fuel },
  { to: '/maintenance', labelKey: 'nav.maintenance', Icon: Wrench },
  { to: '/vehicle-health', labelKey: 'nav.vehicleHealth', Icon: HeartPulse },
  { to: '/analytics', labelKey: 'nav.analytics', Icon: BarChart3 },
  { to: '/reports', labelKey: 'nav.reports', Icon: FileText },
  { to: '/wellness', labelKey: 'nav.wellness', Icon: HeartPulse },
  { to: '/driver-score', labelKey: 'nav.driverScore', Icon: Gauge },
  { to: '/smart-decisions', labelKey: 'nav.smartDecisions', Icon: Lightbulb },
  { to: '/work-planner', labelKey: 'nav.workPlanner', Icon: CalendarClock },
  { to: '/work-sessions', labelKey: 'nav.workSessions', Icon: Clock },
  { to: '/best-hours', labelKey: 'nav.bestHours', Icon: Clock },
  { to: '/profit-simulator', labelKey: 'nav.profitSimulator', Icon: Sigma },
  { to: '/notifications', labelKey: 'nav.notifications', Icon: Bell },
  { to: '/community', labelKey: 'nav.community', Icon: Users },
  { to: '/reviews', labelKey: 'nav.reviews', Icon: Star },
  { to: '/support', labelKey: 'nav.support', Icon: LifeBuoy },
  { to: '/guide', labelKey: 'nav.guide', Icon: BookOpen },
  { to: '/settings', labelKey: 'nav.settings', Icon: Settings },
];

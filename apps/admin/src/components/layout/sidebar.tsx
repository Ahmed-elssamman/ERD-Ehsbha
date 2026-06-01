import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Car,
  MapPin,
  Truck,
  BarChart3,
  Wallet,
  MessageSquare,
  Star,
  LifeBuoy,
  Bell,
  ScrollText,
  HeartPulse,
  Shield,
  Settings as SettingsIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/stores/admin-auth.store';
import { useI18n } from '@/i18n/provider';

interface NavItem {
  labelKey: string;
  to: string;
  icon: typeof LayoutDashboard;
  requires?: string;
}

interface NavSection {
  headingKey?: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    items: [{ labelKey: 'nav.dashboard', to: '/', icon: LayoutDashboard, requires: 'dashboard.read' }],
  },
  {
    headingKey: 'nav.core',
    items: [
      { labelKey: 'nav.users', to: '/users', icon: Users, requires: 'users.read' },
      { labelKey: 'nav.drivers', to: '/drivers', icon: Car, requires: 'drivers.read' },
      { labelKey: 'nav.trips', to: '/trips', icon: MapPin, requires: 'trips.read' },
      { labelKey: 'nav.vehicles', to: '/vehicles', icon: Truck, requires: 'vehicles.read' },
    ],
  },
  {
    headingKey: 'nav.intelligence',
    items: [
      { labelKey: 'nav.analytics', to: '/analytics', icon: BarChart3, requires: 'analytics.read' },
      { labelKey: 'nav.revenue', to: '/revenue', icon: Wallet, requires: 'revenue.read' },
    ],
  },
  {
    headingKey: 'nav.community',
    items: [
      { labelKey: 'nav.communityPage', to: '/community', icon: MessageSquare, requires: 'community.read' },
      { labelKey: 'nav.reviews', to: '/reviews', icon: Star, requires: 'reviews.read' },
    ],
  },
  {
    headingKey: 'nav.operations',
    items: [
      { labelKey: 'nav.support', to: '/support', icon: LifeBuoy, requires: 'support.read' },
      { labelKey: 'nav.notifications', to: '/notifications', icon: Bell, requires: 'notifications.read' },
      { labelKey: 'nav.audit', to: '/audit', icon: ScrollText, requires: 'audit.read' },
      { labelKey: 'nav.health', to: '/health', icon: HeartPulse, requires: 'platform_health.read' },
    ],
  },
  {
    headingKey: 'nav.system',
    items: [
      { labelKey: 'nav.rolesPerms', to: '/roles', icon: Shield, requires: 'roles.read' },
      { labelKey: 'nav.settings', to: '/settings', icon: SettingsIcon, requires: 'settings.read' },
    ],
  },
];

export function Sidebar() {
  const hasPermission = useAdminAuth((s) => s.hasPermission);
  const { t, dir } = useI18n();

  return (
    <aside
      className={cn(
        'hidden w-64 shrink-0 bg-card md:flex md:flex-col',
        dir === 'rtl' ? 'border-s' : 'border-e',
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
          <Shield className="h-4 w-4" />
        </div>
        <div className="font-semibold tracking-tight">Ehsbha {dir === 'rtl' ? 'الإدارة' : 'Admin'}</div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {SECTIONS.map((section, i) => {
          const visible = section.items.filter((it) => !it.requires || hasPermission(it.requires));
          if (visible.length === 0) return null;
          return (
            <div key={i} className="mb-4">
              {section.headingKey && (
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(section.headingKey)}
                </div>
              )}
              <ul className="space-y-0.5">
                {visible.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                          'hover:bg-accent hover:text-accent-foreground',
                          isActive && 'bg-accent font-medium text-accent-foreground',
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

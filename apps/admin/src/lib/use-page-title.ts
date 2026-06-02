import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '@/i18n/provider';

// First path segment → i18n key for that page's title. Reuses the sidebar
// nav labels so tab titles stay in sync (and localized) automatically.
const TITLE_KEYS: Record<string, string> = {
  '': 'nav.dashboard',
  login: 'meta.login',
  users: 'nav.users',
  drivers: 'nav.drivers',
  trips: 'nav.trips',
  vehicles: 'nav.vehicles',
  analytics: 'nav.analytics',
  revenue: 'nav.revenue',
  community: 'nav.communityPage',
  reviews: 'nav.reviews',
  support: 'nav.support',
  notifications: 'nav.notifications',
  audit: 'nav.audit',
  health: 'nav.health',
  roles: 'nav.rolesPerms',
  settings: 'nav.settings',
};

/** Keeps document.title in sync with the active route, e.g. "Users · Ehsbha Admin". */
export function usePageTitle() {
  const { pathname } = useLocation();
  const { t, locale } = useI18n();

  useEffect(() => {
    const segment = pathname.split('/')[1] ?? '';
    const key = segment in TITLE_KEYS ? TITLE_KEYS[segment] : 'meta.notFound';
    const brand = locale === 'ar' ? 'إحسبها — الإدارة' : 'Ehsbha Admin';
    document.title = key === 'nav.dashboard' ? brand : `${t(key)} · ${brand}`;
  }, [pathname, t, locale]);
}

import { NavLink, useLocation } from 'react-router-dom';

import { NAV } from './sidebar.control';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { useEffect, useRef } from 'react';



export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  const location = useLocation();
  const initialPath = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname === initialPath.current) return;
    onNavigate?.();

  }, [location.pathname]);

  return (
    <nav aria-label={t('common.primaryNavigation')} className="h-full">
      <ul className="flex flex-col gap-0.5 p-3">
        {NAV.map(({ to, labelKey, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              onClick={() => onNavigate?.()}
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

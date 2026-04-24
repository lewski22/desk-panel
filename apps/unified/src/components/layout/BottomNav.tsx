/**
 * BottomNav — mobile bottom navigation bar
 * Role-aware tabs with SVG icons, module filtering, active indicator.
 */
import React, { useEffect, useState } from 'react';
import { NavLink, useLocation }        from 'react-router-dom';
import { useTranslation }               from 'react-i18next';
import { appApi }                       from '../../api/client';
import {
  IconFloorPlan, IconCalendar, IconClipboard, IconFolder,
  IconBarChart, IconBeacon, IconUsers, IconPieChart,
  IconGear, IconCard,
} from '../icons/SidebarIcons';

type NavIcon = React.FC<{ className?: string; size?: number }>;

interface NavEntry {
  to:      string;
  icon:    NavIcon;
  labelKey: string;
  badge?:  boolean;
  roles?:  string[];
  module?: string;
}

const NAV_BY_ROLE: Record<string, NavEntry[]> = {
  END_USER: [
    { to: '/map',             icon: IconFloorPlan, labelKey: 'layout.nav.map',            module: 'DESKS' },
    { to: '/my-reservations', icon: IconClipboard, labelKey: 'layout.nav.my_reservations', badge: true, module: 'DESKS' },
    { to: '/weekly',          icon: IconCalendar,  labelKey: 'layout.nav.weekly',          module: 'WEEKLY_VIEW' },
  ],
  STAFF: [
    { to: '/map',             icon: IconFloorPlan, labelKey: 'layout.nav.map',            module: 'DESKS' },
    { to: '/my-reservations', icon: IconClipboard, labelKey: 'layout.nav.my_reservations', badge: true, module: 'DESKS' },
    { to: '/dashboard',       icon: IconBarChart,  labelKey: 'layout.nav.dashboard' },
    { to: '/reservations',    icon: IconFolder,    labelKey: 'layout.nav.reservations',   module: 'DESKS' },
  ],
  OFFICE_ADMIN: [
    { to: '/map',          icon: IconFloorPlan, labelKey: 'layout.nav.map',         module: 'DESKS' },
    { to: '/reservations', icon: IconFolder,    labelKey: 'layout.nav.reservations', module: 'DESKS' },
    { to: '/dashboard',    icon: IconBarChart,  labelKey: 'layout.nav.dashboard' },
    { to: '/users',        icon: IconUsers,     labelKey: 'layout.nav.users' },
  ],
  SUPER_ADMIN: [
    { to: '/map',          icon: IconFloorPlan, labelKey: 'layout.nav.map',         module: 'DESKS' },
    { to: '/reservations', icon: IconFolder,    labelKey: 'layout.nav.reservations', module: 'DESKS' },
    { to: '/dashboard',    icon: IconBarChart,  labelKey: 'layout.nav.dashboard' },
    { to: '/reports',      icon: IconPieChart,  labelKey: 'layout.nav.reports' },
  ],
  OWNER: [
    { to: '/owner',         icon: IconGear,     labelKey: 'layout.nav.owner' },
    { to: '/dashboard',     icon: IconBarChart, labelKey: 'layout.nav.dashboard' },
    { to: '/owner?tab=sub', icon: IconCard,     labelKey: 'layout.nav.subscription' },
  ],
};

interface Props {
  userRole:      string;
  enabledModules?: string[];
}

export function BottomNav({ userRole, enabledModules = [] }: Props) {
  const { t }   = useTranslation();
  const loc      = useLocation();
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    appApi.reservations.getMy()
      .then((r: any[]) => setBadge(r.filter((rv: any) => rv.status === 'CONFIRMED').length))
      .catch(() => {});
  }, [loc.pathname]);

  const hasModule = (m?: string) =>
    !m || enabledModules.length === 0 || enabledModules.includes(m);

  const entries = (NAV_BY_ROLE[userRole] ?? NAV_BY_ROLE.END_USER)
    .filter(n => hasModule(n.module));

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch bg-white"
      style={{
        borderTop:     '1px solid #DDD6F5',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft:   'env(safe-area-inset-left)',
        paddingRight:  'env(safe-area-inset-right)',
      }}
    >
      {entries.map(item => {
        const active    = loc.pathname === item.to || loc.pathname.startsWith(item.to + '/');
        const showBadge = item.badge && badge > 0;
        const Icon      = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 relative min-w-0 min-h-touch transition-colors"
            style={{ color: active ? '#9C2264' : '#6B5F7A' }}
          >
            {active && (
              <span className="absolute top-0 inset-x-3 h-0.5 rounded-b-full bg-brand" />
            )}
            <span className="relative">
              <Icon size={22} />
              {showBadge && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] bg-brand text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium leading-tight truncate max-w-[56px] px-0.5">
              {t(item.labelKey).split(' ').slice(0, 2).join(' ')}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}

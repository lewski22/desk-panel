/**
 * BottomNav — mobile bottom navigation bar
 * Role-aware tabs with SVG icons, module filtering, active indicator.
 */
import React, { useEffect, useState } from 'react';
import { NavLink, useLocation }        from 'react-router-dom';
import { useTranslation }               from 'react-i18next';
import { appApi }                       from '../../api/client';
import {
  IconFloorPlan, IconClipboard, IconFolder,
  IconBarChart, IconBeacon, IconUsers, IconPieChart,
  IconGear, IconCard, IconBell,
} from '../icons/SidebarIcons';

type NavIcon = React.FC<{ className?: string; size?: number }>;

interface NavEntry {
  to:       string;
  icon:     NavIcon;
  labelKey: string;
  badge?:   boolean;
  roles?:   string[];
  module?:  string;
  isMore?:  boolean;
}

const NAV_BY_ROLE: Record<string, NavEntry[]> = {
  END_USER: [
    { to: '/map',             icon: IconFloorPlan, labelKey: 'layout.nav.map_short',          module: 'DESKS' },
    { to: '/my-reservations', icon: IconClipboard, labelKey: 'layout.nav.reservations_short', badge: true },
    { to: '/notifications',   icon: IconBell,      labelKey: 'layout.nav.notifications_short' },
  ],
  STAFF: [
    { to: '/map',          icon: IconFloorPlan, labelKey: 'layout.nav.map',         module: 'DESKS' },
    { to: '/reservations', icon: IconFolder,    labelKey: 'layout.nav.reservations', module: 'DESKS' },
    { to: '/dashboard',    icon: IconBarChart,  labelKey: 'layout.nav.dashboard' },
    { to: '/reports',      icon: IconPieChart,  labelKey: 'layout.nav.reports' },
  ],
  OFFICE_ADMIN: [
    { to: '/map',             icon: IconFloorPlan, labelKey: 'layout.nav.map',            module: 'DESKS' },
    { to: '/my-reservations', icon: IconClipboard, labelKey: 'layout.nav.my_reservations', badge: true },
    { to: '/reservations',    icon: IconFolder,    labelKey: 'layout.nav.reservations',   module: 'DESKS' },
    { to: '/dashboard',       icon: IconBarChart,  labelKey: 'layout.nav.dashboard' },
    { to: '/__more__',        icon: IconGear,      labelKey: 'layout.nav.more', isMore: true },
  ],
  SUPER_ADMIN: [
    { to: '/map',             icon: IconFloorPlan, labelKey: 'layout.nav.map',            module: 'DESKS' },
    { to: '/my-reservations', icon: IconClipboard, labelKey: 'layout.nav.my_reservations', badge: true },
    { to: '/reservations',    icon: IconFolder,    labelKey: 'layout.nav.reservations',   module: 'DESKS' },
    { to: '/dashboard',       icon: IconBarChart,  labelKey: 'layout.nav.dashboard' },
    { to: '/__more__',        icon: IconGear,      labelKey: 'layout.nav.more', isMore: true },
  ],
  OWNER: [
    { to: '/owner',         icon: IconGear,     labelKey: 'layout.nav.owner' },
    { to: '/dashboard',     icon: IconBarChart, labelKey: 'layout.nav.dashboard' },
    { to: '/owner?tab=sub', icon: IconCard,     labelKey: 'layout.nav.subscription' },
  ],
};

const MORE_LINKS = [
  { to: '/provisioning',  icon: '📡', labelKey: 'layout.nav.provisioning', module: 'BEACONS' },
  { to: '/resources',     icon: '🪑', labelKey: 'layout.nav.resources' },
  { to: '/visitors',      icon: '👋', labelKey: 'layout.nav.visitors' },
  { to: '/users',         icon: '👥', labelKey: 'layout.nav.users' },
  { to: '/reports',       icon: '📊', labelKey: 'layout.nav.reports' },
  { to: '/organizations', icon: '🏢', labelKey: 'layout.nav.organizations' },
  { to: '/integrations',  icon: '🔗', labelKey: 'layout.nav.integrations' },
  { to: '/notifications', icon: '🔔', labelKey: 'layout.nav.notifications' },
  { to: '/subscription',  icon: '💳', labelKey: 'layout.nav.subscription' },
];

interface Props {
  userRole:      string;
  enabledModules?: string[];
}

export function BottomNav({ userRole, enabledModules = [] }: Props) {
  const { t }   = useTranslation();
  const loc      = useLocation();
  const [badge, setBadge]     = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      appApi.reservations.getMy(),
      appApi.resources.myBookings(),
    ]).then(([reservations, bookings]) => {
      const deskCount    = reservations.filter((r: any) => r.status === 'CONFIRMED').length;
      const bookingCount = bookings.filter((b: any) => b.status === 'CONFIRMED').length;
      setBadge(deskCount + bookingCount);
    }).catch(() => {});
  }, [loc.pathname]);

  // Close "More" sheet on navigation
  useEffect(() => { setMoreOpen(false); }, [loc.pathname]);

  const hasModule = (m?: string) =>
    !m || enabledModules.length === 0 || enabledModules.includes(m);

  const entries = (NAV_BY_ROLE[userRole] ?? NAV_BY_ROLE.END_USER)
    .filter(n => hasModule(n.module));

  return (
    <>
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
          if (item.isMore) {
            return (
              <button
                key="more"
                onClick={() => setMoreOpen(v => !v)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 min-h-touch"
                style={{ color: moreOpen ? '#9C2264' : '#6B5F7A' }}
              >
                {moreOpen && (
                  <span className="absolute top-0 inset-x-3 h-0.5 rounded-b-full bg-brand" style={{ left: 'auto', right: 'auto' }} />
                )}
                <item.icon size={22} />
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </button>
            );
          }

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

      {/* Bottom sheet "Więcej" */}
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/20"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="md:hidden fixed bottom-16 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-2xl border-t border-zinc-200 p-4"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="w-8 h-1 bg-zinc-200 rounded-full mx-auto mb-4" />
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 px-1">
              {t('layout.nav.more')}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {MORE_LINKS.filter(item => hasModule(item.module)).map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-zinc-50 transition-colors text-center"
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[10px] text-zinc-600 leading-tight">{t(item.labelKey)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

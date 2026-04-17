/**
 * BottomNav — Sprint H1
 * Dolna nawigacja dla mobile (< 640px)
 * 4 stałe przyciski: Mapa / Rezerwacje / Moje / Profil
 * Badge gdy aktywna rezerwacja
 */
import React, { useEffect, useState } from 'react';
import { NavLink, useLocation }        from 'react-router-dom';
import { useTranslation }               from 'react-i18next';
import { appApi }                       from '../../api/client';

interface NavEntry {
  to:      string;
  icon:    string;
  labelKey: string;
  roles?:  string[];
}

const NAV: NavEntry[] = [
  { to: '/map',             icon: '⬡',  labelKey: 'layout.nav.map' },
  { to: '/reservations',    icon: '📋', labelKey: 'layout.nav.reservations', roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
  { to: '/my-reservations', icon: '📅', labelKey: 'layout.nav.my_reservations' },
  { to: '/dashboard',       icon: '📊', labelKey: 'layout.nav.dashboard', roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
];

export function BottomNav({ userRole }: { userRole: string }) {
  const { t }   = useTranslation();
  const loc      = useLocation();
  const [badge, setBadge] = useState(0);

  // Sprawdź aktywne rezerwacje dla badge
  useEffect(() => {
    appApi.reservations.getMy()
      .then((r: any[]) => setBadge(r.filter((rv: any) => rv.status === 'CONFIRMED').length))
      .catch(() => {});
  }, [loc.pathname]);

  const visible = NAV.filter(n => !n.roles || n.roles.includes(userRole));

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-900 border-t border-zinc-800
      flex items-stretch safe-area-bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {visible.map(item => {
        const active = loc.pathname === item.to || loc.pathname.startsWith(item.to + '/');
        const showBadge = item.to === '/my-reservations' && badge > 0;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1
              text-center transition-colors relative min-w-0 ${
                active ? 'text-[#e06aaa]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            <span className="text-xl leading-none relative">
              {item.icon}
              {showBadge && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#B53578] text-white
                  text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span className={`text-[9px] font-medium leading-none truncate max-w-full ${
              active ? 'text-[#e06aaa]' : 'text-zinc-500'
            }`}>
              {t(item.labelKey, item.to.replace('/','')).split(' ')[0]}
            </span>
            {active && (
              <span className="absolute top-0 inset-x-4 h-0.5 bg-[#B53578] rounded-b-full" />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

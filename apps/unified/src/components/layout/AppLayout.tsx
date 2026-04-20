/**
 * AppLayout — v0.18.0
 * Sidebar z grupami nawigacyjnymi + ikony Noun Project + zmiana hasła w dole sidebara
 */
import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';
import { appApi } from '../../api/client';
import { BottomNav } from './BottomNav';
import { NotificationBell } from './NotificationBell';
import { ChangePasswordModal } from './ChangePasswordModal';
import {
  IconFloorPlan, IconCalendar, IconClipboard, IconFolder,
  IconDesk, IconUsers, IconBeacon, IconProvisioning,
  IconRoom, IconVisitor, IconBarChart, IconPieChart,
  IconBuildings, IconLink, IconBell, IconCard,
  IconGear, IconKey, IconLogout,
} from '../icons/SidebarIcons';

interface User {
  id: string;
  email: string;
  role: string;
  organizationId?: string;
  firstName?: string;
  lastName?: string;
  enabledModules?: string[];
  subscriptionStatus?: string | null;
}
interface Props { user: User; onLogout: () => void; children: React.ReactNode; }

type AppModule = 'DESKS' | 'ROOMS' | 'PARKING' | 'FLOOR_PLAN' | 'WEEKLY_VIEW' | 'EQUIPMENT';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', OFFICE_ADMIN: 'Office Admin',
  STAFF: 'Staff', END_USER: 'Użytkownik', OWNER: 'Operator',
};

type NavIcon = React.FC<{ className?: string; size?: number }>;

interface NavGroup {
  key:   string;
  roles: string[];
  items: { to: string; icon: NavIcon; labelKey: string; roles: string[]; module?: AppModule }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key:   'layout.group.workspace',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'],
    items: [
      { to: '/map',             icon: IconFloorPlan, labelKey: 'layout.nav.map',            roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'], module: 'DESKS' },
      { to: '/weekly',          icon: IconCalendar,  labelKey: 'layout.nav.weekly',          roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'], module: 'WEEKLY_VIEW' },
      { to: '/my-reservations', icon: IconClipboard, labelKey: 'layout.nav.my_reservations', roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'], module: 'DESKS' },
      { to: '/reservations',    icon: IconFolder,    labelKey: 'layout.nav.reservations',    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'],            module: 'DESKS' },
    ],
  },
  {
    key:   'layout.group.management',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'],
    items: [
      { to: '/desks',        icon: IconDesk,         labelKey: 'layout.nav.desks',        roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/users',        icon: IconUsers,        labelKey: 'layout.nav.users',        roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/devices',      icon: IconBeacon,       labelKey: 'layout.nav.devices',      roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
      { to: '/provisioning', icon: IconProvisioning, labelKey: 'layout.nav.provisioning', roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/resources',    icon: IconRoom,         labelKey: 'layout.nav.resources',    roles: ['SUPER_ADMIN','OFFICE_ADMIN'], module: 'ROOMS' },
      { to: '/visitors',     icon: IconVisitor,      labelKey: 'layout.nav.visitors',     roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
    ],
  },
  {
    key:   'layout.group.analytics',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'],
    items: [
      { to: '/dashboard', icon: IconBarChart,  labelKey: 'layout.nav.dashboard', roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
      { to: '/reports',   icon: IconPieChart,  labelKey: 'layout.nav.reports',   roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
    ],
  },
  {
    key:   'layout.group.config',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN'],
    items: [
      { to: '/organizations', icon: IconBuildings, labelKey: 'layout.nav.organizations', roles: ['SUPER_ADMIN'] },
      { to: '/integrations',  icon: IconLink,      labelKey: 'layout.nav.integrations',  roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/notifications', icon: IconBell,      labelKey: 'layout.nav.notifications', roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/subscription',  icon: IconCard,      labelKey: 'layout.nav.subscription',  roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    key:   'layout.group.operator',
    roles: ['OWNER'],
    items: [
      { to: '/owner',              icon: IconGear, labelKey: 'layout.nav.owner',             roles: ['OWNER'] },
      { to: '/owner?tab=sub',      icon: IconCard, labelKey: 'layout.nav.subscription',      roles: ['OWNER'] },
      { to: '/notification-rules', icon: IconBell, labelKey: 'layout.nav.notification_rules', roles: ['OWNER'] },
    ],
  },
];

// ── NavItem ──────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label, collapsed, onClick }: {
  to: string; icon: NavIcon; label: string; collapsed?: boolean; onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `relative flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-colors duration-150 ${
          isActive
            ? 'bg-[#B53578]/12 text-white'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
        }`
      }
      title={collapsed ? label : undefined}
    >
      {({ isActive }) => (
        <>
          {/* Left-edge active indicator */}
          {isActive && (
            <span className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#B53578] rounded-r-full" />
          )}
          <Icon
            size={16}
            className={`shrink-0 ${isActive ? 'text-[#B53578]' : ''}`}
          />
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

// ── Main component ───────────────────────────────────────────
export function AppLayout({ user, onLogout, children }: Props) {
  const { t }    = useTranslation();
  const location = useLocation();
  const [collapsed,   setCollapsed]   = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) return saved === 'true';
    return typeof window !== 'undefined' && window.innerWidth < 1280;
  });
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

  const toggleCollapsed = () => setCollapsed(c => {
    const next = !c;
    localStorage.setItem('sidebar_collapsed', String(next));
    return next;
  });

  const isImpersonated = localStorage.getItem('app_impersonated') === 'true';

  const enabledModules: string[] = (user as any).enabledModules ?? [];
  const hasModule = (m: AppModule) =>
    enabledModules.length === 0 || enabledModules.includes(m);

  const doLogout = () => {
    appApi.auth.logout();
    onLogout();
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo + user header */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-b border-zinc-800/80 shrink-0">
        {/* Avatar / Logo */}
        {collapsed && !mobile ? (
          <div className="w-8 h-8 rounded-full bg-[#B53578]/20 border border-[#B53578]/40 flex items-center justify-center shrink-0">
            <span className="text-[#B53578] font-black text-sm">R</span>
          </div>
        ) : (
          <>
            <div className="w-8 h-8 rounded-full bg-[#B53578] flex items-center justify-center shrink-0 text-white text-xs font-bold select-none">
              {user.firstName
                ? `${user.firstName[0]}${user.lastName?.[0] ?? ''}`.toUpperCase()
                : user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-xs font-semibold truncate">
                {user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user.email}
              </div>
              <div className="text-[#B53578] text-[10px] font-semibold uppercase tracking-wider mt-0.5">
                {ROLE_LABEL[user.role] ?? user.role}
              </div>
            </div>
          </>
        )}
        {!mobile && (
          <button
            onClick={toggleCollapsed}
            className="shrink-0 text-zinc-500 hover:text-zinc-200 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
            title={collapsed ? t('layout.expand') : t('layout.collapse')}
          >
            <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
              {collapsed
                ? <path d="M7 4l6 6-6 6V4z" />
                : <path d="M13 4l-6 6 6 6V4z" />}
            </svg>
          </button>
        )}
        {mobile && (
          <button onClick={() => setMobileOpen(false)}
            className="ml-auto text-zinc-500 hover:text-white p-1 rounded-lg">
            ✕
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-zinc-700">
        {NAV_GROUPS.map((group, gi) => {
          if (!group.roles.includes(user.role)) return null;
          const visibleItems = group.items.filter(item => {
            if (!item.roles.includes(user.role)) return false;
            if (item.module && !hasModule(item.module)) return false;
            return true;
          });
          if (!visibleItems.length) return null;

          return (
            <div key={group.key} className={gi > 0 ? 'mt-1 pt-1 border-t border-zinc-800/70' : 'mt-0'}>
              {(!collapsed || mobile) && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {t(group.key)}
                </div>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(item => (
                  <NavItem
                    key={item.to}
                    to={item.to}
                    icon={item.icon}
                    label={t(item.labelKey)}
                    collapsed={collapsed && !mobile}
                    onClick={mobile ? () => setMobileOpen(false) : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── BOTTOM: Change password / Language / Bell / Logout ── */}
      <div className="border-t border-zinc-800/80 shrink-0 px-2 py-2 space-y-0.5">
        {(!collapsed || mobile) && (
          <button
            onClick={() => { setShowChangePwd(true); if (mobile) setMobileOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
          >
            <IconKey size={16} className="shrink-0" />
            <span className="truncate">{t('layout.change_password')}</span>
          </button>
        )}
        <div className={`flex items-center gap-1 px-1 ${collapsed && !mobile ? 'flex-col' : ''}`}>
          {(!collapsed || mobile) && <div className="flex-1"><LanguageSwitcher /></div>}
          <NotificationBell role={user.role} />
          {collapsed && !mobile ? (
            <button
              onClick={doLogout}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title={t('layout.logout')}
            >
              <IconLogout size={16} />
            </button>
          ) : (
            <button
              onClick={doLogout}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-xs"
            >
              <IconLogout size={14} />
              <span>{t('layout.logout')}</span>
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-zinc-50 overflow-hidden" style={{ fontFamily: "'DM Sans',sans-serif" }}>

      {/* Change Password Modal — rendered at top level */}
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}

      {/* Subscription expiry banner */}
      {user.subscriptionStatus === 'expired' && (
        <div className="bg-red-600 text-white text-xs px-4 py-2 flex items-center justify-between shrink-0 z-40">
          <span className="truncate">⚠ Plan wygasł — funkcje są zablokowane. Odnów subskrypcję.</span>
          <a href="/subscription" className="ml-2 shrink-0 underline hover:no-underline whitespace-nowrap">Odnów</a>
        </div>
      )}
      {user.subscriptionStatus === 'expiring_soon' && (
        <div className="bg-amber-500 text-white text-xs px-4 py-2 flex items-center justify-between shrink-0 z-40">
          <span className="truncate">⏰ Plan wygasa wkrótce — sprawdź szczegóły subskrypcji.</span>
          <a href="/subscription" className="ml-2 shrink-0 underline hover:no-underline whitespace-nowrap">Szczegóły</a>
        </div>
      )}

      {/* Impersonation banner */}
      {isImpersonated && (
        <div className="bg-amber-500 text-white text-xs px-4 py-2 flex items-center justify-between shrink-0 z-40">
          <span className="truncate">👁 {t('layout.impersonation_banner')}</span>
          <button
            onClick={() => { localStorage.removeItem('app_impersonated'); doLogout(); }}
            className="ml-2 shrink-0 underline hover:no-underline"
          >
            {t('layout.impersonation_end')}
          </button>
        </div>
      )}

      {/* Mobile topbar — pt-safe handles PWA status bar on notched devices */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 pt-safe bg-zinc-900 border-b border-zinc-800 shrink-0 z-30"
           style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-zinc-400 hover:text-zinc-100 p-2 rounded-lg hover:bg-zinc-800 transition-colors min-h-touch min-w-touch flex items-center justify-center"
          aria-label={t('layout.open_menu')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <rect x="2" y="4" width="16" height="2" rx="1"/>
            <rect x="2" y="9" width="16" height="2" rx="1"/>
            <rect x="2" y="14" width="16" height="2" rx="1"/>
          </svg>
        </button>
        <span className="text-[#B53578] font-black text-lg tracking-tight">R</span>
        <span className="text-white font-bold text-sm tracking-widest">RESERTI</span>
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell role={user.role} />
        </div>
      </div>

      {/* Mobile sidebar overlay — pl-safe handles landscape notch */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 flex flex-col bg-zinc-900 shadow-2xl"
                 style={{ width: 'calc(18rem + env(safe-area-inset-left))', paddingLeft: 'env(safe-area-inset-left)' }}>
            <SidebarContent mobile />
          </aside>
        </>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className={`hidden md:flex flex-col bg-zinc-900 transition-all duration-200 shrink-0 ${collapsed ? 'w-14' : 'w-60'} border-r border-zinc-800`}>
          <SidebarContent />
        </aside>

        {/* Main content — pb-nav clears bottom nav + device home indicator */}
        <main className="flex-1 overflow-y-auto bg-zinc-50 p-4 sm:p-6 pb-nav md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav userRole={user.role} enabledModules={enabledModules} />
    </div>
  );
}

export default AppLayout;

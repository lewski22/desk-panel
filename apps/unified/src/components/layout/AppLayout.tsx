/**
 * AppLayout — v0.17.0
 * Sidebar z grupami nawigacyjnymi + zmiana hasła w dole sidebara
 */
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';
import { appApi } from '../../api/client';
import { BottomNav } from './BottomNav';
import { NotificationBell } from './NotificationBell';
import { ChangePasswordModal } from './ChangePasswordModal';

interface User {
  id: string;
  email: string;
  role: string;
  organizationId?: string;
  firstName?: string;
  lastName?: string;
  enabledModules?: string[];
}
interface Props { user: User; onLogout: () => void; children: React.ReactNode; }

type AppModule = 'DESKS' | 'ROOMS' | 'PARKING' | 'FLOOR_PLAN' | 'WEEKLY_VIEW';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', OFFICE_ADMIN: 'Office Admin',
  STAFF: 'Staff', END_USER: 'Użytkownik', OWNER: 'Operator',
};

interface NavGroup {
  key:   string;
  roles: string[];
  items: { to: string; icon: string; labelKey: string; roles: string[]; module?: AppModule }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key:   'layout.group.workspace',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'],
    items: [
      { to: '/map',             icon: '⬡',  labelKey: 'layout.nav.map',            roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'] },
      { to: '/weekly',          icon: '📅', labelKey: 'layout.nav.weekly',          roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'] },
      { to: '/my-reservations', icon: '📋', labelKey: 'layout.nav.my_reservations', roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'] },
      { to: '/reservations',    icon: '📂', labelKey: 'layout.nav.reservations',    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
    ],
  },
  {
    key:   'layout.group.management',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'],
    items: [
      { to: '/desks',        icon: '🪑', labelKey: 'layout.nav.desks',        roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/users',        icon: '👥', labelKey: 'layout.nav.users',        roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/devices',      icon: '🔌', labelKey: 'layout.nav.devices',      roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
      { to: '/provisioning', icon: '📡', labelKey: 'layout.nav.provisioning', roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/resources',    icon: '🏛',  labelKey: 'layout.nav.resources',   roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/visitors',     icon: '👤', labelKey: 'layout.nav.visitors',     roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
    ],
  },
  {
    key:   'layout.group.analytics',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'],
    items: [
      { to: '/dashboard', icon: '📊', labelKey: 'layout.nav.dashboard', roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
      { to: '/reports',   icon: '📈', labelKey: 'layout.nav.reports',   roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
    ],
  },
  {
    key:   'layout.group.config',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN'],
    items: [
      { to: '/organizations',      icon: '🏢', labelKey: 'layout.nav.organizations',    roles: ['SUPER_ADMIN'] },
      { to: '/integrations',       icon: '🔗', labelKey: 'layout.nav.integrations',     roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/notifications',      icon: '🔔', labelKey: 'layout.nav.notifications',    roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/subscription',       icon: '💳', labelKey: 'layout.nav.subscription',     roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    key:   'layout.group.operator',
    roles: ['OWNER'],
    items: [
      { to: '/owner',              icon: '⚙️', labelKey: 'layout.nav.owner',             roles: ['OWNER'] },
      { to: '/notification-rules', icon: '🔔', labelKey: 'layout.nav.notification_rules', roles: ['OWNER'] },
    ],
  },
];

// ── NavItem ──────────────────────────────────────────────────
function NavItem({ to, icon, label, collapsed, onClick }: {
  to: string; icon: string; label: string; collapsed?: boolean; onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 group ${
          isActive
            ? 'bg-[#B53578]/15 text-[#e06aaa] font-medium'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
        }`
      }
      title={collapsed ? label : undefined}
    >
      <span className="text-base shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

// ── Main component ───────────────────────────────────────────
export function AppLayout({ user, onLogout, children }: Props) {
  const { t }       = useTranslation();
  const navigate    = useNavigate();
  const location    = useLocation();
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

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
      {/* Logo */}
      <div className={`flex items-center gap-2 px-4 py-4 border-b border-zinc-800 shrink-0 ${mobile ? '' : ''}`}>
        {(!collapsed || mobile) && (
          <>
            <span className="text-[#B53578] font-black text-xl">R</span>
            <div className="min-w-0">
              <div className="text-white font-bold text-sm tracking-widest">RESERTI</div>
              <div className="text-zinc-500 text-[10px] truncate max-w-[140px]">
                {user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user.email}
              </div>
              <div className="text-[#B53578] text-[9px] font-semibold uppercase tracking-wider mt-0.5">
                {ROLE_LABEL[user.role] ?? user.role}
              </div>
            </div>
          </>
        )}
        {collapsed && !mobile && (
          <span className="text-[#B53578] font-black text-xl mx-auto">R</span>
        )}
        {mobile && (
          <button onClick={() => setMobileOpen(false)}
            className="ml-auto text-zinc-500 hover:text-white p-1 rounded-lg">
            ✕
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-700">
        {NAV_GROUPS.map(group => {
          if (!group.roles.includes(user.role)) return null;
          const visibleItems = group.items.filter(item => {
            if (!item.roles.includes(user.role)) return false;
            if (item.module && !hasModule(item.module)) return false;
            return true;
          });
          if (!visibleItems.length) return null;

          return (
            <React.Fragment key={group.key}>
              {(!collapsed || mobile) && (
                <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                  {t(group.key)}
                </div>
              )}
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
            </React.Fragment>
          );
        })}
      </nav>

      {/* ── BOTTOM: Zmień hasło / Language / Logout / Collapse ── */}

      {/* Zmień hasło — nad language+logout */}
      {(!collapsed || mobile) && (
        <div className="px-3 pt-2 pb-1 border-t border-zinc-800">
          <button
            onClick={() => { setShowChangePwd(true); if (mobile) setMobileOpen(false); }}
            className="w-full flex items-center gap-2 text-zinc-400 hover:text-zinc-100 text-xs py-2 px-2 rounded-xl hover:bg-zinc-800 transition-colors text-left"
          >
            <span>🔑</span>
            <span>{t('layout.change_password')}</span>
          </button>
        </div>
      )}

      <div className="px-3 py-2.5 border-t border-zinc-800 flex items-center justify-between gap-2">
        {(!collapsed || mobile) && <LanguageSwitcher />}
        <NotificationBell role={user.role} />
        {(!collapsed || mobile) && (
          <button
            onClick={doLogout}
            className={`text-zinc-500 hover:text-zinc-200 text-xs p-1.5 rounded-lg hover:bg-zinc-800 transition-colors ${!collapsed ? 'flex-1 text-left' : ''}`}
          >
            {t('layout.logout')}
          </button>
        )}
        {!mobile && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-zinc-600 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-xs"
            title={collapsed ? t('layout.expand') : t('layout.collapse')}
          >
            {collapsed ? '›' : '‹'}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-zinc-50 overflow-hidden" style={{ fontFamily: "'DM Sans',sans-serif" }}>

      {/* Change Password Modal — rendered at top level */}
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}

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

      {/* Mobile topbar */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0 z-30">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
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

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-zinc-900 shadow-2xl">
            <SidebarContent mobile />
          </aside>
        </>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className={`hidden md:flex flex-col bg-zinc-900 transition-all duration-200 shrink-0 ${collapsed ? 'w-14' : 'w-56'} border-r border-zinc-800`}>
          <SidebarContent />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-zinc-50">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav userRole={user.role} />
    </div>
  );
}

export default AppLayout;

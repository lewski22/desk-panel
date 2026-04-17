/**
 * AppLayout — Sprint A4
 * - Sidebar z grupami nawigacyjnymi (WORKSPACE / ZARZĄDZANIE / ANALITYKA / KONFIGURACJA)
 * - Org name w headerze sidebara
 * - Mobile sidebar drawer
 */
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { NotificationBell } from './NotificationBell';

interface User { id: string; email: string; role: string; organizationId?: string; firstName?: string; lastName?: string; }
interface Props { user: User; onLogout: () => void; children: React.ReactNode; }

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', OFFICE_ADMIN: 'Office Admin',
  STAFF: 'Staff', END_USER: 'Użytkownik', OWNER: 'Operator',
};

// ── Grupy nawigacyjne — Sprint A4 ───────────────────────────
interface NavGroup {
  key:   string;  // klucz i18n
  roles: string[];
  items: { to: string; icon: string; labelKey: string; roles: string[]; module?: AppModule }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key:   'layout.group.workspace',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'],
    items: [
      { to: '/map',             icon: '⬡',  labelKey: 'layout.nav.map',            roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'], module: 'DESKS' },
      { to: '/weekly',          icon: '📅', labelKey: 'layout.nav.weekly',          roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'], module: 'WEEKLY_VIEW' },
      { to: '/my-reservations', icon: '📅', labelKey: 'layout.nav.my_reservations', roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'] },
      { to: '/reservations',    icon: '📋', labelKey: 'layout.nav.reservations',    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
    ],
  },
  {
    key:   'layout.group.management',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'],
    items: [
      { to: '/desks',        icon: '🪑', labelKey: 'layout.nav.desks',        roles: ['SUPER_ADMIN','OFFICE_ADMIN'], module: 'DESKS' },
      { to: '/users',        icon: '👥', labelKey: 'layout.nav.users',        roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/devices',      icon: '🔌', labelKey: 'layout.nav.devices',      roles: ['STAFF'] },
      { to: '/provisioning', icon: '📡', labelKey: 'layout.nav.provisioning', roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/resources',   icon: '🏛',  labelKey: 'layout.nav.resources',   roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/visitors',   icon: '👤', labelKey: 'layout.nav.visitors',   roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
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
    roles: ['SUPER_ADMIN'],
    items: [
      { to: '/organizations',    icon: '🏢', labelKey: 'layout.nav.organizations',    roles: ['SUPER_ADMIN'] },
      { to: '/notifications',    icon: '🔔', labelKey: 'layout.nav.notifications',    roles: ['SUPER_ADMIN'] },
      { to: '/subscription',   icon: '💳', labelKey: 'layout.nav.subscription',   roles: ['SUPER_ADMIN'] },
    ],
  },
  // Owner panel
  {
    key:   'layout.group.operator',
    roles: ['OWNER'],
    items: [
      { to: '/owner',               icon: '⚙️', labelKey: 'layout.nav.owner',               roles: ['OWNER'] },
      { to: '/notification-rules',  icon: '🔔', labelKey: 'layout.nav.notification_rules',  roles: ['OWNER'] },
      { to: '/change-password',     icon: '🔒', labelKey: 'layout.nav.change_password',     roles: ['OWNER'] },
    ],
  },
];

// ── NavItem ──────────────────────────────────────────────────
function NavItem({ to, icon, label, collapsed, onClick }: {
  to: string; icon: string; label: string; collapsed?: boolean; onClick?: () => void;
}) {
  return (
    <NavLink to={to} onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all
        ${isActive ? 'bg-[#B53578]/20 text-[#e06aaa] font-medium' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}
        ${collapsed ? 'justify-center' : ''}`
      }
      title={collapsed ? label : undefined}
    >
      <span className="shrink-0 text-base leading-none">{icon}</span>
      {!collapsed && <span className="leading-tight">{label}</span>}
    </NavLink>
  );
}

// ── GroupSeparator ────────────────────────────────────────────
function GroupSep({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="border-t border-zinc-800 my-2 mx-2" />;
  return (
    <p className="text-[9px] uppercase tracking-widest text-zinc-700 px-2.5 pt-4 pb-1 font-semibold select-none">
      {label}
    </p>
  );
}

// ── Main Layout ───────────────────────────────────────────────
export function AppLayout({ user, onLogout, children }: Props) {
  const { t }            = useTranslation();
  const { isEnabled }    = useOrgModules();
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [subStatus,   setSubStatus]   = useState<any>(null);
  const [bannerDismissed, setBannerDismissed] = useState(
    localStorage.getItem('sub_banner_dismissed_at') === new Date().toDateString()
  );
  const navigate   = useNavigate();
  const location   = useLocation();
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isImpersonated = localStorage.getItem('app_impersonated') === 'true';

  // Filter groups and items for current user role
  const visibleGroups = NAV_GROUPS
    .filter(g => g.roles.includes(user.role))
    .map(g => ({
      ...g,
      items: g.items.filter(i =>
        i.roles.includes(user.role) &&
        (!i.module || isEnabled(i.module))  // ukryj jeśli moduł wyłączony
      ),
    }))
    .filter(g => g.items.length > 0);

  // Reset session timer
  const resetTimer = () => {
    if (timerRef.current)  clearTimeout(timerRef.current);
    if (warnRef.current)   clearTimeout(warnRef.current);
    setShowWarning(false);
    const SESSION_MS = 15 * 60 * 1000;
    const WARN_MS    = SESSION_MS - 60_000;
    warnRef.current  = setTimeout(() => setShowWarning(true), WARN_MS);
    timerRef.current = setTimeout(() => { onLogout(); navigate('/login'); }, SESSION_MS);
  };

  // Pobierz status subskrypcji dla ExpiryBanner — co 5 min
  useEffect(() => {
    if (!['SUPER_ADMIN','OFFICE_ADMIN'].includes(user.role)) return;
    const load = () => appApi.subscription.getStatus().then(setSubStatus).catch(() => {});
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [user.role]);

  useEffect(() => {
    resetTimer();
    const events = ['click','keydown','mousemove','touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnRef.current)  clearTimeout(warnRef.current);
    };
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const doLogout = () => { onLogout(); navigate('/login'); };

  // ── Sidebar content (shared desktop/mobile) ─────────────────
  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo + org context */}
      <div className={`flex items-center gap-2.5 border-b border-zinc-800 ${collapsed && !mobile ? 'justify-center py-5' : 'px-4 py-4'}`}>
        <span className="text-[#B53578] font-black text-xl tracking-tight select-none shrink-0">R</span>
        {(!collapsed || mobile) && (
          <div className="min-w-0">
            <p className="text-sm font-bold leading-none text-white">RESERTI</p>
            <p className="text-[10px] text-zinc-500 leading-none mt-0.5 truncate">
              {ROLE_LABEL[user.role] ?? user.role}
            </p>
          </div>
        )}
        {mobile && (
          <button onClick={() => setMobileOpen(false)}
            className="ml-auto text-zinc-500 hover:text-zinc-200 p-1 rounded transition-colors shrink-0"
            aria-label={t('layout.close_menu')}>✕</button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 py-2 flex flex-col px-2 overflow-y-auto">
        {visibleGroups.map((group, gi) => (
          <React.Fragment key={group.key}>
            {gi > 0 && <GroupSep label={t(group.key, group.key)} collapsed={collapsed && !mobile} />}
            {gi === 0 && !collapsed && (
              <GroupSep label={t(group.key, group.key)} collapsed={false} />
            )}
            {group.items.map(item => (
              <NavItem key={item.to} to={item.to} icon={item.icon}
                label={t(item.labelKey, item.to)}
                collapsed={collapsed && !mobile}
                onClick={mobile ? () => setMobileOpen(false) : undefined}
              />
            ))}
          </React.Fragment>
        ))}
      </nav>

      {/* Bottom: Language + Bell + Collapse */}
      <div className="px-3 py-2.5 border-t border-zinc-800 flex items-center justify-between gap-2">
        {(!collapsed || mobile) && <LanguageSwitcher />}
        <NotificationBell role={user.role} />
        {(!collapsed || mobile) && (
          <button onClick={doLogout}
            className={`text-zinc-500 hover:text-zinc-200 text-xs p-1.5 rounded-lg hover:bg-zinc-800 transition-colors ${!collapsed ? 'flex-1 text-left' : ''}`}>
            {t('layout.logout')}
          </button>
        )}
        {!mobile && (
          <button onClick={() => setCollapsed(c => !c)}
            className="text-zinc-600 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-xs"
            title={collapsed ? t('layout.expand') : t('layout.collapse')}>
            {collapsed ? '›' : '‹'}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-zinc-50 overflow-hidden" style={{ fontFamily: "'DM Sans',sans-serif" }}>

      {/* Impersonation banner */}
      {isImpersonated && (
        <div className="bg-amber-500 text-white text-xs px-4 py-2 flex items-center justify-between shrink-0 z-40">
          <span className="truncate">👁 {t('layout.impersonation_banner')}</span>
          <button onClick={() => { localStorage.removeItem('app_impersonated'); doLogout(); }}
            className="ml-2 shrink-0 underline hover:no-underline">{t('layout.impersonation_end')}</button>
        </div>
      )}

      {/* Mobile topbar */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0 z-30">
        <button onClick={() => setMobileOpen(true)}
          className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label={t('layout.open_menu')}>
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
        <aside className={`hidden md:flex flex-col bg-zinc-900 transition-all duration-200 shrink-0 ${collapsed ? 'w-14' : 'w-56'}`}>
          <SidebarContent />
        </aside>

        {/* Main content — na mobile ma padding-bottom dla BottomNav */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-6">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom Nav — tylko mobile (md:hidden) */}
      <div className="md:hidden">
        <BottomNav user={user} onLogout={doLogout} />
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav userRole={user.role} />

      {/* Session warning */}
      {showWarning && (
        <div className="fixed bottom-4 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-sm z-50
          bg-amber-50 border border-amber-300 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3">
          <span className="text-amber-500 text-lg shrink-0">⏰</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">{t('layout.session_warning_title')}</p>
            <p className="text-xs text-amber-600 mt-0.5">{t('layout.session_warning_body')}</p>
          </div>
          <button onClick={resetTimer}
            className="text-xs text-amber-700 font-semibold underline shrink-0">{t('layout.session_extend')}</button>
        </div>
      )}
    </div>
  );
}

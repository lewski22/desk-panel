/**
 * AppLayout — v0.19.0
 * Sidebar z grupami nawigacyjnymi + collapsible Ustawienia + GlobalSearch (Cmd+K)
 */
import React, { useEffect, useState, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { GlobalSearch } from './GlobalSearch';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';
import { LogoMark } from '../logo/LogoMark';
import { appApi } from '../../api/client';
import { BottomNav } from './BottomNav';
import { Toaster }   from '../ui/Toast';
import { NotificationBell } from './NotificationBell';
import { ChangePasswordModal } from './ChangePasswordModal';
import { NfcCardModal } from '../users/NfcCardModal';
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
  cardUid?: string | null;
  enabledModules?: string[];
  subscriptionStatus?: string | null;
}
interface Props { user: User; onLogout: () => void; children: React.ReactNode; }

type AppModule = 'DESKS' | 'ROOMS' | 'PARKING' | 'FLOOR_PLAN' | 'WEEKLY_VIEW' | 'EQUIPMENT';


type NavIcon = React.FC<{ className?: string; size?: number }>;

interface NavGroup {
  key:   string;
  roles: string[];
  items: { to: string; icon: NavIcon; labelKey: string; roles: string[]; module?: AppModule }[];
}

const SETTINGS_PATHS = ['/organizations', '/integrations', '/notifications', '/subscription'];

const NAV_GROUPS: NavGroup[] = [
  {
    key:   'layout.group.workspace',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'],
    items: [
      { to: '/map',             icon: IconFloorPlan, labelKey: 'layout.nav.map',            roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'], module: 'DESKS' },
      { to: '/weekly',          icon: IconCalendar,  labelKey: 'layout.nav.weekly',          roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'], module: 'WEEKLY_VIEW' },
      { to: '/my-reservations', icon: IconClipboard, labelKey: 'layout.nav.my_reservations', roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'], module: 'DESKS' },
      { to: '/reservations',    icon: IconFolder,    labelKey: 'layout.nav.reservations',    roles: ['SUPER_ADMIN','OFFICE_ADMIN'], module: 'DESKS' },
    ],
  },
  {
    key:   'layout.group.management',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'],
    items: [
      { to: '/desks',        icon: IconDesk,         labelKey: 'layout.nav.desks',        roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/users',        icon: IconUsers,        labelKey: 'layout.nav.users',        roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/devices',      icon: IconBeacon,       labelKey: 'layout.nav.devices',      roles: ['STAFF'] },
      { to: '/provisioning', icon: IconProvisioning, labelKey: 'layout.nav.provisioning', roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
      { to: '/resources',    icon: IconRoom,         labelKey: 'layout.nav.resources',    roles: ['SUPER_ADMIN','OFFICE_ADMIN'], module: 'ROOMS' },
      { to: '/visitors',     icon: IconVisitor,      labelKey: 'layout.nav.visitors',     roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
    ],
  },
  {
    key:   'layout.group.analytics',
    roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'],
    items: [
      { to: '/dashboard', icon: IconBarChart, labelKey: 'layout.nav.dashboard', roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
      { to: '/reports',   icon: IconPieChart, labelKey: 'layout.nav.reports',   roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
    ],
  },
  {
    key:   'layout.group.settings',
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
        `relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 min-h-[36px] ${
          isActive
            ? 'text-white'
            : 'hover:bg-black/[0.04]'
        }`
      }
      style={({ isActive }) => ({
        background: isActive ? '#9C2264' : undefined,
        color:      isActive ? '#fff' : '#4A3F6B',
      })}
      title={collapsed ? label : undefined}
    >
      {({ isActive }) => (
        <>
          {/* Left-edge active indicator */}
          {isActive && (
            <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
          )}
          <Icon
            size={16}
            className="shrink-0 transition-colors"
          />
          {!collapsed && <span className="truncate leading-tight">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

// ── Main component ───────────────────────────────────────────
export function AppLayout({ user, onLogout, children }: Props) {
  const { t }    = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef  = useRef<HTMLElement>(null);
  const mustChange        = !!(user as any).mustChangePassword;
  const mustChangeOnForm  = mustChange && location.pathname === '/change-password';
  const [collapsed,   setCollapsed]   = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) return saved === 'true';
    return typeof window !== 'undefined' && window.innerWidth < 1280;
  });
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [showNfcCard,   setShowNfcCard]   = useState(false);

  const toggleCollapsed = () => setCollapsed(c => {
    const next = !c;
    localStorage.setItem('sidebar_collapsed', String(next));
    return next;
  });

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  const isImpersonated = localStorage.getItem('app_impersonated') === 'true';

  const enabledModules: string[] = (user as any).enabledModules ?? [];
  const hasModule = (m: AppModule) =>
    enabledModules.length === 0 || enabledModules.includes(m);

  const doLogout = () => {
    appApi.auth.logout();
    onLogout();
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => {
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
      () => SETTINGS_PATHS.some(p => location.pathname.startsWith(p))
        ? new Set()
        : new Set(['layout.group.settings']),
    );

    const toggleGroup = (key: string) =>
      setCollapsedGroups(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
      });

    return (
    <>
      {/* Logo + user header */}
      <div className="flex items-center gap-2.5 px-3 py-3 shrink-0" style={{ borderBottom: '1px solid #DDD6F5' }}>
        {/* Avatar / Logo */}
        {collapsed && !mobile ? (
          <LogoMark size={32} className="shrink-0" />
        ) : (
          <>
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center shrink-0 text-white text-xs font-bold select-none">
              {user.firstName
                ? `${user.firstName[0]}${user.lastName?.[0] ?? ''}`.toUpperCase()
                : user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-zinc-800 text-xs font-semibold truncate">
                {user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user.email}
              </div>
              <div className="text-brand text-[10px] font-semibold uppercase tracking-wider mt-0.5">
                {t(`roles.${user.role}`, user.role)}
              </div>
            </div>
          </>
        )}
        {/* Search button */}
        {(!collapsed || mobile) && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('reserti:search'))}
            className="ml-auto p-1.5 rounded-lg transition-colors shrink-0"
            style={{ color: '#9B93A8' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#4A3F6B'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9B93A8'; (e.currentTarget as HTMLElement).style.background = ''; }}
            title="Szukaj (Ctrl+K)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        {mobile && (
          <button onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
            style={{ color: '#9B93A8' }}
            aria-label="Zamknij menu">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.29 3.29a1 1 0 0 1 1.42 0L8 6.59l3.29-3.3a1 1 0 1 1 1.42 1.42L9.41 8l3.3 3.29a1 1 0 0 1-1.42 1.42L8 9.41l-3.29 3.3a1 1 0 0 1-1.42-1.42L6.59 8 3.3 4.71a1 1 0 0 1 0-1.42z"/>
            </svg>
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

          const isSettings  = group.key === 'layout.group.settings';
          const isCollapsed = collapsedGroups.has(group.key);

          return (
            <div key={group.key} className={gi > 0 ? 'mt-3 pt-3' : 'mt-1'} style={gi > 0 ? { borderTop: '1px solid #DDD6F5' } : {}}>
              {(!collapsed || mobile) && (
                <button
                  onClick={isSettings ? () => toggleGroup(group.key) : undefined}
                  className={`w-full flex items-center justify-between px-3 pt-1 pb-1.5 ${isSettings ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: '#9B93A8' }}>
                    {t(group.key)}
                  </span>
                  {isSettings && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                      style={{ color: '#9B93A8', transform: isCollapsed ? undefined : 'rotate(180deg)', transition: 'transform 0.15s' }}>
                      <path d="M5 7L1 3h8L5 7z"/>
                    </svg>
                  )}
                </button>
              )}
              {(collapsed && !mobile) && gi > 0 && (
                <div className="mx-2 mb-2 h-px" style={{ background: '#DDD6F5' }} />
              )}
              {(!isSettings || !isCollapsed) && (
                <div className="space-y-px">
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
              )}
            </div>
          );
        })}
      </nav>

      {/* ── BOTTOM: Change password / Language / Bell / Logout ── */}
      <div className="shrink-0 px-2 py-2 space-y-px" style={{ borderTop: '1px solid #DDD6F5' }}>
        {/* Change password — ukryty gdy sidebar zwinięty (dostępny przez ikonę) */}
        <button
          onClick={() => { setShowChangePwd(true); if (mobile) setMobileOpen(false); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-black/[0.04]"
          style={{ color: '#4A3F6B' }}
          title={collapsed && !mobile ? t('layout.change_password') : undefined}
        >
          <IconKey size={16} className="shrink-0" />
          {(!collapsed || mobile) && <span className="truncate leading-none">{t('layout.change_password')}</span>}
        </button>

        {/* NFC card — tylko role uprzywilejowane (SA, OA, STAFF) */}
        {(user.role === 'SUPER_ADMIN' || user.role === 'OFFICE_ADMIN' || user.role === 'STAFF' || user.role === 'OWNER') && (
          <button
            onClick={() => { setShowNfcCard(true); if (mobile) setMobileOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-black/[0.04]"
            style={{ color: '#4A3F6B' }}
            title={collapsed && !mobile ? t('layout.nfc_card') : undefined}
          >
            <IconCard size={16} className="shrink-0" />
            {(!collapsed || mobile) && <span className="truncate leading-none">{t('layout.nfc_card')}</span>}
          </button>
        )}

        {/* Language + Bell + Logout row */}
        <div className={`flex items-center gap-1 px-1 pt-0.5 ${collapsed && !mobile ? 'flex-col' : ''}`}>
          {(!collapsed || mobile) && <div className="flex-1 min-w-0"><LanguageSwitcher /></div>}
          <NotificationBell role={user.role} />
          <button
            onClick={doLogout}
            className={`flex items-center gap-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors ${
              collapsed && !mobile
                ? 'w-8 h-8 justify-center'
                : 'px-2 py-1.5 text-xs'
            }`}
            title={t('layout.logout')}
          >
            <IconLogout size={collapsed && !mobile ? 16 : 14} />
            {(!collapsed || mobile) && <span>{t('layout.logout')}</span>}
          </button>
        </div>
      </div>
    </>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 overflow-hidden" style={{ fontFamily: "'DM Sans',sans-serif" }}>

      {/* Global Search — mounts always, listens for Cmd+K */}
      <GlobalSearch />

      {/* Change Password Modal — rendered at top level */}
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}

      {/* NFC Card Modal — self-assign dla wszystkich ról */}
      {showNfcCard && <NfcCardModal user={user} onClose={() => setShowNfcCard(false)} />}

      {/* Must-change-password banner */}
      {mustChange && (
        <div className="bg-rose-600 text-white text-xs px-4 py-2.5 flex items-center justify-between shrink-0 z-40 gap-3">
          <span className="flex items-center gap-2 truncate">
            <span className="text-base shrink-0">🔑</span>
            {t('org.password_policy.must_change_banner')}
          </span>
          <button
            onClick={() => navigate('/change-password')}
            className="shrink-0 font-semibold underline hover:no-underline whitespace-nowrap"
          >
            {t('org.password_policy.must_change_action')}
          </button>
        </div>
      )}

      {/* Subscription expiry banner */}
      {user.subscriptionStatus === 'expired' && (
        <div className="bg-red-600 text-white text-xs px-4 py-2 flex items-center justify-between shrink-0 z-40">
          <span className="truncate">⚠ {t('layout.subscription_expired_msg')}</span>
          <a href="/subscription" className="ml-2 shrink-0 underline hover:no-underline whitespace-nowrap">{t('layout.subscription_renew')}</a>
        </div>
      )}
      {user.subscriptionStatus === 'expiring_soon' && (
        <div className="bg-amber-500 text-white text-xs px-4 py-2 flex items-center justify-between shrink-0 z-40">
          <span className="truncate">⏰ {t('layout.subscription_expiring_msg')}</span>
          <a href="/subscription" className="ml-2 shrink-0 underline hover:no-underline whitespace-nowrap">{t('layout.subscription_details')}</a>
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
      <div className="md:hidden flex items-center gap-3 px-4 py-3 shrink-0 z-30 bg-white"
           style={{ borderBottom: '1px solid #DDD6F5', paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg transition-colors min-h-touch min-w-touch flex items-center justify-center"
          style={{ color: '#6B5F7A' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1A0A2E'; (e.currentTarget as HTMLElement).style.background = '#F4F0FB'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6B5F7A'; (e.currentTarget as HTMLElement).style.background = ''; }}
          aria-label={t('layout.open_menu')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <rect x="2" y="4" width="16" height="2" rx="1"/>
            <rect x="2" y="9" width="16" height="2" rx="1"/>
            <rect x="2" y="14" width="16" height="2" rx="1"/>
          </svg>
        </button>
        <LogoMark size={28} />
        <span className="font-bold text-sm tracking-widest" style={{ color: '#1A0A2E' }}>RESERTI</span>
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell role={user.role} light />
        </div>
      </div>

      {/* Mobile sidebar overlay — pl-safe handles landscape notch */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 flex flex-col shadow-2xl"
                 style={{ width: 'calc(18rem + env(safe-area-inset-left))', paddingLeft: 'env(safe-area-inset-left)', background: '#F4F0FB', borderRight: '1px solid #DDD6F5' }}>
            <SidebarContent mobile />
          </aside>
        </>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside
          className={`hidden md:flex flex-col transition-all duration-200 shrink-0 relative ${collapsed ? 'w-14' : 'w-60'}`}
          style={{ background: '#F4F0FB', borderRight: '1px solid #DDD6F5' }}
        >
          <SidebarContent />
          <button
            onClick={toggleCollapsed}
            className="absolute -right-3 top-[52px] z-10 w-6 h-6 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:border-zinc-300 transition-colors"
            title={collapsed ? t('layout.expand') : t('layout.collapse')}
          >
            <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor">
              {collapsed
                ? <path d="M7 4l6 6-6 6V4z" />
                : <path d="M13 4l-6 6 6 6V4z" />}
            </svg>
          </button>
          {/* Overlay blokujący sidebar gdy wymagana zmiana hasła */}
          {mustChange && (
            <div className="absolute inset-0 z-20 pointer-events-auto select-none"
                 style={{ backdropFilter: 'blur(4px)', background: 'rgba(244,240,251,0.7)' }} />
          )}
        </aside>

        {/* Main content — pb-nav clears bottom nav + device home indicator */}
        <main
          ref={mainRef}
          className={`flex-1 overflow-y-auto bg-zinc-50 p-4 sm:p-6 pb-nav md:pb-6 ${mustChange && !mustChangeOnForm ? 'pointer-events-none select-none' : ''}`}
          style={mustChange && !mustChangeOnForm ? { filter: 'blur(4px)' } : undefined}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div className={mustChange && !mustChangeOnForm ? 'pointer-events-none select-none' : ''}
           style={mustChange && !mustChangeOnForm ? { filter: 'blur(4px)' } : undefined}>
        <BottomNav userRole={user.role} enabledModules={enabledModules} />
      </div>

      {/* Global toast notifications */}
      <Toaster />
    </div>
  );
}

export default AppLayout;

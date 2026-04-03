import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom';

const SESSION_TIMEOUT_MS   = 5 * 60 * 1000;
const SESSION_WARNING_MS   = 60 * 1000;
const ACTIVITY_DEBOUNCE_MS = 500;

interface Props {
  user: { firstName?: string; lastName?: string; email: string; role: string };
  onLogout: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { to: '/dashboard',        icon: '⬡', label: 'Dashboard',           roles: ['SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF'] },
  { to: '/desks',            icon: '🪑', label: 'Biurka',              roles: ['SUPER_ADMIN', 'OFFICE_ADMIN'] },
  { to: '/reservations',     icon: '📋', label: 'Wszystkie rezerwacje', roles: ['SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF'] },
  { to: '/users',            icon: '👥', label: 'Użytkownicy',         roles: ['SUPER_ADMIN', 'OFFICE_ADMIN'] },
  { to: '/provisioning',     icon: '📡', label: 'Provisioning',        roles: ['SUPER_ADMIN', 'OFFICE_ADMIN'] },
  { to: '/reports',          icon: '📊', label: 'Raporty',             roles: ['SUPER_ADMIN', 'OFFICE_ADMIN'] },
  { to: '/organizations',    icon: '🏢', label: 'Biura',               roles: ['SUPER_ADMIN'] },
  { to: '/map',              icon: '⬡', label: 'Mapa biurek',         roles: ['SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF', 'END_USER'] },
  { to: '/my-reservations',  icon: '📅', label: 'Moje rezerwacje',     roles: ['SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF', 'END_USER'] },
  { to: '/devices',          icon: '🔌', label: 'Urządzenia',          roles: ['STAFF'] },
];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', OFFICE_ADMIN: 'Office Admin',
  STAFF: 'Staff', END_USER: 'Użytkownik',
};

const STAFF_SECTION = ['/map', '/my-reservations', '/devices'];

// ── NavLink helper (shared between sidebar variants) ──────────
function NavItem({ to, icon, label, collapsed, onClick }: {
  to: string; icon: string; label: string; collapsed?: boolean; onClick?: () => void;
}) {
  return (
    <NavLink key={to} to={to} onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm transition-all
        ${isActive
          ? 'bg-[#B53578]/20 text-[#e06aaa] font-medium'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}
        ${collapsed ? 'justify-center' : ''}`
      }
      title={collapsed ? label : undefined}
    >
      <span className="shrink-0 text-base">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

export function AppLayout({ user, onLogout, children }: Props) {
  // Desktop: collapsed sidebar | Mobile: open/closed overlay
  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [showWarning,  setShowWarning]  = useState(false);

  const navigate    = useNavigate();
  const location    = useLocation();
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible      = NAV_ITEMS.filter(n => n.roles.includes(user.role));
  const hasAdminSect = visible.some(n => !STAFF_SECTION.includes(n.to));
  const hasStaffSect = visible.some(n => STAFF_SECTION.includes(n.to));
  const adminItems   = visible.filter(n => !STAFF_SECTION.includes(n.to));
  const staffItems   = visible.filter(n => STAFF_SECTION.includes(n.to));

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Lock body scroll when mobile sidebar open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const doLogout = useCallback(() => {
    onLogout(); navigate('/login');
  }, [onLogout, navigate]);

  const resetTimer = useCallback(() => {
    setShowWarning(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warnRef.current)  clearTimeout(warnRef.current);
    warnRef.current  = setTimeout(() => setShowWarning(true), SESSION_TIMEOUT_MS - SESSION_WARNING_MS);
    timerRef.current = setTimeout(doLogout, SESSION_TIMEOUT_MS);
  }, [doLogout]);

  const handleActivity = useCallback(() => {
    if (debounceRef.current) return;
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      resetTimer();
    }, ACTIVITY_DEBOUNCE_MS);
  }, [resetTimer]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'mousemove', 'scroll'];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      if (timerRef.current)    clearTimeout(timerRef.current);
      if (warnRef.current)     clearTimeout(warnRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [handleActivity, resetTimer]);

  const isImpersonated = localStorage.getItem('app_impersonated') === 'true';

  // ── Shared sidebar content ───────────────────────────────────
  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-2.5 border-b border-zinc-800
        ${(collapsed && !mobile) ? 'justify-center py-5' : 'px-4 py-5'}`}>
        <span className="text-[#B53578] font-black text-xl tracking-tight select-none shrink-0">R</span>
        {(!collapsed || mobile) && (
          <div>
            <p className="text-sm font-bold leading-none text-white">RESERTI</p>
            <p className="text-[10px] text-zinc-500 leading-none mt-0.5">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
        )}
        {/* Close button — mobile only */}
        {mobile && (
          <button onClick={() => setMobileOpen(false)}
            className="ml-auto text-zinc-500 hover:text-zinc-200 p-1 rounded transition-colors"
            aria-label="Zamknij menu">
            ✕
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {hasAdminSect && adminItems.map(item => (
          <NavItem key={item.to} {...item}
            collapsed={collapsed && !mobile}
            onClick={mobile ? () => setMobileOpen(false) : undefined}
          />
        ))}

        {hasAdminSect && hasStaffSect && (
          <div className={`my-2 ${(collapsed && !mobile) ? 'mx-2' : 'mx-2'}`}>
            {(!collapsed || mobile) && (
              <p className="text-[10px] uppercase tracking-widest text-zinc-700 px-0.5 py-1 font-semibold">
                Pracownik
              </p>
            )}
            {collapsed && !mobile && <div className="border-t border-zinc-800" />}
          </div>
        )}

        {staffItems.map(item => (
          <NavItem key={item.to} {...item}
            collapsed={collapsed && !mobile}
            onClick={mobile ? () => setMobileOpen(false) : undefined}
          />
        ))}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-zinc-800 p-2 flex flex-col gap-1">
        {(!collapsed || mobile) && (
          <div className="px-2 py-1.5 rounded-lg">
            <p className="text-xs font-medium text-zinc-300 leading-tight truncate">
              {user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user.email}
            </p>
            <p className="text-[10px] text-zinc-600 leading-tight mt-0.5">{ROLE_LABEL[user.role] ?? user.role}</p>
            <Link to="/change-password"
              onClick={mobile ? () => setMobileOpen(false) : undefined}
              className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors mt-0.5 block">
              Zmień hasło
            </Link>
          </div>
        )}
        <div className={`flex gap-1 ${(collapsed && !mobile) ? 'flex-col items-center' : ''}`}>
          <button onClick={doLogout} title="Wyloguj"
            className={`text-xs text-zinc-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-zinc-800
              ${(collapsed && !mobile) ? '' : 'flex-1 text-left'}`}>
            {(collapsed && !mobile) ? '↩' : '↩ Wyloguj'}
          </button>
          {/* Collapse toggle — desktop only */}
          {!mobile && (
            <button onClick={() => setCollapsed(c => !c)}
              className="text-xs text-zinc-600 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              title={collapsed ? 'Rozwiń' : 'Zwiń'}>
              {collapsed ? '›' : '‹'}
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-zinc-50 overflow-hidden" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      {/* Baner impersonacji */}
      {isImpersonated && (
        <div className="bg-amber-500 text-white text-xs px-4 py-2 flex items-center justify-between shrink-0 z-40">
          <span className="truncate">👁 Sesja tymczasowa (30 min) — każda akcja jest logowana</span>
          <button onClick={() => { localStorage.removeItem('app_impersonated'); doLogout(); }}
            className="ml-2 shrink-0 underline hover:no-underline">
            Zakończ
          </button>
        </div>
      )}

      {/* ── Mobile topbar ─────────────────────────────────────── */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0 z-30">
        <button onClick={() => setMobileOpen(true)}
          className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="Otwórz menu">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <rect x="2" y="4"  width="16" height="2" rx="1"/>
            <rect x="2" y="9"  width="16" height="2" rx="1"/>
            <rect x="2" y="14" width="16" height="2" rx="1"/>
          </svg>
        </button>
        <span className="text-[#B53578] font-black text-lg tracking-tight">R</span>
        <span className="text-white font-bold text-sm tracking-widest">RESERTI</span>
      </div>

      {/* ── Mobile sidebar overlay ────────────────────────────── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-zinc-900 shadow-2xl">
            <SidebarContent mobile />
          </aside>
        </>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Session warning — responsive position */}
        {showWarning && (
          <div className="fixed inset-x-2 top-2 sm:inset-x-auto sm:top-4 sm:right-4 sm:left-auto z-50
            bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 shadow-lg
            flex items-center gap-3 sm:max-w-sm">
            <span className="text-amber-500 text-lg shrink-0">⏱</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">Sesja wygaśnie za minutę</p>
              <p className="text-xs text-amber-600 mt-0.5">Kliknij gdziekolwiek aby przedłużyć</p>
            </div>
            <button onClick={resetTimer}
              className="shrink-0 text-xs px-2 py-1 bg-amber-200 hover:bg-amber-300 rounded-lg text-amber-800 transition-colors">
              Przedłuż
            </button>
          </div>
        )}

        {/* ── Desktop sidebar ───────────────────────────────────── */}
        <aside className={`hidden md:flex flex-col bg-zinc-900 shrink-0 transition-all duration-300
          ${collapsed ? 'w-14' : 'w-56'}`}>
          <SidebarContent />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 py-4 md:px-6 md:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

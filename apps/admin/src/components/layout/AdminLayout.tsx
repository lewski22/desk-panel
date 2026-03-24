import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

interface Props {
  user: { firstName?: string; lastName?: string; email: string; role: string };
  onLogout: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { to: '/dashboard',     icon: '⬡', label: 'Dashboard',      roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
  { to: '/desks',         icon: '🪑', label: 'Biurka',         roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
  { to: '/reservations',  icon: '📅', label: 'Rezerwacje',      roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
  { to: '/users',         icon: '👥', label: 'Użytkownicy',     roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
  { to: '/provisioning',  icon: '📡', label: 'Provisioning',    roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
  { to: '/reports',       icon: '📊', label: 'Raporty',         roles: ['SUPER_ADMIN','OFFICE_ADMIN'] },
  { to: '/organizations', icon: '🏢', label: 'Organizacje',     roles: ['SUPER_ADMIN'] },
];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN:  'Super Admin',
  OFFICE_ADMIN: 'Office Admin',
  STAFF:        'Staff',
  END_USER:     'User',
};

export function AdminLayout({ user, onLogout, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const visible = NAV_ITEMS.filter(n => n.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className={`flex flex-col bg-zinc-900 shrink-0 transition-all duration-300 ${collapsed ? 'w-14' : 'w-56'}`}>
        {/* Logo */}
        <div className={`flex items-center gap-2.5 border-b border-zinc-800 ${collapsed ? 'justify-center py-5' : 'px-4 py-5'}`}>
          <span className="text-[#B53578] font-black text-xl tracking-tight select-none shrink-0">R</span>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold leading-none text-white">RESERTI</p>
              <p className="text-[10px] text-zinc-500 leading-none mt-0.5">Admin</p>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">
          {visible.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `
                flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all
                ${isActive
                  ? 'bg-[#B53578]/20 text-[#e06aaa] font-medium'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? label : undefined}
            >
              <span className="shrink-0">{icon}</span>
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}

          {/* Divider before super-admin section */}
          {user.role === 'SUPER_ADMIN' && !collapsed && (
            <p className="text-[10px] uppercase tracking-widest text-zinc-700 px-2.5 pt-4 pb-1 font-semibold">
              Platform
            </p>
          )}
        </nav>

        {/* User + collapse */}
        <div className="border-t border-zinc-800 p-2 flex flex-col gap-1">
          {!collapsed && (
            <div className="px-2 py-1.5 rounded-lg">
              <p className="text-xs font-medium text-zinc-300 leading-tight truncate">
                {user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user.email}
              </p>
              <p className="text-[10px] text-zinc-600 leading-tight mt-0.5">
                {ROLE_LABEL[user.role] ?? user.role}
              </p>
            </div>
          )}
          <div className={`flex gap-1 ${collapsed ? 'flex-col items-center' : ''}`}>
            <button
              onClick={() => { onLogout(); navigate('/login'); }}
              title="Wyloguj"
              className={`text-xs text-zinc-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-zinc-800 ${collapsed ? '' : 'flex-1 text-left'}`}
            >
              {collapsed ? '↩' : '↩ Wyloguj'}
            </button>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="text-xs text-zinc-600 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              title={collapsed ? 'Rozwiń' : 'Zwiń'}
            >
              {collapsed ? '›' : '‹'}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}

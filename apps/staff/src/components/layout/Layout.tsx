import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

interface Props {
  user: { firstName?: string; lastName?: string; email: string; role: string };
  onLogout: () => void;
  children: React.ReactNode;
}

const NAV = [
  { to: '/',             icon: '⬡', label: 'Mapa biurek', roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'] },
  { to: '/reservations', icon: '📅', label: 'Rezerwacje',  roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'] },
  { to: '/devices',      icon: '📡', label: 'Urządzenia',  roles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'] },
];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN:  'Super Admin',
  OFFICE_ADMIN: 'Office Admin',
  STAFF:        'Staff',
  END_USER:     'Użytkownik',
};

export function Layout({ user, onLogout, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-zinc-50 font-sans overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`
        flex flex-col bg-zinc-900 text-zinc-100 transition-all duration-300 shrink-0
        ${collapsed ? 'w-14' : 'w-52'}
      `}>
        {/* Logo */}
        <div className={`flex items-center gap-2.5 px-4 py-5 border-b border-zinc-800 ${collapsed ? 'justify-center px-0' : ''}`}>
          <span className="text-[#B53578] font-black text-xl tracking-tight select-none">R</span>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold leading-none text-white">RESERTI</p>
              <p className="text-[10px] text-zinc-500 leading-none mt-0.5">Staff Panel</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 flex flex-col gap-0.5 px-2">
          {NAV.filter(n => n.roles.includes(user.role)).map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `
                flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all
                ${isActive
                  ? 'bg-[#B53578]/20 text-[#e06aaa] font-medium'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                }
                ${collapsed ? 'justify-center px-0' : ''}
              `}
              title={collapsed ? label : undefined}
            >
              <span className="text-base shrink-0">{icon}</span>
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + collapse toggle */}
        <div className="border-t border-zinc-800 p-3 flex flex-col gap-2">
          {!collapsed && (
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-zinc-300 leading-tight">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">{ROLE_LABEL[user.role] ?? user.role}</p>
            </div>
          )}
          <div className={`flex gap-1 ${collapsed ? 'flex-col items-center' : ''}`}>
            <button
              onClick={handleLogout}
              title="Wyloguj"
              className={`
                text-xs text-zinc-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-zinc-800
                ${collapsed ? '' : 'flex-1'}
              `}
            >
              {collapsed ? '↩' : '↩ Wyloguj'}
            </button>
            <button
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Rozwiń' : 'Zwiń'}
              className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
            >
              {collapsed ? '›' : '‹'}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}

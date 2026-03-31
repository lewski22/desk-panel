import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ownerApi } from '../api/client';

const NAV = [
  { to: '/clients', icon: '🏢', label: 'Klienci' },
  { to: '/health',  icon: '📡', label: 'Health' },
  { to: '/stats',   icon: '📊', label: 'Statystyki' },
];

export function OwnerLayout({ user, onLogout }: { user: any; onLogout: () => void }) {
  const navigate = useNavigate();
  const [impersonating, setImpersonating] = useState<{ orgId: string; orgName: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('owner_impersonating');
      if (raw) setImpersonating(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const exitImpersonation = () => {
    localStorage.removeItem('owner_impersonating');
    setImpersonating(null);
  };

  const logout = () => {
    ownerApi.auth.logout();
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-zinc-900 flex flex-col min-h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-zinc-800">
          <p className="text-[#B53578] font-black text-2xl leading-none">R</p>
          <p className="text-white font-bold text-sm tracking-widest mt-0.5">RESERTI</p>
          <p className="text-zinc-600 text-[9px] tracking-widest uppercase mt-0.5">Owner Panel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#B53578] text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`
              }
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-zinc-800">
          <p className="text-zinc-400 text-xs truncate">{user?.email}</p>
          <button onClick={logout}
            className="text-zinc-600 hover:text-zinc-300 text-xs mt-1 transition-colors">
            Wyloguj
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Impersonation banner */}
        {impersonating && (
          <div className="bg-amber-500 text-white text-xs px-4 py-2 flex items-center justify-between shrink-0">
            <span>
              👁 Ostatnio weszłeś jako SUPER_ADMIN: <strong>{impersonating.orgName}</strong>
            </span>
            <button onClick={exitImpersonation}
              className="ml-4 underline hover:no-underline">
              Wyczyść
            </button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

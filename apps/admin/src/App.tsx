import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { adminApi }           from './api/client';
import { AdminLayout }        from './components/layout/AdminLayout';
import { DashboardPage }      from './pages/DashboardPage';
import { DesksPage }          from './pages/DesksPage';
import { UsersPage }          from './pages/UsersPage';
import { ReportsPage }        from './pages/ReportsPage';
import { OrganizationsPage }  from './pages/OrganizationsPage';
import { ProvisioningPage }   from './pages/ProvisioningPage';
import { ReservationsAdminPage } from './pages/ReservationsAdminPage';

// ── Login ──────────────────────────────────────────────────────
function Login({ onLogin }: { onLogin: (u: any) => void }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [busy, setBusy]         = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { onLogin(await adminApi.auth.login(email, password)); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-[#B53578] font-black text-5xl leading-none tracking-tight">R</p>
          <p className="text-white font-bold text-xl tracking-widest mt-1">RESERTI</p>
          <p className="text-zinc-600 text-[10px] tracking-widest uppercase mt-1">Admin Panel</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-white font-semibold mb-5">Zaloguj się</h2>
          {err && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-900/50 text-red-400 text-sm">{err}</div>}
          <form onSubmit={submit} className="flex flex-col gap-3">
            {[
              { id: 'email',    label: 'Email', type: 'email',    value: email,    set: setEmail },
              { id: 'password', label: 'Hasło', type: 'password', value: password, set: setPassword },
            ].map(({ id, label, type, value, set }) => (
              <div key={id}>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">{label}</label>
                <input
                  type={type} value={value} required autoFocus={id === 'email'}
                  onChange={e => set(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#B53578]/40 transition-all"
                />
              </div>
            ))}
            <button type="submit" disabled={busy}
              className="mt-2 w-full py-2.5 rounded-xl bg-[#B53578] hover:bg-[#9d2d66] text-white font-semibold text-sm transition-colors disabled:opacity-50">
              {busy ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Logowanie…
                </span>
              ) : 'Zaloguj się'}
            </button>
          </form>
          <div className="mt-5 pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-600 mb-1.5">Konta testowe:</p>
            {[
              ['admin@demo-corp.pl',     'Admin1234!', 'Office Admin'],
              ['superadmin@reserti.pl',  'Admin1234!', 'Super Admin'],
            ].map(([e, p, r]) => (
              <button key={e} onClick={() => { setEmail(e); setPassword(p); }}
                className="block text-left text-xs text-zinc-600 hover:text-zinc-300 transition-colors py-0.5 w-full">
                <span className="text-zinc-700">{r}:</span> {e}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<any>(() => adminApi.auth.user());

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <Login onLogin={u => setUser(u)} />
        } />

        <Route path="/*" element={
          !user
            ? <Navigate to="/login" replace />
            : (
              <AdminLayout user={user} onLogout={() => { adminApi.auth.logout(); setUser(null); }}>
                <Routes>
                  <Route path="/dashboard"     element={<DashboardPage />} />
                  <Route path="/desks"         element={<DesksPage />} />
                  <Route path="/users"         element={<UsersPage />} />
                  <Route path="/reports"       element={<ReportsPage />} />
                  <Route path="/reservations"  element={<ReservationsAdminPage />} />
                  <Route path="/provisioning"  element={<ProvisioningPage />} />
                  <Route path="/organizations" element={<OrganizationsPage />} />
                  <Route path="*"              element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </AdminLayout>
            )
        } />
      </Routes>
    </BrowserRouter>
  );
}

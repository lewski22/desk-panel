import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { adminApi }           from './api/client';
import { AdminLayout }        from './components/layout/AdminLayout';
import { DashboardPage }      from './pages/DashboardPage';
import { DesksPage }          from './pages/DesksPage';
import { UsersPage }          from './pages/UsersPage';
import { ReportsPage }        from './pages/ReportsPage';
import { OrganizationsPage }  from './pages/OrganizationsPage';
import { ProvisioningPage }   from './pages/ProvisioningPage';
import { ReservationsAdminPage } from './pages/ReservationsAdminPage';

// Prosty debounce
function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }) as T;
}

// ── Azure SSO Callback ─────────────────────────────────────────
// Odbiera id_token z URL fragment po redirect z Azure
function AzureCallback({ onLogin }: { onLogin: (u: any) => void }) {
  const navigate = useNavigate();
  const [err, setErr] = useState('');

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const idToken   = fragment.get('id_token');
    const errorDesc = fragment.get('error_description');

    if (errorDesc) { setErr(decodeURIComponent(errorDesc)); return; }
    if (!idToken)  { setErr('Brak tokenu — spróbuj ponownie'); return; }

    adminApi.auth.loginAzure(idToken)
      .then(user => { onLogin(user); navigate('/dashboard', { replace: true }); })
      .catch(e => setErr(e.message));
  }, []);

  if (err) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-red-900/50 rounded-2xl p-8 max-w-sm w-full text-center">
        <p className="text-red-400 text-sm mb-4">{err}</p>
        <button onClick={() => navigate('/login')}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Wróć do logowania
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-[#B53578] rounded-full animate-spin" />
    </div>
  );
}

// ── Login ──────────────────────────────────────────────────────
function Login({ onLogin }: { onLogin: (u: any) => void }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [busy, setBusy]         = useState(false);
  const [sso, setSso]           = useState<{ available: boolean; tenantId?: string } | null>(null);
  const [ssoChecking, setSsoChecking] = useState(false);

  // Sprawdź czy SSO dostępne po wpisaniu emaila (debounce 600ms)
  const checkSso = React.useCallback(
    debounce(async (e: string) => {
      if (!e.includes('@')) { setSso(null); return; }
      setSsoChecking(true);
      try { setSso(await adminApi.auth.checkSso(e)); }
      catch { setSso(null); }
      setSsoChecking(false);
    }, 600),
    [],
  );

  const handleEmailChange = (v: string) => { setEmail(v); checkSso(v); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { onLogin(await adminApi.auth.login(email, password)); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  // Microsoft SSO — MSAL PKCE (zastępuje deprecated implicit flow)
  const loginMicrosoft = async () => {
    if (!sso?.tenantId) return;
    setBusy(true); setErr('');
    try {
      const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
      if (!clientId) throw new Error('Logowanie przez Microsoft nie jest skonfigurowane. Skontaktuj się z administratorem.');

      const { PublicClientApplication } = await import('@azure/msal-browser');
      const msal = new PublicClientApplication({
        auth: {
          clientId,
          authority:   `https://login.microsoftonline.com/${sso.tenantId}`,
          redirectUri: `${window.location.origin}/auth/azure/callback`,
        },
        cache: { cacheLocation: 'sessionStorage' },
      });
      await msal.initialize();

      const result = await msal.loginPopup({
        scopes:    ['openid', 'profile', 'email'],
        loginHint: email,
        prompt:    'select_account',
      });

      if (!result?.idToken) throw new Error('Brak tokenu od Microsoft');
      onLogin(await adminApi.auth.loginAzure(result.idToken));
    } catch (e: any) {
      // Popup zamknięty przez użytkownika — nie pokazuj błędu
      if (e.errorCode !== 'user_cancelled' && !e.message?.includes('cancelled')) {
        setErr(e.message ?? 'Logowanie przez Microsoft nie powiodło się');
      }
      setBusy(false);
    }
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
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Email</label>
              <input
                type="email" value={email} required autoFocus
                onChange={e => handleEmailChange(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#B53578]/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Hasło</label>
              <input
                type="password" value={password} required
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#B53578]/40 transition-all"
              />
            </div>
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

          {/* SSO — widoczny tylko jeśli email ma włączone Azure SSO */}
          {(sso?.available || ssoChecking) && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <hr className="flex-1 border-zinc-800" />
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">lub</span>
                <hr className="flex-1 border-zinc-800" />
              </div>
              <button
                onClick={loginMicrosoft}
                disabled={busy || ssoChecking || !sso?.available}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-white text-sm font-medium transition-colors disabled:opacity-40"
              >
                {ssoChecking ? (
                  <span className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 21 21">
                    <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
                    <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
                    <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                  </svg>
                )}
                Zaloguj przez Microsoft
              </button>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-600 mb-1.5">Konta testowe:</p>
            {[
              ['admin@demo-corp.pl',     'Admin1234!', 'Office Admin'],
              ['superadmin@reserti.pl',  'Admin1234!', 'Super Admin'],
            ].map(([e, p, r]) => (
              <button key={e} onClick={() => { setEmail(e as string); setPassword(p as string); checkSso(e as string); }}
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
        <Route path="/auth/azure/callback" element={
          <AzureCallback onLogin={u => setUser(u)} />
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

import React, { useState, useEffect } from 'react';
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

// ── Komponent: Modal logowania przez Entra ID ─────────────────
// Całkowicie oddzielony od formularza email/hasło.
// Wywołuje checkSso dopiero PO kliknięciu przycisku — zero requestów w tle.
function EntraIDModal({ onLogin, onClose }: { onLogin: (u: any) => void; onClose: () => void }) {
  const [email,   setEmail]   = useState('');
  const [step,    setStep]    = useState<'email' | 'sso'>('email');
  const [tenantId,setTenantId]= useState('');
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState('');

  const checkAndProceed = async () => {
    if (!email.includes('@')) { setErr('Podaj prawidłowy adres email'); return; }
    setBusy(true); setErr('');
    try {
      const res = await adminApi.auth.checkSso(email);
      if (!res.available || !res.tenantId) {
        setErr('Logowanie przez Entra ID nie jest skonfigurowane dla tej domeny. Skontaktuj się z administratorem.');
        setBusy(false);
        return;
      }
      setTenantId(res.tenantId);
      setStep('sso');
    } catch {
      setErr('Nie można sprawdzić konfiguracji SSO. Sprawdź połączenie i spróbuj ponownie.');
    }
    setBusy(false);
  };

  const loginEntra = async () => {
    setBusy(true); setErr('');
    try {
      const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
      if (!clientId) throw new Error('VITE_AZURE_CLIENT_ID nie jest skonfigurowany.');

      const { PublicClientApplication } = await import('@azure/msal-browser');
      const msal = new PublicClientApplication({
        auth: {
          clientId,
          authority:   `https://login.microsoftonline.com/${tenantId}`,
          redirectUri: window.location.origin,
        },
        cache: { cacheLocation: 'sessionStorage' },
      });
      await msal.initialize();

      const result = await msal.loginPopup({
        scopes:    ['openid', 'profile', 'email'],
        loginHint: email,
        prompt:    'select_account',
      });

      if (!result?.idToken) throw new Error('Brak tokenu od Microsoft.');
      onLogin(await adminApi.auth.loginAzure(result.idToken));
    } catch (e: any) {
      if (e.errorCode !== 'user_cancelled' && !e.message?.includes('cancelled')) {
        setErr(e.message ?? 'Logowanie nie powiodło się. Spróbuj ponownie.');
      }
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl w-full max-w-sm"
           style={{ fontFamily: "'DM Sans',sans-serif" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-semibold">Logowanie przez Entra ID</h2>
            <p className="text-zinc-500 text-xs mt-0.5">Microsoft 365 / Azure AD</p>
          </div>
          <button onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 transition-colors text-lg leading-none">×</button>
        </div>

        {err && (
          <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-900/50 text-red-400 text-sm">{err}</div>
        )}

        {step === 'email' && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Email firmowy</label>
              <input
                type="email" value={email} autoFocus
                onChange={e => { setEmail(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && checkAndProceed()}
                placeholder="jan@twoja-firma.pl"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#B53578]/40 transition-all"
              />
            </div>
            <button onClick={checkAndProceed} disabled={busy || !email}
              className="w-full py-2.5 rounded-xl bg-[#B53578] hover:bg-[#9d2d66] text-white font-semibold text-sm transition-colors disabled:opacity-50">
              {busy ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sprawdzanie…
                </span>
              ) : 'Dalej'}
            </button>
          </div>
        )}

        {step === 'sso' && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-zinc-400 text-sm">Zaloguj się kontem Microsoft powiązanym z</p>
              <p className="text-white font-medium mt-1">{email}</p>
            </div>
            <button onClick={loginEntra} disabled={busy}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {busy ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 21 21">
                  <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
                  <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
                  <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
              )}
              {busy ? 'Logowanie…' : 'Zaloguj przez Microsoft'}
            </button>
            <button onClick={() => { setStep('email'); setErr(''); }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors text-center">
              ← Zmień email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Login ──────────────────────────────────────────────────────
function Login({ onLogin }: { onLogin: (u: any) => void }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [err,      setErr]      = useState('');
  const [busy,     setBusy]     = useState(false);
  const [showEntra,setShowEntra]= useState(false);

  // Logowanie email + hasło — bez żadnych requestów SSO w tle
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { onLogin(await adminApi.auth.login(email, password)); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <>
      {showEntra && (
        <EntraIDModal onLogin={onLogin} onClose={() => setShowEntra(false)} />
      )}
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

            {/* Formularz email + hasło — całkowicie niezależny od SSO */}
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Email</label>
                <input
                  type="email" value={email} required autoFocus
                  onChange={e => setEmail(e.target.value)}
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

            {/* Separator */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">lub</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            {/* Przycisk Entra ID — zawsze widoczny, całkowicie oddzielony */}
            <button
              onClick={() => { setShowEntra(true); setErr(''); }}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800 text-zinc-300 text-sm font-medium transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 21 21">
                <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
                <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
                <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
              Zaloguj się przez Entra ID
            </button>

            {/* Konta testowe */}
            <div className="mt-5 pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-600 mb-1.5">Konta testowe:</p>
              {[
                ['admin@demo-corp.pl',    'Admin1234!', 'Office Admin'],
                ['superadmin@reserti.pl', 'Admin1234!', 'Super Admin'],
              ].map(([e, p, r]) => (
                <button key={e} onClick={() => { setEmail(e as string); setPassword(p as string); }}
                  className="block text-left text-xs text-zinc-600 hover:text-zinc-300 transition-colors py-0.5 w-full">
                  <span className="text-zinc-700">{r}:</span> {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
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

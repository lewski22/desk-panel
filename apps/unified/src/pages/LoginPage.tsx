import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { LogoMark } from '../components/logo/LogoMark';

const MSVG = <svg width="16" height="16" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>;

const SPIN = <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />;

function EntraIDModal({ onLogin, onClose }: { onLogin: (u: any) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [email,    setEmail]    = useState('');
  const [step,     setStep]     = useState<'email' | 'sso'>('email');
  const [tenantId, setTenantId] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState('');

  const checkAndProceed = async () => {
    if (!email.includes('@')) { setErr(t('entra.errors.invalid_email')); return; }
    setBusy(true); setErr('');
    try {
      const res = await appApi.auth.checkSso(email);
      if (!res.available || !res.tenantId) { setErr(t('entra.errors.sso_not_configured')); setBusy(false); return; }
      setTenantId(res.tenantId);
      setStep('sso');
    } catch { setErr(t('entra.errors.sso_check_failed')); }
    setBusy(false);
  };

  const loginEntra = async () => {
    setBusy(true); setErr('');
    try {
      const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
      if (!clientId) throw new Error(t('entra.errors.missing_client'));
      const { PublicClientApplication } = await import('@azure/msal-browser');
      const msal = new PublicClientApplication({
        auth: { clientId, authority: `https://login.microsoftonline.com/${tenantId}`, redirectUri: window.location.origin },
        cache: { cacheLocation: 'sessionStorage' },
      });
      await msal.initialize();
      const result = await msal.loginPopup({ scopes: ['openid', 'profile', 'email'], loginHint: email, prompt: 'select_account' });
      if (!result?.idToken) throw new Error(t('entra.errors.no_token'));
      onLogin(await appApi.auth.loginAzure(result.idToken));
    } catch (e: any) {
      if (e.errorCode !== 'user_cancelled' && !e.message?.includes('cancelled')) {
        setErr(e.message ?? t('entra.errors.login_failed'));
      }
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-semibold">{t('entra.title')}</h2>
            <p className="text-zinc-500 text-xs mt-0.5">{t('entra.subtitle')}</p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors text-xl leading-none">×</button>
        </div>
        {err && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-900/50 text-red-400 text-sm">{err}</div>}
        {step === 'email' && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">{t('entra.work_email')}</label>
              <input type="email" value={email} autoFocus
                onChange={e => { setEmail(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && checkAndProceed()}
                placeholder={t('entra.placeholder_email')}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-3 sm:py-2.5 text-base sm:text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand/40 transition-all" />
            </div>
            <button onClick={checkAndProceed} disabled={busy || !email}
              className="w-full py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm transition-colors disabled:opacity-50">
              {busy ? <span className="inline-flex items-center gap-2 justify-center">{SPIN}{t('entra.checking')}</span> : t('entra.check')}
            </button>
          </div>
        )}
        {step === 'sso' && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-zinc-400 text-sm">{t('entra.subtitle')}</p>
              <p className="text-white font-medium mt-1">{email}</p>
            </div>
            <button onClick={loginEntra} disabled={busy}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {busy ? SPIN : MSVG}
              {busy ? t('entra.logging_in') : t('entra.login_button')}
            </button>
            <button onClick={() => { setStep('email'); setErr(''); }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors text-center">
              {t('entra.change_email')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface Props { onLogin: (u: any) => void; }

export function LoginPage({ onLogin }: Props) {
  const { t } = useTranslation();
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [err,       setErr]       = useState('');
  const [busy,      setBusy]      = useState(false);
  const [showEntra, setShowEntra] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as any)?.returnTo as string | undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const user = await appApi.auth.login(email, password);
      if (returnTo) { onLogin(user); navigate(returnTo, { replace: true }); }
      else { onLogin(user); }
    }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <>
      {showEntra && <EntraIDModal onLogin={onLogin} onClose={() => setShowEntra(false)} />}
      {/* intentional dark theme — standalone auth page outside AppLayout */}{/* FIX P2-1 */}
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans',sans-serif" }}>
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="flex justify-center mb-3">
              <LogoMark size={64} />
            </div>
            <p className="text-white font-bold text-xl tracking-widest">RESERTI</p>
            <p className="text-zinc-600 text-[10px] tracking-widest uppercase mt-1">Desk Management</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-white font-semibold mb-5">{t('login.title')}</h2>
            {err && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-900/50 text-red-400 text-sm">{err}</div>}
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">{t('login.email')}</label>
                <input type="email" value={email} required autoFocus onChange={e => setEmail(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-3 sm:py-2.5 text-base sm:text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand/40 transition-all" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">{t('login.password')}</label>
                <input type="password" value={password} required onChange={e => setPassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-3 sm:py-2.5 text-base sm:text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand/40 transition-all" />
              </div>
              <button type="submit" disabled={busy}
                className="mt-2 w-full py-3 sm:py-2.5 rounded-xl bg-brand hover:bg-brand-hover active:bg-[#8a2659] text-white font-semibold text-sm transition-colors disabled:opacity-50">
                {busy ? <span className="inline-flex items-center gap-2 justify-center">{SPIN}{t('login.submitting')}</span> : t('login.submit')}
              </button>
            </form>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{t('login.or')}</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
            <button onClick={() => { setShowEntra(true); setErr(''); }}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800 text-zinc-300 text-sm font-medium transition-colors">
              {MSVG} {t('entra.title')}
            </button>
            <div className="mt-5 pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-600 mb-1.5">{t('login.test_accounts')}</p>
              {[
                ['superadmin@reserti.pl', 'Admin1234!', 'Super Admin'],
                ['admin@demo-corp.pl',    'Admin1234!', 'Office Admin'],
                ['staff@demo-corp.pl',    'Staff1234!', 'Staff'],
                ['user@demo-corp.pl',     'User1234!',  'End User'],
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
    </>
  );
}

import React, { useState } from 'react';
import { ownerApi } from '../api/client';

interface Props { onLogin: (u: any) => void; }

export function LoginPage({ onLogin }: Props) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [err,      setErr]      = useState('');
  const [busy,     setBusy]     = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const u = await ownerApi.auth.login(email, password);
      if (u.role !== 'OWNER') {
        ownerApi.auth.logout();
        setErr('Brak dostępu — wymagana rola OWNER.');
        setBusy(false);
        return;
      }
      onLogin(u);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-[#B53578] font-black text-5xl leading-none tracking-tight">R</p>
          <p className="text-white font-bold text-xl tracking-widest mt-1">RESERTI</p>
          <p className="text-zinc-500 text-[10px] tracking-widest uppercase mt-1">Owner Panel</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-white font-semibold mb-5">Logowanie</h2>
          {err && <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-900/50 text-red-400 text-sm">{err}</div>}
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Email</label>
              <input type="email" value={email} required autoFocus
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#B53578]/40 transition-all" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Hasło</label>
              <input type="password" value={password} required
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#B53578]/40 transition-all" />
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
          <div className="mt-5 pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-600 mb-1">Konto testowe:</p>
            <button onClick={() => { setEmail('owner@reserti.pl'); setPassword('Owner1234!'); }}
              className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">
              owner@reserti.pl / Owner1234!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

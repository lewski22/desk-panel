import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  onLogin: (email: string, password: string) => Promise<any>;
}

export function LoginPage({ onLogin }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message ?? 'Nieprawidłowe dane logowania');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <p className="text-[#B53578] font-black text-5xl tracking-tighter leading-none">R</p>
          <p className="text-white font-bold text-xl tracking-widest mt-1">RESERTI</p>
          <p className="text-zinc-500 text-xs mt-1 tracking-widest uppercase">Desk Management</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-white font-semibold text-lg mb-6">Zaloguj się</h1>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-900/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                Adres email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jan@firma.pl"
                required
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#B53578]/50 focus:border-[#B53578]/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                Hasło
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#B53578]/50 focus:border-[#B53578]/50 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-xl bg-[#B53578] hover:bg-[#9d2d66] text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Logowanie…
                </span>
              ) : 'Zaloguj się'}
            </button>
          </form>

          {/* Dev hint */}
          <div className="mt-6 pt-5 border-t border-zinc-800">
            <p className="text-xs text-zinc-600 mb-2">Konta testowe:</p>
            {[
              { email: 'staff@demo-corp.pl',  password: 'Staff1234!', role: 'Staff' },
              { email: 'admin@demo-corp.pl',  password: 'Admin1234!', role: 'Admin' },
            ].map(({ email: e, password: p, role }) => (
              <button
                key={e}
                onClick={() => { setEmail(e); setPassword(p); }}
                className="block w-full text-left text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-0.5"
              >
                <span className="text-zinc-700">{role}:</span> {e}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-zinc-700 text-xs mt-6">
          © {new Date().getFullYear()} Reserti · Desk Management
        </p>
      </div>
    </div>
  );
}

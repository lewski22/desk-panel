import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/logo/LogoMark';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

type Step = 'loading' | 'disabled' | 'login-required' | 'spot-info' | 'confirming' | 'success' | 'error';

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('app_user') ?? 'null'); } catch { return null; }
}
function getImpersonationToken(): string | null {
  return sessionStorage.getItem('app_access');
}
function authHeaders(): HeadersInit {
  const imp = getImpersonationToken();
  return imp ? { Authorization: `Bearer ${imp}` } : {};
}
function isAuthenticated() { return !!getStoredUser() || !!getImpersonationToken(); }

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-5"
    style={{ fontFamily: "'DM Sans', sans-serif" }}>
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-2"><LogoMark size={48} /></div>
        <p className="text-white font-bold tracking-widest text-sm mt-0.5">RESERTI</p>
      </div>
      {children}
    </div>
  </div>
);

const Spinner = () => (
  <div className="w-8 h-8 border-2 border-zinc-700 border-t-brand rounded-full animate-spin" />
);

export function ParkingQrCheckinPage() {
  const { token }  = useParams<{ token: string }>();
  const navigate   = useNavigate();
  const [step,     setStep]    = useState<Step>('loading');
  const [resource, setResource] = useState<any>(null);
  const [result,   setResult]   = useState<any>(null);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!token) { setStep('error'); setError('Nieprawidłowy kod QR'); return; }
    fetch(`${API}/resources/qr/${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setStep('error'); setError('Nie znaleziono miejsca parkingowego'); return; }
        setResource(data);
        if (!data.qrCheckinEnabled) { setStep('disabled'); return; }
        if (!isAuthenticated())     { setStep('login-required'); return; }
        setStep('spot-info');
      })
      .catch(() => { setStep('error'); setError('Błąd połączenia — sprawdź internet'); });
  }, [token]);

  const handleCheckin = async () => {
    if (!isAuthenticated()) { setStep('login-required'); return; }
    setStep('confirming');
    try {
      const res = await fetch(`${API}/checkins/parking-qr`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json', ...authHeaders() },
        body:        JSON.stringify({ resourceQrToken: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('app_user');
          sessionStorage.removeItem('app_access');
          setStep('login-required');
          return;
        }
        throw new Error(data.message ?? 'Błąd check-in');
      }
      setResult(data);
      setStep('success');
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    } catch (e: any) {
      setError(e.message); setStep('error');
    }
  };

  if (step === 'loading') return (
    <Wrapper>
      <div className="flex justify-center py-12"><Spinner /></div>
    </Wrapper>
  );

  if (step === 'confirming') return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center gap-4">
        <Spinner />
        <p className="text-zinc-300 text-sm">Potwierdzam przybycie…</p>
      </div>
    </Wrapper>
  );

  if (step === 'disabled') return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
        <p className="text-4xl mb-3">🅿️</p>
        {resource && (
          <p className="text-white font-bold text-lg mb-1">{resource.name}</p>
        )}
        <p className="text-zinc-400 text-sm mt-3">QR check-in nie jest aktywny dla tego miejsca.</p>
        <button onClick={() => navigate('/')}
          className="mt-5 w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
          Wróć do panelu
        </button>
      </div>
    </Wrapper>
  );

  if (step === 'error') return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="text-white font-semibold mb-2">Błąd</p>
        <p className="text-zinc-400 text-sm mb-5">{error}</p>
        <button onClick={() => navigate('/')}
          className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
          Wróć do panelu
        </button>
      </div>
    </Wrapper>
  );

  if (step === 'login-required') return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        {resource && (
          <div className="mb-5 p-3 rounded-xl bg-zinc-800 text-center">
            <p className="text-3xl mb-1">🅿️</p>
            <p className="text-white font-semibold">{resource.name}</p>
            <p className="text-zinc-400 text-xs mt-0.5">{resource.location?.name}</p>
          </div>
        )}
        <p className="text-zinc-400 text-sm text-center mb-5">
          Zaloguj się aby potwierdzić rezerwację miejsca parkingowego.
        </p>
        <button onClick={() => navigate(`/login?redirect=/parking-checkin/${token}`)}
          className="w-full py-3 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand-hover transition-colors">
          Zaloguj się
        </button>
      </div>
    </Wrapper>
  );

  if (step === 'success') return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
        <div className="w-20 h-20 mx-auto mb-4">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="38" stroke="#10b981" strokeWidth="3"
              strokeDasharray="239" strokeDashoffset="0"
              style={{ animation: 'stroke-circle 0.4s ease-in-out forwards' }} />
            <path d="M22 40l12 12 24-24" stroke="#10b981" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="50" strokeDashoffset="50"
              style={{ animation: 'stroke-check 0.3s ease-in-out 0.35s forwards' }} />
          </svg>
        </div>
        <style>{`
          @keyframes stroke-circle { to { stroke-dashoffset: 0; } from { stroke-dashoffset: 239; } }
          @keyframes stroke-check  { to { stroke-dashoffset: 0; } }
        `}</style>
        {result?.alreadyCheckedIn ? (
          <>
            <p className="text-white font-semibold text-lg mb-1">Już zameldowany</p>
            <p className="text-zinc-400 text-sm">{result.resourceName} · {result.resourceCode}</p>
          </>
        ) : (
          <>
            <p className="text-white font-semibold text-lg mb-1">🎉 Zameldowano!</p>
            <p className="text-zinc-400 text-sm">{result?.resourceName} · {result?.resourceCode}</p>
            {result?.locationName && (
              <p className="text-zinc-500 text-xs mt-1">{result.locationName}</p>
            )}
            <p className="text-zinc-500 text-xs mt-1">
              {new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </>
        )}
        <button onClick={() => navigate('/')}
          className="mt-6 w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
          Wróć do panelu
        </button>
      </div>
    </Wrapper>
  );

  // spot-info
  const user    = getStoredUser();
  const booking = resource?.currentBooking ?? null;
  // Allow check-in when using impersonation token without a stored user object,
  // since we can't compare user IDs — the backend validates ownership.
  const tokenOnly   = !user && !!getImpersonationToken();
  const isMyBooking = booking && (tokenOnly || user?.id === booking?.user?.id);
  const isOtherBooking = booking && !isMyBooking;

  return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl mb-1">🅿️</p>
              <p className="text-white font-bold text-xl">{resource.name}</p>
              <p className="text-zinc-500 text-sm font-mono">{resource.code}</p>
            </div>
            <div className="text-right">
              <p className="text-zinc-400 text-xs">{resource.location?.name}</p>
              {resource.floor && <p className="text-zinc-500 text-xs">Piętro {resource.floor}</p>}
              {resource.zone  && <p className="text-zinc-500 text-xs">Strefa {resource.zone}</p>}
            </div>
          </div>
        </div>

        {booking && (
          <div className={`px-5 py-3 border-b border-zinc-800 ${isMyBooking ? 'bg-sky-950/40' : 'bg-zinc-800/40'}`}>
            <p className="text-xs font-medium mb-0.5 text-sky-400">
              {isMyBooking ? 'Twoja rezerwacja' : 'Zarezerwowane'}
            </p>
            {/* Name intentionally omitted — user info not returned by the public QR endpoint */}
            <p className="text-sky-400 text-xs">
              {new Date(booking.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {new Date(booking.endTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}

        <div className="p-5 space-y-2">
          {isMyBooking && !booking.checkedInAt && (
            <button onClick={handleCheckin}
              className="w-full py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm transition-colors">
              ✅ Potwierdź przybycie
            </button>
          )}
          {isMyBooking && booking.checkedInAt && (
            <div className="text-center py-3">
              <p className="text-emerald-400 font-semibold text-sm">✅ Już zameldowany</p>
              <p className="text-zinc-500 text-xs mt-1">
                {new Date(booking.checkedInAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
          {isOtherBooking && (
            <div className="text-center py-2">
              <p className="text-zinc-400 text-sm mb-3">Miejsce zarezerwowane przez inną osobę.</p>
            </div>
          )}
          {!booking && (
            <div className="text-center py-2">
              <p className="text-zinc-400 text-sm">Brak rezerwacji na to miejsce na dziś.</p>
            </div>
          )}
          <button onClick={() => navigate('/')}
            className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
            Wróć do panelu
          </button>
        </div>
      </div>
      <p className="text-center text-zinc-700 text-xs mt-4">
        Powered by Reserti · {new Date().toLocaleDateString('pl-PL')}
      </p>
    </Wrapper>
  );
}

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

type Step = 'loading' | 'login-required' | 'desk-info' | 'confirming' | 'success' | 'error';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  free:     { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Wolne' },
  reserved: { bg: 'bg-sky-50',     text: 'text-sky-700',     label: 'Zarezerwowane' },
  occupied: { bg: 'bg-red-50',     text: 'text-red-600',     label: 'Zajęte' },
};

function getToken() {
  try { return JSON.parse(localStorage.getItem('staff_user') ?? 'null')?.accessToken ?? null; }
  catch { return null; }
}

export function QrCheckinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate   = useNavigate();
  const [step,     setStep]    = useState<Step>('loading');
  const [desk,     setDesk]    = useState<any>(null);
  const [checkin,  setCheckin] = useState<any>(null);
  const [error,    setError]   = useState('');

  const deskStatus = desk
    ? desk.isOccupied ? 'occupied' : desk.currentReservation ? 'reserved' : 'free'
    : 'free';

  // 1. Fetch desk info (public endpoint)
  useEffect(() => {
    if (!token) { setStep('error'); setError('Nieprawidłowy kod QR'); return; }
    fetch(`${API}/desks/qr/${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setStep('error'); setError('Biurko nie istnieje lub jest nieaktywne'); return; }
        setDesk(data);
        const jwt = getToken();
        setStep(jwt ? 'desk-info' : 'login-required');
      })
      .catch(() => { setStep('error'); setError('Brak połączenia z serwerem'); });
  }, [token]);

  const handleCheckin = async () => {
    const jwt = getToken();
    if (!jwt) { setStep('login-required'); return; }
    setStep('confirming');
    try {
      const res = await fetch(`${API}/checkins/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ deskId: desk.id, qrToken: desk.currentReservation?.qrToken ?? token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Błąd check-in');
      setCheckin(data);
      setStep('success');
    } catch (e: any) {
      setError(e.message);
      setStep('error');
    }
  };

  const handleCheckout = async (checkinId: string) => {
    const jwt = getToken();
    setStep('confirming');
    try {
      await fetch(`${API}/checkins/${checkinId}/checkout`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      setStep('success');
      setDesk((d: any) => ({ ...d, isOccupied: false, checkins: [] }));
    } catch {
      setStep('error'); setError('Błąd podczas check-out');
    }
  };

  // ── Views ──────────────────────────────────────────────────
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-5"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-[#B53578] font-black text-4xl">R</p>
          <p className="text-white font-bold tracking-widest text-sm mt-0.5">RESERTI</p>
        </div>
        {children}
      </div>
    </div>
  );

  if (step === 'loading') return (
    <Wrapper>
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-[#B53578] rounded-full animate-spin" />
      </div>
    </Wrapper>
  );

  if (step === 'error') return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="text-white font-semibold mb-2">Wystąpił problem</p>
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
        <p className="text-zinc-400 text-sm text-center mb-5">
          Aby zrobić check-in, zaloguj się do panelu Staff
        </p>
        {desk && (
          <div className="mb-5 p-3 rounded-xl bg-zinc-800 text-center">
            <p className="text-white font-semibold">{desk.name}</p>
            <p className="text-zinc-400 text-xs mt-0.5">
              {desk.floor ? `Piętro ${desk.floor}` : ''}{desk.zone ? ` · ${desk.zone}` : ''}
            </p>
          </div>
        )}
        <button onClick={() => navigate('/login', { state: { returnTo: `/checkin/${token}` } })}
          className="w-full py-3 rounded-xl bg-[#B53578] text-white font-semibold text-sm hover:bg-[#9d2d66] transition-colors">
          Zaloguj się
        </button>
      </div>
    </Wrapper>
  );

  if (step === 'confirming') return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-[#B53578] rounded-full animate-spin" />
        <p className="text-zinc-300 text-sm">Przetwarzanie…</p>
      </div>
    </Wrapper>
  );

  if (step === 'success') return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-white font-semibold text-lg mb-1">Check-in udany!</p>
        <p className="text-zinc-400 text-sm mb-2">{desk?.name}</p>
        {checkin?.checkin && (
          <p className="text-zinc-500 text-xs">
            {new Date(checkin.checkin.checkedInAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        <button onClick={() => navigate('/')}
          className="mt-6 w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
          Wróć do mapy
        </button>
      </div>
    </Wrapper>
  );

  // desk-info — główny widok
  const statusCfg = STATUS_COLORS[deskStatus];
  return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Desk header */}
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white font-bold text-xl">{desk.name}</p>
              <p className="text-zinc-500 text-sm mt-0.5 font-mono">{desk.code}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
              {statusCfg.label}
            </span>
          </div>
          {(desk.floor || desk.zone) && (
            <div className="flex gap-3 mt-3">
              {desk.floor && (
                <span className="text-xs text-zinc-500">📍 Piętro {desk.floor}</span>
              )}
              {desk.zone && (
                <span className="text-xs text-zinc-500">🗂 {desk.zone}</span>
              )}
            </div>
          )}
        </div>

        {/* Current reservation info */}
        {desk.currentReservation && (
          <div className="px-5 py-3 bg-sky-950/40 border-b border-zinc-800">
            <p className="text-xs text-sky-400 font-medium mb-0.5">Aktualna rezerwacja</p>
            <p className="text-sky-200 text-sm font-semibold">
              {desk.currentReservation.user?.firstName} {desk.currentReservation.user?.lastName}
            </p>
            <p className="text-sky-400 text-xs">
              {new Date(desk.currentReservation.startTime).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' })}
              {' – '}
              {new Date(desk.currentReservation.endTime).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' })}
            </p>
          </div>
        )}

        {/* Occupied — show who/since */}
        {desk.isOccupied && desk.checkins?.[0] && (
          <div className="px-5 py-3 bg-red-950/30 border-b border-zinc-800">
            <p className="text-xs text-red-400 font-medium mb-0.5">Zajęte od</p>
            <p className="text-red-200 text-sm">
              {new Date(desk.checkins[0].checkedInAt).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' })}
            </p>
          </div>
        )}

        {/* Action */}
        <div className="p-5">
          {deskStatus === 'free' && (
            <button onClick={handleCheckin}
              className="w-full py-3.5 rounded-xl bg-[#B53578] hover:bg-[#9d2d66] text-white font-semibold text-sm transition-colors">
              Check-in
            </button>
          )}
          {deskStatus === 'reserved' && desk.currentReservation && (
            <button onClick={handleCheckin}
              className="w-full py-3.5 rounded-xl bg-[#B53578] hover:bg-[#9d2d66] text-white font-semibold text-sm transition-colors">
              Check-in — potwierdź rezerwację
            </button>
          )}
          {deskStatus === 'occupied' && desk.checkins?.[0] && (
            <button onClick={() => handleCheckout(desk.checkins[0].id)}
              className="w-full py-3.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-semibold text-sm transition-colors">
              Check-out — zwolnij biurko
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-zinc-700 text-xs mt-4">
        Powered by Reserti · {new Date().toLocaleDateString('pl-PL')}
      </p>
    </Wrapper>
  );
}

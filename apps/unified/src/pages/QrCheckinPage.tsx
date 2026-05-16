import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogoMark } from '../components/logo/LogoMark';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

type Step = 'loading' | 'login-required' | 'desk-info' | 'confirming' | 'success' | 'occupied' | 'error';

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('app_user') ?? 'null'); } catch { return null; }
}
// With cookie-based auth, "authenticated" is detected by presence of app_user in localStorage.
// Impersonation token (app_access) is also supported.
function getImpersonationToken(): string | null {
  return sessionStorage.getItem('app_access');
}

export function QrCheckinPage() {
  const { t }      = useTranslation();
  const { token }  = useParams<{ token: string }>();
  const navigate   = useNavigate();
  const [step,     setStep]    = useState<Step>('loading');
  const [desk,     setDesk]    = useState<any>(null);
  const [result,   setResult]  = useState<any>(null);
  const [error,    setError]   = useState('');

  const deskStatus = desk
    ? desk.isOccupied ? 'occupied' : desk.currentReservation ? 'reserved' : 'free'
    : 'free';

  const authHeaders = (): HeadersInit => {
    const imp = getImpersonationToken();
    return imp ? { Authorization: `Bearer ${imp}` } : {};
  };

  // TODO(backlog#1): replace localStorage auth detection with /auth/me check once
  // impersonation token is moved to httpOnly cookie.
  // Note: this is only a UX hint — all API calls are validated server-side via httpOnly cookie.
  const isAuthenticated = () => !!getImpersonationToken() || !!getStoredUser();

  // 1. Fetch desk info (public endpoint)
  useEffect(() => {
    if (!token) { setStep('error'); setError(t('qr.invalid_qr')); return; }
    fetch(`${API}/desks/qr/${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setStep('error'); setError(t('qr.not_found')); return; }
        setDesk(data);
        setStep(isAuthenticated() ? 'desk-info' : 'login-required');
      })
      .catch(() => { setStep('error'); setError(t('qr.no_connection')); });
  }, [token]);

  // ── Check-in: user has a reservation for this desk ───────────
  const handleCheckin = async () => {
    if (!isAuthenticated()) { setStep('login-required'); return; }
    setStep('confirming');
    try {
      const res = await fetch(`${API}/checkins/qr`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json', ...authHeaders() },
        body:        JSON.stringify({ deskId: desk.id, qrToken: desk.currentReservation?.qrToken ?? token }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('app_user');
          sessionStorage.removeItem('app_access');
          setStep('login-required');
          return;
        }
        if (res.status === 409) { setStep('occupied'); return; }
        throw new Error(data.message ?? t('qr.error_checkin'));
      }
      setResult({ type: 'checkin', checkin: data, deskName: desk.name });
      setStep('success');
    } catch (e: any) {
      setError(e.message); setStep('error');
    }
  };

  // ── Walk-in: desk is free, no reservation — create one + check-in
  const handleWalkin = async () => {
    if (!isAuthenticated()) { setStep('login-required'); return; }
    setStep('confirming');
    try {
      const res = await fetch(`${API}/checkins/qr/walkin`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json', ...authHeaders() },
        body:        JSON.stringify({ deskId: desk.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) { setStep('occupied'); return; }
        throw new Error(data.message ?? t('qr.error_reservation'));
      }
      setResult({ type: 'walkin', deskName: data.deskName ?? desk.name });
      setStep('success');
    } catch (e: any) {
      setError(e.message); setStep('error');
    }
  };

  // ── Check-out ─────────────────────────────────────────────────
  const handleCheckout = async (checkinId: string) => {
    setStep('confirming');
    try {
      await fetch(`${API}/checkins/${checkinId}/checkout`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     authHeaders(),
      });
      setResult({ type: 'checkout', deskName: desk.name });
      setStep('success');
    } catch {
      setStep('error'); setError(t('qr.error_checkout'));
    }
  };

  // ── Layout wrapper ────────────────────────────────────────────
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-5"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2">
            <LogoMark size={48} />
          </div>
          <p className="text-white font-bold tracking-widest text-sm mt-0.5">RESERTI</p>
        </div>
        {children}
      </div>
    </div>
  );

  // ── Views ─────────────────────────────────────────────────────
  if (step === 'loading') return (
    <Wrapper>
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-brand rounded-full animate-spin" />
      </div>
    </Wrapper>
  );

  if (step === 'confirming') return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-brand rounded-full animate-spin" />
        <p className="text-zinc-300 text-sm">{t('qr.processing')}</p>
      </div>
    </Wrapper>
  );

  // ── Occupied by someone else ──────────────────────────────────
  if (step === 'occupied') return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
        <p className="text-white font-semibold text-lg mb-2">{t('qr.occupied_title')}</p>
        <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
          {t('qr.occupied_other_desc')}
        </p>
        <button onClick={() => navigate('/')}
          className="w-full py-3 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand-hover transition-colors">
          {t('qr.back_to_map')}
        </button>
      </div>
    </Wrapper>
  );

  // ── Error ─────────────────────────────────────────────────────
  if (step === 'error') return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
        <i className="ti ti-alert-triangle text-4xl text-amber-400 mb-3 block" aria-hidden="true" />
        <p className="text-white font-semibold mb-2">{t('qr.error_title')}</p>
        <p className="text-zinc-400 text-sm mb-5">{error}</p>
        <button onClick={() => navigate('/')}
          className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
          {t('qr.back_to_panel')}
        </button>
      </div>
    </Wrapper>
  );

  // ── Login required ────────────────────────────────────────────
  if (step === 'login-required') return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        {desk && (
          <div className="mb-5 p-3 rounded-xl bg-zinc-800 text-center">
            <p className="text-white font-semibold">{desk.name}</p>
            <p className="text-zinc-400 text-xs mt-0.5">
              {desk.floor ? `Piętro ${desk.floor}` : ''}{desk.zone ? ` · ${desk.zone}` : ''}
            </p>
          </div>
        )}
        <p className="text-zinc-400 text-sm text-center mb-5">
          {t('qr.login_prompt')}
        </p>
        <button onClick={() => navigate('/login', { state: { returnTo: `/checkin/${token}` } })}
          className="w-full py-3 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand-hover transition-colors">
          {t('qr.login')}
        </button>
      </div>
    </Wrapper>
  );

  // ── Success — Sprint A4: animated checkmark + haptic ─────────
  if (step === 'success') {
    // Haptic feedback na mobile
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
        {/* Animated checkmark SVG */}
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

        {result?.type === 'walkin' && (
          <>
            <p className="text-white font-semibold text-lg mb-1">{t('qr.success_reserved')}</p>
            <p className="text-zinc-400 text-sm mb-1">{result.deskName}</p>
            <p className="text-zinc-500 text-xs">{t('qr.reservation_checkin_info')}</p>
          </>
        )}
        {result?.type === 'checkin' && (
          <>
            <p className="text-white font-semibold text-lg mb-1">{t('qr.success_checkin')}</p>
            <p className="text-zinc-400 text-sm mb-1">{result.deskName}</p>
            <p className="text-zinc-500 text-xs">
              {new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </>
        )}
        {result?.type === 'checkout' && (
          <>
            <p className="text-white font-semibold text-lg mb-1">{t('qr.success_checkout')}</p>
            <p className="text-zinc-400 text-sm">{result.deskName}</p>
          </>
        )}

        <button onClick={() => navigate('/')}
          className="mt-6 w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
          {t('qr.back_to_map')}
        </button>
      </div>
    </Wrapper>
    );
  }

  // ── Main desk-info view ───────────────────────────────────────
  const isMyReservation = desk.currentReservation && getStoredUser()?.id === desk.currentReservation.userId;

  return (
    <Wrapper>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white font-bold text-xl">{desk.name}</p>
              <p className="text-zinc-500 text-sm mt-0.5 font-mono">{desk.code}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              deskStatus === 'free'     ? 'bg-emerald-950/60 text-emerald-400' :
              deskStatus === 'reserved' ? 'bg-sky-950/60 text-sky-400' :
                                          'bg-red-950/60 text-red-400'
            }`}>
              {deskStatus === 'free' ? t('qr.status.free') : deskStatus === 'reserved' ? t('qr.status.reserved') : t('qr.status.occupied')}
            </span>
          </div>
          {(desk.floor || desk.zone) && (
            <div className="flex gap-3 mt-3">
              {desk.floor && <span className="text-xs text-zinc-500 flex items-center gap-1"><i className="ti ti-stairs" aria-hidden="true" />Piętro {desk.floor}</span>}
              {desk.zone  && <span className="text-xs text-zinc-500 flex items-center gap-1"><i className="ti ti-layout-grid" aria-hidden="true" />{desk.zone}</span>}
            </div>
          )}
        </div>

        {/* Reservation info */}
        {desk.currentReservation && (
          <div className="px-5 py-3 bg-sky-950/40 border-b border-zinc-800">
            <p className="text-xs text-sky-400 font-medium mb-0.5">
              {isMyReservation ? t('qr.your_reservation') : t('qr.reserved_by')}
            </p>
            {!isMyReservation && (
              <p className="text-sky-200 text-sm font-semibold">
                {desk.currentReservation.user?.firstName} {desk.currentReservation.user?.lastName}
              </p>
            )}
            <p className="text-sky-400 text-xs">
              {new Date(desk.currentReservation.startTime).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' })}
              {' – '}
              {new Date(desk.currentReservation.endTime).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' })}
            </p>
          </div>
        )}

        {/* Occupied info */}
        {desk.isOccupied && desk.checkins?.[0] && (
          <div className="px-5 py-3 bg-red-950/30 border-b border-zinc-800">
            <p className="text-xs text-red-400 font-medium mb-0.5">{t('qr.occupied_since')}</p>
            <p className="text-red-200 text-sm">
              {new Date(desk.checkins[0].checkedInAt).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' })}
            </p>
          </div>
        )}

        {/* Action */}
        <div className="p-5 space-y-2">
          {/* Free desk — walk-in reservation + check-in */}
          {deskStatus === 'free' && (
            <button onClick={handleWalkin}
              className="w-full py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm transition-colors">
              {t('qr.reserve_and_checkin')}
            </button>
          )}

          {/* Reserved — my reservation → check-in */}
          {deskStatus === 'reserved' && isMyReservation && (
            <button onClick={handleCheckin}
              className="w-full py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm transition-colors">
              {t('qr.confirm_checkin')}
            </button>
          )}

          {/* Reserved by someone else */}
          {deskStatus === 'reserved' && !isMyReservation && (
            <div className="text-center py-2">
              <p className="text-zinc-400 text-sm mb-3">
                {t('qr.occupied_other_desc')}
              </p>
              <button onClick={() => navigate('/')}
                className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
                {t('qr.back_to_map')}
              </button>
            </div>
          )}

          {/* Occupied — check-out (only own checkin) */}
          {deskStatus === 'occupied' && desk.checkins?.[0] && (
            (() => {
              const myUserId = getStoredUser()?.id;
              const isMyCheckin = desk.checkins[0].userId === myUserId;
              return isMyCheckin ? (
                <button onClick={() => handleCheckout(desk.checkins[0].id)}
                  className="w-full py-3.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-semibold text-sm transition-colors">
                  Check-out — zwolnij biurko
                </button>
              ) : (
                <div className="text-center py-2">
                  <p className="text-zinc-400 text-sm mb-3">
                    {t('qr.occupied_other_desc')}
                  </p>
                  <button onClick={() => navigate('/')}
                    className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
                    {t('qr.back_to_map')}
                  </button>
                </div>
              );
            })()
          )}
        </div>
      </div>

      <p className="text-center text-zinc-700 text-xs mt-4">
        Powered by Reserti · {new Date().toLocaleDateString('pl-PL')}
      </p>
    </Wrapper>
  );
}

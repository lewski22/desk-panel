/**
 * MyReservationsPage — Sprint H2
 * Dodano swipe-left → reveal "Anuluj" (iOS Mail pattern)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }          from '../api/client';
import { EmptyState }      from '../components/ui';

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    PENDING:   'bg-amber-100 text-amber-700',
    CONFIRMED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-zinc-100 text-zinc-500',
    EXPIRED:   'bg-zinc-100 text-zinc-400',
    COMPLETED: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-zinc-100 text-zinc-500'}`}>
      {t(`reservations.status.${status.toLowerCase()}`, status)}
    </span>
  );
}

function ReservationCard({
  r, locale, onCancel, cancelling, onCheckin, checkingIn, onCheckout, checkingOut,
}: {
  r: any; locale: string;
  onCancel:   (id: string)        => void; cancelling:  string | null;
  onCheckin:  (id: string)        => void; checkingIn:  string | null;
  onCheckout: (checkinId: string) => void; checkingOut: string | null;
}) {
  const { t } = useTranslation();

  const TZ = (r.desk?.location?.timezone as string | undefined) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: TZ });
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });

  const started      = Date.now() >= new Date(r.startTime).getTime();
  const accentColor  = r.status === 'CONFIRMED' ? '#B53578' : '#f59e0b';

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-zinc-200">
      <div style={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)` }} />

      <div className="p-3.5">
        {/* Wiersz 1: awatar + nazwa biurka + lokalizacja + badge */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand font-bold text-sm shrink-0">
            {r.desk?.code?.split('-').pop()?.slice(0,2) ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-800 leading-tight truncate">
              {r.desk?.name ?? t('deskcard.desk_fallback')}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight truncate">
              {[r.desk?.location?.name, r.desk?.floor ? `${t('floorplan.floor_label', 'Piętro')} ${r.desk.floor}` : null]
                .filter(Boolean).join(' · ')}
            </p>
          </div>
          <StatusBadge status={r.status} />
        </div>

        {/* Czas jako pigułka */}
        <div className="inline-flex items-center gap-1.5 bg-zinc-50 border border-zinc-100 rounded-lg px-2.5 py-1.5 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />
          <span className="text-[11px] text-zinc-600 font-medium">
            {fmtDate(r.startTime)} · {fmtTime(r.startTime)}–{fmtTime(r.endTime)}
          </span>
          {r.recurrenceGroupId && <span className="text-[10px] text-brand ml-1">↻</span>}
        </div>

        {/* Przyciski */}
        <div className="flex gap-2">
          {canCheckin(r) && (
            <button
              onClick={() => onCheckin(r.id)}
              disabled={checkingIn === r.id}
              className="flex-1 bg-brand text-white rounded-xl py-2.5 text-[12px] font-semibold disabled:opacity-40 transition-colors hover:bg-brand-hover active:scale-[0.98]"
            >
              {checkingIn === r.id
                ? '…'
                : started
                  ? t('reservations.checkin_now',   'Potwierdź obecność')
                  : t('reservations.checkin_early', 'Potwierdź rezerwację')
              }
            </button>
          )}

          {r.checkin && !r.checkin.checkedOutAt ? (
            <button
              onClick={() => onCheckout(r.checkin.id)}
              disabled={checkingOut === r.checkin.id}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-[12px] font-semibold disabled:opacity-40 transition-colors hover:bg-indigo-700 active:scale-[0.98]"
            >
              {checkingOut === r.checkin.id ? '…' : t('desks.actions.checkout')}
            </button>
          ) : (
            <button
              onClick={() => onCancel(r.id)}
              disabled={cancelling === r.id}
              className="bg-zinc-100 text-zinc-600 rounded-xl py-2.5 px-4 text-[12px] font-semibold disabled:opacity-40 transition-colors hover:bg-zinc-200 active:scale-[0.98] shrink-0"
            >
              {cancelling === r.id ? '…' : t('reservations.cancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function canCheckin(r: any): boolean {
  if (!['CONFIRMED', 'PENDING'].includes(r.status)) return false;
  if (r.checkedInAt) return false;
  if (r.checkin && !r.checkin.checkedOutAt) return false;
  return Date.now() <= new Date(r.endTime).getTime();
}

export function MyReservationsPage() {
  const { t, i18n } = useTranslation();
  const [reservations, setReservations] = useState<any[]>([]);
  const [bookings,     setBookings]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [err,          setErr]          = useState('');
  const [cancelling,   setCancelling]   = useState<string | null>(null);
  const [checkingIn,   setCheckingIn]   = useState<string | null>(null);
  const [checkingOut,  setCheckingOut]  = useState<string | null>(null); // FIX P1-3
  const [cancellingB,  setCancellingB]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [res, bk] = await Promise.all([
        appApi.reservations.getMy(),
        appApi.resources.myBookings(),
      ]);
      setReservations(res);
      setBookings(bk);
    }
    catch (e: any) { setErr(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancel = async (id: string) => {
    if (!confirm(t('reservations.confirm_cancel_simple'))) return;
    setCancelling(id);
    try { await appApi.reservations.cancel(id); await load(); }
    catch (e: any) { setErr(e.message); }
    setCancelling(null);
  };

  const cancelBooking = async (id: string) => {
    if (!confirm(t('rooms.my_bookings.cancel_confirm', 'Czy na pewno chcesz anulować rezerwację sali?'))) return;
    setCancellingB(id);
    try { await appApi.resources.cancelBooking(id); await load(); }
    catch (e: any) { setErr(e.message); }
    setCancellingB(null);
  };

  // FIX P1-3: checkout handler — ends the active checkin for a reservation
  const checkout = async (checkinId: string) => {
    setCheckingOut(checkinId);
    try { await appApi.checkins.checkout(checkinId); await load(); }
    catch (e: any) { setErr(e?.response?.data?.message ?? e.message); }
    setCheckingOut(null);
  };

  const checkin = async (id: string) => {
    setCheckingIn(id);
    try {
      await appApi.checkins.web(id);
      setReservations(rs => rs.map(r =>
        r.id === id ? { ...r, checkedInAt: new Date().toISOString() } : r,
      ));
      await load();
    }
    catch (e: any) { setErr(e?.response?.data?.message ?? e.message); }
    setCheckingIn(null);
  };

  const [showHistory, setShowHistory] = useState(false);

  const locale   = i18n.language === 'en' ? 'en-GB' : 'pl-PL';
  const active   = reservations.filter(r => ['PENDING','CONFIRMED'].includes(r.status));
  const inactive = reservations.filter(r => !['PENDING','CONFIRMED'].includes(r.status));

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-800">{t('pages.myReservations.title')}</h1>
        <button
          onClick={load}
          className="w-9 h-9 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-500 flex items-center justify-center"
          title={t('btn.refresh')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 2.5A6.5 6.5 0 1 0 14.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M11 2.5h3.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {err && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{err}</div>}

      {reservations.length === 0 && bookings.length === 0 && (
        <EmptyState icon="📅" title={t('reservations.none')} sub={t('reservations.none_hint')} />
      )}

      {(reservations.length > 0 || bookings.length > 0) && <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {t('reservations.active_section', 'Aktywne')}
                </h2>
                <span className="text-[11px] text-zinc-400">
                  {active.length} {active.length === 1
                    ? t('reservations.reservation_single', 'rezerwacja')
                    : t('reservations.reservation_plural', 'rezerwacje')}
                </span>
              </div>
              <div className="space-y-3">
                {active.map(r => (
                  <ReservationCard key={r.id} r={r} locale={locale}
                    onCancel={cancel} cancelling={cancelling}
                    onCheckin={checkin} checkingIn={checkingIn}
                    onCheckout={checkout} checkingOut={checkingOut} />
                ))}
              </div>
            </div>
          )}
          {inactive.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {t('reservations.history')}
                </h2>
                <button
                  onClick={() => setShowHistory(v => !v)}
                  className="text-xs text-brand font-semibold"
                >
                  {showHistory
                    ? t('reservations.history_collapse', 'Zwiń ↑')
                    : t('reservations.history_show', 'Pokaż wszystkie ({{count}}) →', { count: inactive.length })}
                </button>
              </div>
              {showHistory && (
                <div className="space-y-2">
                  {inactive.map(r => (
                    <div key={r.id} className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 flex items-center gap-3 opacity-70">
                      <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center text-zinc-500 font-bold text-xs shrink-0">
                        {r.desk?.code?.split('-').pop()?.slice(0,2) ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-600 truncate">{r.desk?.name ?? '—'}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {new Date(r.startTime).toLocaleDateString('pl-PL', {
                            weekday: 'short', day: 'numeric', month: 'numeric',
                            timeZone: (r.desk?.location?.timezone as string | undefined) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                          })}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sale konferencyjne i parkingi */}
          <section>
            <h3 className="font-semibold text-zinc-700 mb-3">🏛 {t('rooms.my_bookings.title', 'Moje rezerwacje sal')}</h3>
            {bookings.length === 0 ? (
              <EmptyState icon="🏛" title={t('rooms.my_bookings.empty', 'Nie masz nadchodzących rezerwacji sal')} />
            ) : (
              <div className="space-y-3">
                {bookings.map(b => {
                  const isPast = new Date(b.endTime) < new Date();
                  const TZ = (b.resource?.location?.timezone as string | undefined) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
                  const fmtTime = (iso: string) =>
                    new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: TZ });
                  const fmtDate = (iso: string) =>
                    new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
                  return (
                    <div key={b.id} className={`bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-3 ${isPast ? 'opacity-60' : ''}`}>
                      <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-lg shrink-0">
                        {b.resource?.type === 'PARKING' ? '🅿️' : '🏛'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 truncate">{b.resource?.name ?? '—'}</p>
                        <p className="text-xs text-zinc-400 font-mono text-[10px]">{b.resource?.code}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {fmtDate(b.startTime)}
                          {' · '}
                          {fmtTime(b.startTime)}
                          {'–'}
                          {fmtTime(b.endTime)}
                        </p>
                        {b.resource?.location?.name && (
                          <p className="text-[11px] text-zinc-400">{b.resource.location.name}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <StatusBadge status={b.status} />
                        {!isPast && b.status === 'CONFIRMED' && (
                          <button
                            onClick={() => cancelBooking(b.id)}
                            disabled={cancellingB === b.id}
                            className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-300 hover:bg-red-50 transition-colors font-medium disabled:opacity-40">
                            {cancellingB === b.id ? '…' : t('reservations.cancel')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>}
    </div>
  );
}

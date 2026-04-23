/**
 * MyReservationsPage — Sprint H2
 * Dodano swipe-left → reveal "Anuluj" (iOS Mail pattern)
 */
import { localDateStr } from '../utils/date';
import { parseISO } from 'date-fns';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }          from '../api/client';
import { useSwipe }        from '../hooks/useSwipe';
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

// ── Swipeable reservation card ────────────────────────────────
function ReservationCard({
  r, locale, onCancel, cancelling, onCheckin, checkingIn,
}: {
  r: any; locale: string;
  onCancel: (id: string) => void; cancelling: string | null;
  onCheckin: (id: string) => void; checkingIn: string | null;
}) {
  const { t }           = useTranslation();
  const [offset, setOffset] = useState(0);       // px translation
  const [revealed, setRevealed] = useState(false); // anuluj widoczny
  const startX = useRef<number | null>(null);
  const REVEAL_THRESHOLD = 80; // px żeby odsłonić przycisk

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx > 0 && !revealed) return; // blokuj swipe w prawo gdy zwinięty
    setOffset(revealed ? Math.min(0, dx - REVEAL_THRESHOLD) : Math.min(0, dx));
  };
  const handleTouchEnd = () => {
    if (offset < -REVEAL_THRESHOLD) {
      setRevealed(true); setOffset(-REVEAL_THRESHOLD);
    } else {
      setRevealed(false); setOffset(0);
    }
    startX.current = null;
  };

  const close = () => { setRevealed(false); setOffset(0); };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete button behind */}
      <div className="absolute inset-y-0 right-0 flex items-center px-4 bg-red-500 rounded-2xl">
        <button
          onClick={() => { close(); onCancel(r.id); }}
          disabled={cancelling === r.id}
          className="text-white text-sm font-semibold px-2">
          {cancelling === r.id ? '…' : t('reservations.cancel')}
        </button>
      </div>

      {/* Draggable card */}
      <div
        className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-3 relative"
        style={{ transform: `translateX(${offset}px)`, transition: startX.current === null ? 'transform 0.2s' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => revealed && close()}
      >
        <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand font-bold text-sm shrink-0">
          {r.desk?.code?.split('-').pop()?.slice(0,2) ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-zinc-800 truncate">{r.desk?.name ?? t('deskcard.desk_fallback')}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {parseISO(r.date.slice(0,10)).toLocaleDateString(locale, { weekday:'short', day:'2-digit', month:'2-digit' })}
            {' · '}
            {new Date(r.startTime).toLocaleTimeString(locale, { hour:'2-digit', minute:'2-digit' })}
            –
            {new Date(r.endTime).toLocaleTimeString(locale, { hour:'2-digit', minute:'2-digit' })}
          </p>
          {r.recurrenceGroupId && (
            <p className="text-[10px] text-brand mt-0.5">↻ {t('reservations.recurring_badge')}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={r.status} />
          <div className="hidden sm:flex gap-1.5">
            {canCheckin(r) && (
              <button
                onClick={() => onCheckin(r.id)}
                disabled={checkingIn === r.id}
                className="text-xs px-3 py-1.5 rounded-xl bg-brand text-white hover:bg-brand-hover transition-colors font-medium disabled:opacity-40">
                {checkingIn === r.id ? '…' : t('desks.actions.checkin', 'Check-in')}
              </button>
            )}
            <button
              onClick={() => onCancel(r.id)}
              disabled={cancelling === r.id}
              className="text-xs px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors text-zinc-500 disabled:opacity-40">
              {cancelling === r.id ? '…' : t('reservations.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function canCheckin(r: any): boolean {
  if (r.status !== 'CONFIRMED') return false;
  if (r.checkedInAt) return false;
  if (r.checkin && !r.checkin.checkedOutAt) return false;
  const now   = Date.now();
  const start = new Date(r.startTime).getTime();
  const end   = new Date(r.endTime).getTime();
  const grace = 15 * 60 * 1000;
  return now >= start - grace && now <= end;
}

export function MyReservationsPage() {
  const { t, i18n } = useTranslation();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [err,          setErr]          = useState('');
  const [cancelling,   setCancelling]   = useState<string | null>(null);
  const [checkingIn,   setCheckingIn]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { setReservations(await appApi.reservations.getMy()); }
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
        <button onClick={load}
          className="text-sm px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-600">
          ↺ {t('btn.refresh')}
        </button>
      </div>

      {/* Swipe hint — tylko mobile */}
      {active.length > 0 && (
        <p className="sm:hidden text-[10px] text-zinc-400 mb-3 text-center">
          ← {t('reservations.swipe_hint')}
        </p>
      )}

      {err && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{err}</div>}

      {reservations.length === 0 ? (
        <EmptyState icon="📅" title={t('reservations.none')} sub={t('reservations.none_hint')} />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{t('reservations.active')}</h2>
              <div className="space-y-3">
                {active.map(r => (
                  <ReservationCard key={r.id} r={r} locale={locale}
                    onCancel={cancel} cancelling={cancelling}
                    onCheckin={checkin} checkingIn={checkingIn} />
                ))}
              </div>
            </div>
          )}
          {inactive.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{t('reservations.history')}</h2>
              <div className="space-y-2">
                {inactive.map(r => (
                  <div key={r.id} className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 flex items-center gap-3 opacity-70">
                    <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center text-zinc-500 font-bold text-xs shrink-0">
                      {r.desk?.code?.split('-').pop()?.slice(0,2) ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-600 truncate">{r.desk?.name ?? t('deskcard.desk_fallback')}</p>
                      <p className="text-xs text-zinc-400">
                        {parseISO(r.date.slice(0,10)).toLocaleDateString(locale, { day:'2-digit', month:'2-digit', year:'numeric' })}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

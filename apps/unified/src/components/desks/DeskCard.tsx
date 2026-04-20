/**
 * DeskCard — Sprint A2
 * - Avatar (inicjały) na zajętym biurku dla STAFF+ (privacy: END_USER nie widzi)
 * - Tooltip z imieniem i godziną check-in
 * - Inline quick-book popover dla wolnych biurek
 */
import { useTranslation } from 'react-i18next';
import React, { useState, useRef, useEffect } from 'react';
import { DeskMapItem } from '../../types/index';
import { format } from 'date-fns';

interface Props {
  desk:          DeskMapItem;
  onCheckin:     (desk: DeskMapItem) => void;
  onCheckout:    (desk: DeskMapItem) => void;
  onQuickBook?:  (desk: DeskMapItem, fullDay: boolean) => void;
  hideActions?:  boolean;
  showAvatars?:  boolean;  // Sprint A2 — tylko STAFF+
}

// ── Helpers ──────────────────────────────────────────────────
function initials(user?: { firstName: string; lastName: string } | null): string {
  if (!user) return '?';
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
}

function statusMeta(desk: DeskMapItem, t: (key: string) => string) {
  if (!desk.isOnline || desk.status === 'MAINTENANCE') {
    return {
      label: desk.status === 'MAINTENANCE' ? t('desks.actions.maintenance') : t('devices.status.offline'),
      dot: 'bg-zinc-400', ring: 'ring-zinc-200', badge: 'bg-zinc-100 text-zinc-500',
    };
  }
  if (desk.isOccupied) {
    return { label: t('desks.stats.occupied'), dot: 'bg-white', ring: 'ring-white/40', badge: 'bg-white/20 text-white' };
  }
  if (desk.currentReservation) {
    return { label: t('desks.stats.reserved'), dot: 'bg-sky-300', ring: 'ring-sky-200', badge: 'bg-sky-100 text-sky-700' };
  }
  return { label: t('desks.stats.free'), dot: 'bg-emerald-400', ring: 'ring-emerald-200', badge: 'bg-emerald-50 text-emerald-700' };
}

function cardBg(desk: DeskMapItem) {
  if (!desk.isOnline || desk.status === 'MAINTENANCE') return 'bg-zinc-50 border-zinc-200';
  if (desk.isOccupied)              return 'bg-indigo-600 border-indigo-500 text-white';
  if (desk.currentReservation)      return 'bg-sky-50 border-sky-200';
  return 'bg-white border-emerald-200';
}

// ── Quick-book popover ────────────────────────────────────────
function QuickBookPopover({ desk, onFullDay, onChoose, onClose }: {
  desk: DeskMapItem; onFullDay: () => void; onChoose: () => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref   = useRef<HTMLDivElement>(null);

  // Zamknij przy kliknięciu poza
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref}
      className="absolute z-30 top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-zinc-200 p-3"
      onClick={e => e.stopPropagation()}>
      <p className="text-xs font-semibold text-zinc-700 mb-2">{desk.name}</p>
      <button onClick={onFullDay}
        className="w-full text-left text-xs px-3 py-2 rounded-lg bg-[#B53578] text-white font-medium hover:bg-[#9d2d67] transition-colors mb-1">
        ⚡ {t('deskcard.book_full_day')}
      </button>
      <button onClick={onChoose}
        className="w-full text-left text-xs px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">
        🕐 {t('deskcard.book_choose_time')}
      </button>
    </div>
  );
}

// ── DeskCard ─────────────────────────────────────────────────
export function DeskCard({ desk, onCheckin, onCheckout, onQuickBook, hideActions = false, showAvatars = false }: Props) {
  const { t }        = useTranslation();
  const [showPopover, setShowPopover] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const meta = statusMeta(desk, t);
  const bg   = cardBg(desk);
  const res  = desk.currentReservation;
  const checkin = desk.currentCheckin;

  const isFree = desk.isOnline && desk.status === 'ACTIVE' && !desk.isOccupied && !desk.currentReservation;

  return (
    <div className={`relative rounded-xl border p-3 sm:p-4 flex flex-col gap-2 transition-all duration-300 hover:shadow-md ${bg}`}>

      {/* Status dot */}
      <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ring-2 ${meta.dot} ${meta.ring}`} />

      {/* Avatar na zajętym biurku — Sprint A2 */}
      {showAvatars && desk.isOccupied && checkin?.user && (
        <div className="relative self-start"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}>
          <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center
            text-white text-xs font-bold cursor-default select-none">
            {initials(checkin.user)}
          </div>
          {showTooltip && (
            <div className="absolute z-30 top-full left-0 mt-1 whitespace-nowrap bg-zinc-800 text-white
              text-[10px] rounded-lg px-2.5 py-1.5 shadow-xl pointer-events-none">
              <p className="font-semibold">{checkin.user.firstName} {checkin.user.lastName}</p>
              <p className="text-zinc-400">
                {t('deskcard.checkin_since')} {format(new Date(checkin.checkedInAt), 'HH:mm')}
                {desk.zone && ` · ${desk.zone}`}
              </p>
              <span className="absolute top-0 left-3 -translate-y-full border-4 border-transparent border-b-zinc-800" />
            </div>
          )}
        </div>
      )}

      {/* Code + name */}
      <div>
        <p className={`font-mono text-xs font-semibold tracking-widest uppercase opacity-60 ${desk.isOccupied ? 'text-white' : 'text-zinc-400'}`}>
          {desk.code}
        </p>
        <p className={`font-semibold text-sm leading-tight mt-0.5 ${desk.isOccupied ? 'text-white' : 'text-zinc-800'}`}>
          {desk.name}
        </p>
      </div>

      {/* Zone / floor */}
      {(desk.zone || desk.floor) && (
        <p className={`text-xs ${desk.isOccupied ? 'text-indigo-200' : 'text-zinc-400'}`}>
          {[desk.zone, desk.floor && `${t('deskcard.floor')} ${desk.floor}`].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Reservation info */}
      {res && (
        <div className={`text-xs mt-1 ${desk.isOccupied ? 'text-indigo-100' : 'text-zinc-600'}`}>
          <p className="font-medium">{res.user?.firstName} {res.user?.lastName}</p>
          <p>{format(new Date(res.startTime), 'HH:mm')}–{format(new Date(res.endTime), 'HH:mm')}</p>
        </div>
      )}

      {/* Status badge */}
      <span className={`self-start text-xs px-2 py-0.5 rounded-full font-medium mt-auto ${meta.badge}`}>
        {meta.label}
      </span>

      {/* Quick-book popover dla wolnego biurka — Sprint A2 */}
      {isFree && !hideActions && onQuickBook && (
        <div className="relative">
          <button
            onClick={e => { e.stopPropagation(); setShowPopover(v => !v); }}
            className="w-full text-xs py-2 min-h-touch rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 transition-colors font-medium">
            + {t('deskcard.book')}
          </button>
          {showPopover && (
            <QuickBookPopover
              desk={desk}
              onFullDay={() => { setShowPopover(false); onQuickBook(desk, true); }}
              onChoose={() => { setShowPopover(false); onQuickBook(desk, false); }}
              onClose={() => setShowPopover(false)}
            />
          )}
        </div>
      )}

      {/* Action buttons — Staff/Admin fallback */}
      {!hideActions && !onQuickBook && desk.isOnline && desk.status === 'ACTIVE' && (
        <div className="flex gap-1 mt-1">
          {!desk.isOccupied && (
            <button onClick={() => onCheckin(desk)}
              className="flex-1 text-xs py-2 min-h-touch rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors font-medium">
              Check-in
            </button>
          )}
          {desk.isOccupied && (
            <button onClick={() => onCheckout(desk)}
              className="flex-1 text-xs py-2 min-h-touch rounded-lg bg-white/20 text-white hover:bg-white/30 active:bg-white/40 transition-colors border border-white/30 font-medium">
              Check-out
            </button>
          )}
        </div>
      )}
    </div>
  );
}

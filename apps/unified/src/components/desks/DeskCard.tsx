import React from 'react';
import { DeskMapItem } from '../../types/index';
import { format } from 'date-fns';

interface Props {
  desk: DeskMapItem;
  onCheckin: (desk: DeskMapItem) => void;
  onCheckout: (desk: DeskMapItem) => void;
}

function statusMeta(desk: DeskMapItem) {
  if (!desk.isOnline || desk.status === 'MAINTENANCE') {
    return {
      label: desk.status === 'MAINTENANCE' ? 'Serwis' : 'Offline',
      dot: 'bg-zinc-400',
      ring: 'ring-zinc-200',
      badge: 'bg-zinc-100 text-zinc-500',
    };
  }
  if (desk.isOccupied) {
    return {
      label: 'Zajęte',
      dot: 'bg-white',
      ring: 'ring-white/40',
      badge: 'bg-white/20 text-white',
    };
  }
  if (desk.currentReservation) {
    return {
      label: 'Zarezerwowane',
      dot: 'bg-sky-300',
      ring: 'ring-sky-200',
      badge: 'bg-sky-100 text-sky-700',
    };
  }
  return {
    label: 'Wolne',
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-200',
    badge: 'bg-emerald-50 text-emerald-700',
  };
}

function cardBg(desk: DeskMapItem) {
  if (!desk.isOnline || desk.status === 'MAINTENANCE') return 'bg-zinc-50 border-zinc-200';
  if (desk.isOccupied) return 'bg-indigo-600 border-indigo-500 text-white';
  if (desk.currentReservation) return 'bg-sky-50 border-sky-200';
  return 'bg-white border-emerald-200';
}

export function DeskCard({ desk, onCheckin, onCheckout }: Props) {
  const meta = statusMeta(desk);
  const bg   = cardBg(desk);
  const res  = desk.currentReservation;

  return (
    <div className={`
      relative rounded-xl border p-3 sm:p-4 flex flex-col gap-2
      transition-all duration-300 hover:shadow-md
      ${bg}
    `}>
      {/* Status dot */}
      <span className={`
        absolute top-3 right-3 w-2.5 h-2.5 rounded-full ring-2 ${meta.dot} ${meta.ring}
      `} />

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
          {[desk.zone, desk.floor && `Piętro ${desk.floor}`].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Active reservation info */}
      {res && (
        <div className={`text-xs mt-1 ${desk.isOccupied ? 'text-indigo-100' : 'text-zinc-600'}`}>
          <p className="font-medium">
            {res.user.firstName} {res.user.lastName}
          </p>
          <p>
            {format(new Date(res.startTime), 'HH:mm')}–{format(new Date(res.endTime), 'HH:mm')}
          </p>
        </div>
      )}

      {/* Status badge */}
      <span className={`self-start text-xs px-2 py-0.5 rounded-full font-medium mt-auto ${meta.badge}`}>
        {meta.label}
      </span>

      {/* Action buttons */}
      {desk.isOnline && desk.status === 'ACTIVE' && (
        <div className="flex gap-1 mt-1">
          {!desk.isOccupied && (
            <button
              onClick={() => onCheckin(desk)}
              className="flex-1 text-xs py-2 sm:py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors font-medium"
            >
              Check-in
            </button>
          )}
          {desk.isOccupied && (
            <button
              onClick={() => onCheckout(desk)}
              className="flex-1 text-xs py-2 sm:py-1 rounded-lg bg-white/20 text-white hover:bg-white/30 active:bg-white/40 transition-colors border border-white/30 font-medium"
            >
              Check-out
            </button>
          )}
        </div>
      )}
    </div>
  );
}

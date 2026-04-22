import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { DeskMapItem, LocationLimits } from '../../types/index';
import { DeskCard } from './DeskCard';
import { appApi as api } from '../../api/client';
import { ReservationModal } from './ReservationModal';

interface Props {
  desks: DeskMapItem[];
  lastUpdated: Date | null;
  onRefresh: () => void;
  userRole?: string;
  locationLimits?: LocationLimits | null;
  users?: any[];
}

function groupByFloor(desks: DeskMapItem[]) {
  const map = new Map<string, DeskMapItem[]>();
  for (const d of desks) {
    const key = d.floor ?? 'Other';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function Stats({ desks }: { desks: DeskMapItem[] }) {
  const { t } = useTranslation();
  const active   = desks.filter(d => d.isOnline && d.status === 'ACTIVE');
  const free     = active.filter(d => !d.isOccupied && !d.currentReservation).length;
  const reserved = active.filter(d => !d.isOccupied && d.currentReservation).length;
  const occupied = active.filter(d => d.isOccupied).length;
  const offline  = desks.filter(d => !d.isOnline).length;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: t('desks.stats.free'),     count: free,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: t('desks.stats.reserved'), count: reserved, color: 'text-sky-600',     bg: 'bg-sky-50'     },
        { label: t('desks.stats.occupied'), count: occupied, color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
        { label: t('desks.stats.offline'),  count: offline,  color: 'text-zinc-400',    bg: 'bg-zinc-50'    },
      ].map(({ label, count, color, bg }) => (
        <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
          <p className={`text-2xl font-bold font-mono ${color}`}>{count}</p>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{label}</p>
        </div>
      ))}
    </div>
  );
}


export function DeskMap({ desks, lastUpdated, onRefresh, userRole, locationLimits, showAvatars = false, users = [] }: Props & { showAvatars?: boolean }) {
  const { t } = useTranslation();
  const [reservationTarget, setReservationTarget] = useState<DeskMapItem | null>(null);
  const [reservedMsg,       setReservedMsg]       = useState('');
  const [err,               setErr]               = useState('');

  const isEndUser = userRole === 'END_USER';

  const visibleDesks = isEndUser
    ? desks.filter(d => d.status === 'ACTIVE')
    : desks;

  const floors = groupByFloor(visibleDesks);

  const handleQuickBook = (_desk: DeskMapItem, _fullDay: boolean) => {
    setReservationTarget(_desk);
  };

  const handleCheckout = async (desk: DeskMapItem) => {
    if (!desk.currentReservation) return;
    try {
      await api.checkins.checkout(desk.currentReservation.id);
      onRefresh();
    } catch (e: any) { setErr(t('desks.checkout_error', { msg: e.message })); }
  };

  const handleCheckin = async (desk: DeskMapItem) => {
    // If desk has an active reservation → manual check-in directly (Staff/Admin)
    if (desk.currentReservation && !desk.isOccupied) {
      try {
        await api.checkins.manual(desk.id, desk.currentReservation.userId ?? '', desk.currentReservation.id);
        onRefresh();
      } catch (e: any) { setErr(t('desks.checkout_error', { msg: e.message })); }
      return;
    }
    // No reservation — open modal to create one
    setReservationTarget(desk);
  };

  const handleReservationSuccess = () => {
    setReservationTarget(null);
    setReservedMsg(t('desks.reserve.success'));
    onRefresh();
    setTimeout(() => setReservedMsg(''), 5000);
  };

  return (
    <div>
      {reservationTarget && (
        <ReservationModal
          desk={reservationTarget}
          isEndUser={isEndUser}
          users={users}
          limits={locationLimits}
          onClose={() => setReservationTarget(null)}
          onSuccess={handleReservationSuccess}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800">
            {isEndUser ? t('nav.desks') : t('pages.deskMap.title')}
          </h2>
          {lastUpdated && (
            <p className="text-xs text-zinc-400 mt-0.5">
              Aktualizacja: {lastUpdated.toLocaleTimeString('pl-PL')}
            </p>
          )}
        </div>
        <button onClick={onRefresh}
          className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors font-medium">
          ↻ Odśwież
        </button>
      </div>

      {reservedMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          ✓ {reservedMsg}
        </div>
      )}

      <Stats desks={desks} />

      {isEndUser && visibleDesks.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-medium text-zinc-600">{t('table.empty')}</p>
        </div>
      )}

      {floors.map(([floor, floorDesks]) => (
        <div key={floor} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Piętro {floor}
            </span>
            <div className="flex-1 h-px bg-zinc-100" />
            <span className="text-xs text-zinc-400">{floorDesks.length} biurek</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {floorDesks.map(desk => (
              isEndUser ? (
                // END_USER — cała karta klikalność = modal rezerwacji, bez przycisków wewnątrz
                <div key={desk.id}
                  onClick={() => setReservationTarget(desk)}
                  className="cursor-pointer active:scale-95 transition-transform select-none">
                  <DeskCard desk={desk} onCheckin={() => {}} onCheckout={() => {}} hideActions />
                </div>
              ) : (
                // Staff/Admin — check-in otwiera modal rezerwacji, check-out działa bezpośrednio
                <DeskCard
                  key={desk.id}
                  desk={desk}
                  onCheckin={handleCheckin}
                  onCheckout={handleCheckout}
                  onQuickBook={handleQuickBook}
                />
              )
            ))}
          </div>
        </div>
      ))}

      {!isEndUser && desks.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-medium">{t('table.empty')}</p>
        </div>
      )}
    </div>
  );
}

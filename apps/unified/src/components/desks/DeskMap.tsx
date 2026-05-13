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
  selectedDate?: string;
  timezone?: string;
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

interface DeskStatsProps {
  desks: DeskMapItem[];
  currentUserId?: string;
}

export function DeskStats({ desks, currentUserId }: DeskStatsProps) {
  const { t } = useTranslation();

  const free     = desks.filter(d => d.isOnline && !d.isOccupied && !d.currentReservation && d.status === 'ACTIVE').length;
  const reserved = desks.filter(d => d.isOnline && !d.isOccupied && !!d.currentReservation).length;
  const mine     = currentUserId
    ? desks.filter(d => d.currentReservation?.userId === currentUserId).length
    : 0;
  const occupied = desks.filter(d => d.isOccupied).length;
  const offline  = desks.filter(d => !d.isOnline || d.status === 'MAINTENANCE').length;

  const stats = [
    { num: free,     color: '#10b981', bg: '#d1fae5', label: t('desks.stats.free') },
    { num: reserved, color: '#f59e0b', bg: '#fef3c7', label: t('desks.stats.reserved') },
    ...(currentUserId && mine > 0
      ? [{ num: mine, color: '#7c3aed', bg: '#ede9fe', label: t('deskmap.legend.mine', 'Moje') }]
      : []),
    { num: occupied, color: '#ef4444', bg: '#fee2e2', label: t('desks.stats.occupied') },
    { num: offline,  color: '#a1a1aa', bg: '#f4f4f5', label: t('devices.status.offline') },
  ];

  return (
    <div className="grid mb-3"
      style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
      {stats.map(({ num, color, bg, label }) => (
        <div key={label}
          className="flex flex-col items-center justify-center py-3 px-2 border-r border-zinc-100 last:border-r-0"
          style={{ background: num > 0 ? bg + '33' : undefined }}>
          <span className="text-xl font-medium leading-none" style={{ color: num > 0 ? color : '#a1a1aa' }}>
            {num}
          </span>
          <span className="text-[10px] text-zinc-400 mt-1 text-center leading-tight">{label}</span>
        </div>
      ))}
    </div>
  );
}


export function DeskMap({ desks, lastUpdated, onRefresh, userRole, locationLimits, showAvatars = false, users = [], selectedDate, timezone }: Props & { showAvatars?: boolean }) {
  const { t } = useTranslation();
  const [reservationTarget, setReservationTarget] = useState<DeskMapItem | null>(null);
  const [reservedMsg,       setReservedMsg]       = useState('');
  const [err,               setErr]               = useState('');

  const isEndUser = userRole === 'END_USER';

  // FEATURE P4-3B: END_USER only sees ACTIVE desks with an online beacon
  const visibleDesks = isEndUser
    ? desks.filter(d => d.status === 'ACTIVE' && d.isOnline)
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
          initialDate={selectedDate}
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

      {selectedDate && selectedDate !== new Date().toLocaleDateString('sv-SE', { timeZone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone }) && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-4 text-center">
          📅 {t('deskmap.showing_for', 'Dostępność na dzień')}{' '}
          <strong>{new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
        </p>
      )}

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
                  className="cursor-pointer hover:ring-2 hover:ring-brand/20 hover:shadow-sm active:scale-95 transition-all select-none rounded-xl">
                  <DeskCard desk={desk} onCheckin={() => {}} onCheckout={() => {}} hideActions isEndUser />
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

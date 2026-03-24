import React, { useState } from 'react';
import { DeskMapItem } from '../../types';
import { DeskCard } from './DeskCard';
import { api } from '../../api/client';

interface Props {
  desks: DeskMapItem[];
  lastUpdated: Date | null;
  onRefresh: () => void;
}

function groupByFloor(desks: DeskMapItem[]) {
  const map = new Map<string, DeskMapItem[]>();
  for (const d of desks) {
    const key = d.floor ?? 'Inne';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function Stats({ desks }: { desks: DeskMapItem[] }) {
  const active  = desks.filter(d => d.isOnline && d.status === 'ACTIVE');
  const free     = active.filter(d => !d.isOccupied && !d.currentReservation).length;
  const reserved = active.filter(d => !d.isOccupied && d.currentReservation).length;
  const occupied = active.filter(d => d.isOccupied).length;
  const offline  = desks.filter(d => !d.isOnline).length;

  const pct = active.length ? Math.round((occupied / active.length) * 100) : 0;

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Wolne',        count: free,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Zarezerwowane', count: reserved, color: 'text-sky-600',     bg: 'bg-sky-50'     },
        { label: 'Zajęte',       count: occupied, color: 'text-indigo-600',   bg: 'bg-indigo-50'  },
        { label: 'Offline',      count: offline,  color: 'text-zinc-400',     bg: 'bg-zinc-50'    },
      ].map(({ label, count, color, bg }) => (
        <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
          <p className={`text-2xl font-bold font-mono ${color}`}>{count}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

export function DeskMap({ desks, lastUpdated, onRefresh }: Props) {
  const [checkinTarget, setCheckinTarget] = useState<DeskMapItem | null>(null);
  const floors = groupByFloor(desks);

  const handleCheckin = async (desk: DeskMapItem) => {
    setCheckinTarget(desk);
    // For Staff panel: prompt for userId (simplified - production would have user search)
    const userId = prompt('Podaj ID użytkownika (lub pozostaw puste dla walk-in):');
    if (!userId) { setCheckinTarget(null); return; }
    try {
      await api.checkins.manual(desk.id, userId);
      onRefresh();
    } catch (e: any) {
      alert('Błąd check-in: ' + e.message);
    }
    setCheckinTarget(null);
  };

  const handleCheckout = async (desk: DeskMapItem) => {
    // Find active checkin via reservation
    if (!desk.currentReservation) return;
    try {
      // Staff checkout — simplified: uses reservation id to find checkin
      await api.checkins.checkout(desk.currentReservation.id);
      onRefresh();
    } catch (e: any) {
      alert('Błąd check-out: ' + e.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800">Mapa zajętości</h2>
          {lastUpdated && (
            <p className="text-xs text-zinc-400 mt-0.5">
              Aktualizacja: {lastUpdated.toLocaleTimeString('pl-PL')}
            </p>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors font-medium"
        >
          ↻ Odśwież
        </button>
      </div>

      <Stats desks={desks} />

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
              <DeskCard
                key={desk.id}
                desk={desk}
                onCheckin={handleCheckin}
                onCheckout={handleCheckout}
              />
            ))}
          </div>
        </div>
      ))}

      {desks.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-medium">Brak biurek w tej lokalizacji</p>
        </div>
      )}
    </div>
  );
}

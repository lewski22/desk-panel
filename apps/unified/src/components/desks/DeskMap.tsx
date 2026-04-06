import React, { useState } from 'react';
import { DeskMapItem } from '../../types/index';
import { DeskCard } from './DeskCard';
import { appApi as api } from '../../api/client';

interface Props {
  desks: DeskMapItem[];
  lastUpdated: Date | null;
  onRefresh: () => void;
  userRole?: string;
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
  const active   = desks.filter(d => d.isOnline && d.status === 'ACTIVE');
  const free     = active.filter(d => !d.isOccupied && !d.currentReservation).length;
  const reserved = active.filter(d => !d.isOccupied && d.currentReservation).length;
  const occupied = active.filter(d => d.isOccupied).length;
  const offline  = desks.filter(d => !d.isOnline).length;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Wolne',         count: free,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Zarezerwowane', count: reserved, color: 'text-sky-600',     bg: 'bg-sky-50'     },
        { label: 'Zajęte',        count: occupied, color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
        { label: 'Offline',       count: offline,  color: 'text-zinc-400',    bg: 'bg-zinc-50'    },
      ].map(({ label, count, color, bg }) => (
        <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
          <p className={`text-2xl font-bold font-mono ${color}`}>{count}</p>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Modal rezerwacji — dla END_USER i Staff/Admin ─────────────
function ReservationModal({ desk, onClose, onSuccess, isEndUser = true, users = [] }: {
  desk: DeskMapItem; onClose: () => void; onSuccess: () => void;
  isEndUser?: boolean; users?: any[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date,   setDate]   = useState(today);
  const [start,  setStart]  = useState('09:00');
  const [end,    setEnd]    = useState('17:00');
  const [userId, setUserId] = useState('');
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState('');

  const submit = async () => {
    if (start >= end) { setErr('Godzina zakończenia musi być późniejsza niż startu'); return; }
    setBusy(true); setErr('');
    try {
      const startISO = `${date}T${start}:00.000Z`;
      const endISO   = `${date}T${end}:00.000Z`;
      const body: any = { deskId: desk.id, date, startTime: startISO, endTime: endISO };
      // Staff/Admin mogą rezerwować dla konkretnego usera
      if (!isEndUser && userId) body.targetUserId = userId;
      await api.reservations.create(body);
      onSuccess();
    } catch (e: any) { setErr(e.message ?? 'Błąd rezerwacji'); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <p className="font-semibold text-zinc-800">Zarezerwuj biurko</p>
            <p className="text-xs text-zinc-400 mt-0.5">{desk.name} · {desk.code}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors">×</button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          {err && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{err}</div>}

          {/* Staff/Admin — opcjonalny wybór pracownika */}
          {!isEndUser && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">
                Pracownik <span className="text-zinc-300 font-normal">(puste = rezerwacja dla siebie)</span>
              </label>
              <select value={userId} onChange={e => setUserId(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30">
                <option value="">— rezerwacja dla siebie —</option>
                {users.filter((u: any) => u.isActive).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} · {u.email}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Data</label>
            <input type="date" value={date} min={today} onChange={e => setDate(e.target.value)}
              className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Od</label>
              <input type="time" value={start} onChange={e => setStart(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Do</label>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30" />
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 -mt-1">
            Możesz zarezerwować biurko na dowolną godzinę — np. przyjdź o 8:00 i zarezerwuj od 14:00 do 18:00.
          </p>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-medium transition-colors">
              Anuluj
            </button>
            <button onClick={submit} disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-[#B53578] hover:bg-[#9d2d66] text-white font-semibold text-sm transition-colors disabled:opacity-50">
              {busy
                ? <span className="inline-flex items-center gap-2 justify-center">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Rezerwuję…
                  </span>
                : 'Zarezerwuj'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeskMap({ desks, lastUpdated, onRefresh, userRole }: Props) {
  const [reservationTarget, setReservationTarget] = useState<DeskMapItem | null>(null);
  const [reservedMsg,       setReservedMsg]       = useState('');
  const [users,             setUsers]             = useState<any[]>([]);

  const isEndUser = userRole === 'END_USER';

  // Wczytaj listę userów dla Staff/Admin (potrzebna w modalu rezerwacji)
  React.useEffect(() => {
    if (!isEndUser) {
      api.users.list().then(setUsers).catch(() => {});
    }
  }, [isEndUser]);

  // END_USER widzi tylko wolne biurka
  const visibleDesks = isEndUser
    ? desks.filter(d => d.status === 'ACTIVE' && !d.isOccupied && !d.currentReservation)
    : desks;

  const floors = groupByFloor(visibleDesks);

  // Checkout (Staff/Admin)
  const handleCheckout = async (desk: DeskMapItem) => {
    if (!desk.currentReservation) return;
    try {
      await api.checkins.checkout(desk.currentReservation.id);
      onRefresh();
    } catch (e: any) { alert('Błąd check-out: ' + e.message); }
  };

  const handleReservationSuccess = () => {
    setReservationTarget(null);
    setReservedMsg('Biurko zarezerwowane! Sprawdź „Moje rezerwacje".');
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
          onClose={() => setReservationTarget(null)}
          onSuccess={handleReservationSuccess}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800">
            {isEndUser ? 'Wolne biurka' : 'Mapa zajętości'}
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

      {!isEndUser && <Stats desks={desks} />}

      {isEndUser && visibleDesks.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium text-zinc-600">Wszystkie biurka zajęte</p>
          <p className="text-sm mt-1">Sprawdź później lub zarezerwuj biurko na konkretną godzinę</p>
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
                  onCheckin={() => setReservationTarget(desk)}
                  onCheckout={handleCheckout}
                />
              )
            ))}
          </div>
        </div>
      ))}

      {!isEndUser && desks.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-medium">Brak biurek w tej lokalizacji</p>
        </div>
      )}
    </div>
  );
}

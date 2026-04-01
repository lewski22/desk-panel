import React, { useState } from 'react';
import { Reservation } from '../../types/index';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Props {
  reservations: Reservation[];
  loading: boolean;
  onCancel: (id: string) => Promise<void>;
  onRefresh: () => void;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: 'Potwierdzona', className: 'bg-emerald-100 text-emerald-700' },
  PENDING:   { label: 'Oczekuje',     className: 'bg-amber-100  text-amber-700'   },
  CANCELLED: { label: 'Anulowana',    className: 'bg-zinc-100   text-zinc-500'    },
  EXPIRED:   { label: 'Wygasła',      className: 'bg-red-100    text-red-600'     },
  COMPLETED: { label: 'Zakończona',   className: 'bg-sky-100    text-sky-700'     },
};

const METHOD_LABEL: Record<string, string> = {
  NFC:    '📡 NFC',
  QR:     '📷 QR',
  MANUAL: '✋ Ręczny',
};

function Row({ r, onCancel }: { r: Reservation; onCancel: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const meta = STATUS_META[r.status] ?? STATUS_META.PENDING;
  const canCancel = ['CONFIRMED', 'PENDING'].includes(r.status);

  const handleCancel = async () => {
    if (!confirm(`Anulować rezerwację ${r.desk.code}?`)) return;
    setBusy(true);
    try { await onCancel(r.id); } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  return (
    <tr className="border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors group">
      {/* Time */}
      <td className="py-3 px-4 text-sm font-mono text-zinc-600 whitespace-nowrap">
        {format(new Date(r.startTime), 'HH:mm')}
        <span className="text-zinc-300 mx-1">–</span>
        {format(new Date(r.endTime), 'HH:mm')}
      </td>

      {/* Desk */}
      <td className="py-3 px-4">
        <p className="text-sm font-semibold text-zinc-800">{r.desk.name}</p>
        <p className="text-xs text-zinc-400">
          {[r.desk.zone, r.desk.floor && `Piętro ${r.desk.floor}`].filter(Boolean).join(' · ')}
        </p>
      </td>

      {/* User */}
      <td className="py-3 px-4">
        <p className="text-sm text-zinc-800">{r.user.firstName} {r.user.lastName}</p>
        <p className="text-xs text-zinc-400">{r.user.email}</p>
      </td>

      {/* Check-in method */}
      <td className="py-3 px-4 text-xs text-zinc-500">
        {r.checkin ? (
          <div>
            <p>{METHOD_LABEL[r.checkin.method] ?? r.checkin.method}</p>
            <p className="text-zinc-400">
              {format(new Date(r.checkin.checkedInAt), 'HH:mm')}
              {r.checkin.checkedOutAt && ` → ${format(new Date(r.checkin.checkedOutAt), 'HH:mm')}`}
            </p>
          </div>
        ) : (
          <span className="text-zinc-300">—</span>
        )}
      </td>

      {/* Status */}
      <td className="py-3 px-4">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.className}`}>
          {meta.label}
        </span>
      </td>

      {/* Actions */}
      <td className="py-3 px-4 text-right">
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={busy}
            className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40 font-medium"
          >
            {busy ? '…' : 'Anuluj'}
          </button>
        )}
      </td>
    </tr>
  );
}

export function ReservationList({ reservations, loading, onCancel, onRefresh }: Props) {
  const [filter, setFilter] = useState<string>('ALL');

  const filtered = filter === 'ALL'
    ? reservations
    : reservations.filter(r => r.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800">Rezerwacje na dziś</h2>
          <p className="text-xs text-zinc-400">
            {format(new Date(), 'EEEE, d MMMM yyyy', { locale: pl })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="ALL">Wszystkie ({reservations.length})</option>
            <option value="CONFIRMED">Potwierdzone</option>
            <option value="PENDING">Oczekujące</option>
            <option value="COMPLETED">Zakończone</option>
            <option value="CANCELLED">Anulowane</option>
          </select>
          <button
            onClick={onRefresh}
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors"
          >
            ↻
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-300">
          <div className="inline-block w-5 h-5 border-2 border-zinc-200 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm">Brak rezerwacji na dziś</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/70">
                {['Czas', 'Biurko', 'Pracownik', 'Check-in', 'Status', ''].map(h => (
                  <th key={h} className="py-2.5 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <Row key={r.id} r={r} onCancel={onCancel} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

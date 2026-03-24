import React, { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { Btn, Card } from '../components/ui';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const LOC_ID = import.meta.env.VITE_DEFAULT_LOCATION_ID ?? '';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  CONFIRMED: { label: 'Potwierdzona', cls: 'bg-emerald-100 text-emerald-700' },
  PENDING:   { label: 'Oczekuje',     cls: 'bg-amber-100  text-amber-700'   },
  CANCELLED: { label: 'Anulowana',    cls: 'bg-zinc-100   text-zinc-500'    },
  EXPIRED:   { label: 'Wygasła',      cls: 'bg-red-100    text-red-600'     },
  COMPLETED: { label: 'Zakończona',   cls: 'bg-sky-100    text-sky-700'     },
};

export function ReservationsAdminPage() {
  const [res, setRes]         = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus]   = useState('');

  const load = async () => {
    setLoading(true);
    const filters: Record<string, string> = { locationId: LOC_ID, date };
    if (status) filters.status = status;
    setRes(await adminApi.reservations.list(filters).catch(() => []));
    setLoading(false);
  };

  useEffect(() => { load(); }, [date, status]);

  const cancel = async (id: string) => {
    if (!confirm('Anulować rezerwację?')) return;
    await adminApi.reservations.cancel(id);
    await load();
  };

  const checkin = async (r: any) => {
    await adminApi.checkins.manual(r.deskId, r.userId, r.id);
    await load();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Rezerwacje</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Przegląd i zarządzanie rezerwacjami</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Data</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30" />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30">
            <option value="">Wszystkie</option>
            {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
        <div className="self-end">
          <Btn variant="secondary" onClick={load}>↻ Odśwież</Btn>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {Object.entries(STATUS_META).map(([s, m]) => {
          const count = res.filter(r => r.status === s).length;
          return (
            <div key={s} className="bg-white border border-zinc-100 rounded-xl p-3 text-center">
              <p className="text-lg font-bold font-mono text-zinc-700">{count}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{m.label}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>{['Czas','Biurko','Pracownik','Status','Check-in','Akcje'].map(h =>
                <th key={h} className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {res.map(r => {
                const meta = STATUS_META[r.status] ?? STATUS_META.PENDING;
                return (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 group">
                    <td className="py-3 px-4 font-mono text-xs text-zinc-600 whitespace-nowrap">
                      {format(new Date(r.startTime), 'HH:mm')}–{format(new Date(r.endTime), 'HH:mm')}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-zinc-800">{r.desk?.name ?? r.deskId}</p>
                      <p className="text-xs text-zinc-400">{r.desk?.code}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-zinc-800">{r.user?.firstName} {r.user?.lastName}</p>
                      <p className="text-xs text-zinc-400">{r.user?.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-500">
                      {r.checkin ? (
                        <div>
                          <p>{r.checkin.method}</p>
                          <p className="text-zinc-400">{format(new Date(r.checkin.checkedInAt), 'HH:mm')}</p>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {r.status === 'CONFIRMED' && !r.checkin && (
                          <button onClick={() => checkin(r)}
                            className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors">
                            Check-in
                          </button>
                        )}
                        {['CONFIRMED','PENDING'].includes(r.status) && (
                          <button onClick={() => cancel(r.id)}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                            Anuluj
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {res.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-zinc-400 text-sm">Brak rezerwacji dla wybranych filtrów</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

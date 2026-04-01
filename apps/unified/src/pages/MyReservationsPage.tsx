import React, { useEffect, useState, useCallback } from 'react';
import { appApi } from '../api/client';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING:   'bg-amber-100 text-amber-700',
    CONFIRMED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-zinc-100 text-zinc-500',
    EXPIRED:   'bg-zinc-100 text-zinc-400',
    COMPLETED: 'bg-blue-100 text-blue-700',
  };
  const labels: Record<string, string> = {
    PENDING: 'Oczekuje', CONFIRMED: 'Potwierdzona',
    CANCELLED: 'Anulowana', EXPIRED: 'Wygasła', COMPLETED: 'Zakończona',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-zinc-100 text-zinc-500'}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function MyReservationsPage() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [err,          setErr]          = useState('');
  const [cancelling,   setCancelling]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { setReservations(await appApi.reservations.getMy()); }
    catch (e: any) { setErr(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancel = async (id: string) => {
    if (!confirm('Anulować rezerwację?')) return;
    setCancelling(id);
    try { await appApi.reservations.cancel(id); await load(); }
    catch (e: any) { alert(e.message); }
    setCancelling(null);
  };

  const active   = reservations.filter(r => ['PENDING', 'CONFIRMED'].includes(r.status));
  const inactive = reservations.filter(r => !['PENDING', 'CONFIRMED'].includes(r.status));

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Moje rezerwacje</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Twoje aktywne i historyczne rezerwacje biurek</p>
        </div>
        <button onClick={load}
          className="text-sm px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-600">
          ↻ Odśwież
        </button>
      </div>

      {err && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{err}</div>}

      {reservations.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-sm font-medium">Brak rezerwacji</p>
          <p className="text-xs mt-1">Przejdź do mapy biurek, aby zarezerwować miejsce</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Aktywne</h2>
              <div className="space-y-3">
                {active.map(r => (
                  <div key={r.id} className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#B53578]/10 flex items-center justify-center text-[#B53578] font-bold text-sm shrink-0">
                      {r.desk?.code ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-800">{r.desk?.name ?? 'Biurko'}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {new Date(r.date).toLocaleDateString('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        {' '}·{' '}
                        {new Date(r.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                        –
                        {new Date(r.endTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                    <button
                      onClick={() => cancel(r.id)}
                      disabled={cancelling === r.id}
                      className="text-xs px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors text-zinc-500 disabled:opacity-40">
                      {cancelling === r.id ? '…' : 'Anuluj'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Historia</h2>
              <div className="space-y-2">
                {inactive.map(r => (
                  <div key={r.id} className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 flex items-center gap-3 opacity-70">
                    <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center text-zinc-500 font-bold text-xs shrink-0">
                      {r.desk?.code ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-600">{r.desk?.name ?? 'Biurko'}</p>
                      <p className="text-xs text-zinc-400">
                        {new Date(r.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
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

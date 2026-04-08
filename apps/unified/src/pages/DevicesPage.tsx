import React, { useEffect, useState } from 'react';
import { appApi as api } from '../api/client';

interface Device {
  id: string;
  hardwareId: string;
  firmwareVersion: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  rssi: number | null;
  desk: { name: string; code: string } | null;
}

function RssiBar({ rssi }: { rssi: number | null }) {
  if (rssi === null) return <span className="text-zinc-300">—</span>;
  const pct = Math.max(0, Math.min(100, ((rssi + 100) / 60) * 100));
  const color = pct > 66 ? 'bg-emerald-400' : pct > 33 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-500 font-mono">{rssi} dBm</span>
    </div>
  );
}

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await (fetch as any)(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}/devices`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('app_access')}` } }
      ).then((r: Response) => r.json());
      setDevices(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, []);

  const online  = devices.filter(d => d.isOnline).length;
  const offline = devices.filter(d => !d.isOnline).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800">Urządzenia (beacony)</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Stan połączenia każdego beacona</p>
        </div>
        <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
          ↻ Odśwież
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Wszystkich', count: devices.length, color: 'text-zinc-700', bg: 'bg-zinc-50' },
          { label: 'Online',     count: online,          color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Offline',    count: offline,         color: 'text-red-500',     bg: 'bg-red-50'     },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-bold font-mono ${color}`}>{count}</p>
            <p className="text-xs text-zinc-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {loading && devices.length === 0 ? (
        <div className="text-center py-12 text-zinc-300">
          <div className="inline-block w-5 h-5 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/70">
                {['Status', 'Hardware ID', 'Biurko', 'Firmware', 'RSSI', 'Ostatni kontakt'].map(h => (
                  <th key={h} className="py-2.5 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${d.isOnline ? 'text-emerald-600' : 'text-zinc-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${d.isOnline ? 'bg-emerald-400' : 'bg-zinc-300'}`} />
                      {d.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs text-zinc-700">{d.hardwareId}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-zinc-700">
                    {d.desk ? (
                      <span>{d.desk.name} <span className="text-zinc-400 text-xs">({d.desk.code})</span></span>
                    ) : (
                      <span className="text-zinc-300 text-xs">Nieprzypisany</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs text-zinc-500">{d.firmwareVersion ?? '—'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <RssiBar rssi={d.rssi} />
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-500">
                    {d.lastSeen
                      ? new Date(d.lastSeen).toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

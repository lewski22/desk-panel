import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { adminApi } from '../api/client';
import { Stat, Card, Spinner } from '../components/ui';

const LOCATION_ID = import.meta.env.VITE_LOCATION_ID ?? 'seed-location-01';

export function DashboardPage() {
  const [occ,  setOcc]  = useState<any>(null);
  const [desks, setDesks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [o, d] = await Promise.all([
          adminApi.locations.occupancy(LOCATION_ID),
          adminApi.desks.status(LOCATION_ID),
        ]);
        setOcc(o);
        setDesks(d);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner />;

  // Build per-zone bar data
  const zones = new Map<string, { free:number; occupied:number; reserved:number }>();
  for (const d of desks) {
    const z = d.zone ?? 'Inne';
    if (!zones.has(z)) zones.set(z, { free:0, occupied:0, reserved:0 });
    const b = zones.get(z)!;
    if (d.isOccupied)           b.occupied++;
    else if (d.currentReservation) b.reserved++;
    else                        b.free++;
  }
  const chartData = Array.from(zones.entries()).map(([name, v]) => ({ name, ...v }));

  // Online beacons
  const onlineCount = desks.filter(d => d.isOnline).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-800">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          {new Date().toLocaleDateString('pl-PL', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Zajętość"         value={`${occ?.occupancyPct ?? 0}%`} accent />
        <Stat label="Zajęte biurka"    value={occ?.currentlyOccupied ?? 0}
          sub={`z ${occ?.totalDesks ?? 0} aktywnych`} />
        <Stat label="Rezerwacje dziś"  value={occ?.reservationsToday ?? 0} />
        <Stat label="Beacony online"   value={onlineCount}
          sub={`z ${desks.length} zarejestrowanych`} />
      </div>

      {/* Occupancy by zone */}
      {chartData.length > 0 && (
        <Card className="p-5 mb-6">
          <p className="text-sm font-semibold text-zinc-700 mb-4">Zajętość wg strefy</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }}
                cursor={{ fill: '#f4f4f5' }}
              />
              <Bar dataKey="occupied"  name="Zajęte"       fill="#6366f1" radius={[4,4,0,0]} />
              <Bar dataKey="reserved"  name="Zarezerwowane" fill="#38bdf8" radius={[4,4,0,0]} />
              <Bar dataKey="free"      name="Wolne"         fill="#34d399" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Desk grid preview */}
      <Card className="p-5">
        <p className="text-sm font-semibold text-zinc-700 mb-4">Stan biurek — podgląd</p>
        <div className="flex flex-wrap gap-2">
          {desks.map(d => (
            <div key={d.id} title={`${d.name} · ${d.isOccupied ? 'Zajęte' : d.currentReservation ? 'Zarezerwowane' : 'Wolne'}`}
              className={`
                w-8 h-8 rounded-lg text-xs font-mono flex items-center justify-center
                cursor-default select-none transition-all
                ${!d.isOnline        ? 'bg-zinc-100 text-zinc-300'
                : d.isOccupied       ? 'bg-indigo-500 text-white'
                : d.currentReservation ? 'bg-sky-200 text-sky-700'
                :                       'bg-emerald-100 text-emerald-700'}
              `}>
              {d.code.split('-')[1] ?? d.code.slice(0,2)}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-xs text-zinc-400">
          {[
            { color:'bg-emerald-100', label:'Wolne' },
            { color:'bg-sky-200',     label:'Zarezerwowane' },
            { color:'bg-indigo-500',  label:'Zajęte' },
            { color:'bg-zinc-100',    label:'Offline' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded ${color}`} />
              {label}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

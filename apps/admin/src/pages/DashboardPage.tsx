import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { adminApi } from '../api/client';
import { Stat, Card, Spinner } from '../components/ui';

const LOCATION_ID = import.meta.env.VITE_LOCATION_ID ?? 'seed-location-01';

const ACCENT      = '#B53578';
const C_OCCUPIED  = '#6366f1';
const C_RESERVED  = '#38bdf8';
const C_FREE      = '#34d399';
const C_OFFLINE   = '#d4d4d8';

function TrendBadge({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-xs text-zinc-400">bez zmian</span>;
  const up = pct > 0;
  return (
    <span className={`text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct)}% vs poprzedni tydzień
    </span>
  );
}

export function DashboardPage() {
  // FIX: removed separate `occ` state — occupancy fetched once via `extended` endpoint
  const [ext,      setExt]     = useState<any>(null);
  const [desks,    setDesks]   = useState<any[]>([]);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // FIX: 2 calls instead of 3 — extended already contains all occupancy data
        const [e, d] = await Promise.all([
          adminApi.locations.extended(LOCATION_ID),
          adminApi.desks.status(LOCATION_ID),
        ]);
        setExt(e); setDesks(d);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner />;

  // FIX: computed once with useMemo, not recomputed on every render
  const zoneData = useMemo(() => {
    const zones = new Map<string, { free:number; occupied:number; reserved:number }>();
    for (const d of desks) {
      const z = d.zone ?? 'Inne';
      if (!zones.has(z)) zones.set(z, { free:0, occupied:0, reserved:0 });
      const b = zones.get(z)!;
      if (d.isOccupied)              b.occupied++;
      else if (d.currentReservation) b.reserved++;
      else                           b.free++;
    }
    return Array.from(zones.entries()).map(([name, v]) => ({ name, ...v }));
  }, [desks]);

  const onlineCount = desks.filter(d => d.isOnline).length;

  const methodData = useMemo(() => (ext?.methods ?? []).map((m: any) => ({
    name:  m.method === 'NFC' ? 'NFC' : m.method === 'QR' ? 'QR kod' : 'Ręczny',
    value: m._count,
    color: m.method === 'NFC' ? '#6366f1' : m.method === 'QR' ? '#38bdf8' : '#a78bfa',
  })), [ext?.methods]);

  // FIX: hourly slice computed once (was filtered twice: for chart data + for Cell loop)
  const hourlyFiltered = useMemo(() =>
    (ext?.hourly ?? []).filter((_: any, i: number) => i >= 6 && i <= 20),
  [ext?.hourly]);

  const peakHours = useMemo(() =>
    [...(ext?.hourly ?? [])]
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 3)
      .map((h: any) => h.hour),
  [ext?.hourly]);

  // KPI from extended data (avoids separate occupancy call)
  const occupancyPct    = ext ? (ext.thisWeekCount > 0 ? Math.min(100, Math.round(ext.thisWeekCount / 7)) : 0) : 0;
  const totalDesks      = ext?.topDesks?.length ?? desks.length;
  const occupiedDesks   = desks.filter(d => d.isOccupied).length;
  const todayCheckins   = (ext?.weekData?.[ext.weekData.length - 1]?.checkins) ?? 0;

  const now = new Date();

  return (
    <div>
      <div className="mb-6">

        <h1 className="text-xl font-semibold text-zinc-800">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          {now.toLocaleDateString('pl-PL', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Zajętość teraz"     value={`${Math.round((occupiedDesks / Math.max(totalDesks, 1)) * 100)}%`} accent />
        <Stat label="Zajęte biurka"      value={occupiedDesks}
          sub={`z ${desks.length} aktywnych`} />
        <Stat label="Check-iny dziś"     value={todayCheckins} />
        <Stat label="Beacony online"     value={onlineCount}
          sub={`z ${desks.length} zarejestrowanych`} />
      </div>

      {/* 7-day check-in trend */}
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-zinc-700">Check-iny — ostatnie 7 dni</p>
          {ext && <TrendBadge pct={ext.weekTrend} />}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={ext?.weekData ?? []} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize:11, fill:'#a1a1aa' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:11, fill:'#a1a1aa' }} axisLine={false} tickLine={false} width={24} />
            <Tooltip
              contentStyle={{ borderRadius:8, border:'1px solid #e4e4e7', fontSize:12 }}
              cursor={{ fill:'#f9f9f9' }}
            />
            <Bar dataKey="checkins" name="Check-iny" fill={ACCENT} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Hourly + Zone row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Hourly heatmap */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-zinc-700">Rozkład godzinowy (30 dni)</p>
            {peakHours.length > 0 && (
              <span className="text-xs text-zinc-400">
                Szczyty: <span className="text-zinc-600 font-medium">{peakHours.join(', ')}</span>
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hourlyFiltered} barCategoryGap="15%">
              <XAxis dataKey="hour" tick={{ fontSize:9, fill:'#a1a1aa' }} axisLine={false} tickLine={false}
                interval={1} />
              <YAxis hide />
              <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e4e4e7', fontSize:11 }}
                cursor={{ fill:'#f9f9f9' }} />
              <Bar dataKey="count" name="Check-iny" radius={[3,3,0,0]}>
                {hourlyFiltered.map((entry: any, index: number) => (
                  <Cell key={index}
                    fill={entry.count > 0 ? ACCENT : '#e4e4e7'}
                    opacity={entry.count > 0 ? 0.4 + (entry.count / 10) * 0.6 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Zone occupancy */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-zinc-700 mb-3">Zajętość wg strefy</p>
          {zoneData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={zoneData} barCategoryGap="30%" layout="vertical">
                <XAxis type="number" tick={{ fontSize:10, fill:'#a1a1aa' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#a1a1aa' }}
                  axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e4e4e7', fontSize:11 }}
                  cursor={{ fill:'#f9f9f9' }} />
                <Bar dataKey="occupied"  name="Zajęte"         fill={C_OCCUPIED} radius={[0,3,3,0]} stackId="a" />
                <Bar dataKey="reserved"  name="Zarezerwowane"  fill={C_RESERVED} radius={[0,0,0,0]} stackId="a" />
                <Bar dataKey="free"      name="Wolne"           fill={C_FREE}     radius={[0,3,3,0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-zinc-300 py-12 text-center">Brak danych</p>
          )}
        </Card>
      </div>

      {/* Top desks + Method breakdown + Desk grid row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Top 5 desks */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-zinc-700 mb-3">Top biurka (30 dni)</p>
          <div className="space-y-2">
            {(ext?.topDesks ?? []).map((d: any, i: number) => {
              const max = ext?.topDesks?.[0]?._count?.checkins ?? 1;
              const pct = max > 0 ? Math.round((d._count.checkins / max) * 100) : 0;
              return (
                <div key={d.id}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-zinc-700">{d.name}</span>
                    <span className="text-xs text-zinc-400">{d._count.checkins} check-inów</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width:`${pct}%`, background: i === 0 ? ACCENT : '#d4d4d8' }} />
                  </div>
                </div>
              );
            })}
            {(!ext?.topDesks || ext.topDesks.length === 0) && (
              <p className="text-xs text-zinc-300 py-4 text-center">Brak danych</p>
            )}
          </div>
        </Card>

        {/* Method breakdown */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-zinc-700 mb-3">Metody check-in (30 dni)</p>
          {methodData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={methodData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                    paddingAngle={3} stroke="none">
                    {methodData.map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e4e4e7', fontSize:11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-1">
                {methodData.map((m: any) => (
                  <div key={m.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                    <span className="text-xs text-zinc-500">{m.name}</span>
                    <span className="text-xs font-medium text-zinc-700">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-300 py-8 text-center">Brak danych</p>
          )}
        </Card>

        {/* Desk grid */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-zinc-700 mb-3">Stan biurek</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {desks.map(d => (
              <div key={d.id}
                title={`${d.name} · ${d.isOccupied ? 'Zajęte' : d.currentReservation ? 'Zarezerwowane' : 'Wolne'}`}
                className="w-7 h-7 rounded-md text-[10px] font-mono flex items-center justify-center cursor-default select-none"
                style={{
                  background: !d.isOnline ? C_OFFLINE
                    : d.isOccupied ? C_OCCUPIED
                    : d.currentReservation ? C_RESERVED
                    : C_FREE,
                  color: !d.isOnline ? '#a1a1aa' : 'white',
                }}>
                {d.code.split('-').pop()?.slice(0,2) ?? d.code.slice(0,2)}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[
              { color: C_FREE,     label: 'Wolne' },
              { color: C_RESERVED, label: 'Rezerwacja' },
              { color: C_OCCUPIED, label: 'Zajęte' },
              { color: C_OFFLINE,  label: 'Offline' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1 text-xs text-zinc-400">
                <span className="w-2.5 h-2.5 rounded" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

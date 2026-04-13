import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { appApi } from '../api/client';
import { Stat, Card, Spinner } from '../components/ui';

const ACCENT      = '#B53578';
const C_OCCUPIED  = '#6366f1';
const C_RESERVED  = '#38bdf8';
const C_FREE      = '#34d399';
const C_OFFLINE   = '#d4d4d8';

function TrendBadge({ pct }: { pct: number }) {
  const { t } = useTranslation();
  if (pct === 0) return <span className="text-xs text-zinc-400">{t('dashboard.trend.no_change')}</span>;
  const up = pct > 0;
  return (
    <span className={`text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct)}% {t('dashboard.trend.vs_prev')}
    </span>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  // FIX: read inside component — module-level read is stale after location switch
  const LOCATION_ID =
    localStorage.getItem('desks_loc') ??
    import.meta.env.VITE_LOCATION_ID ??
    'seed-location-01';

  const [ext,      setExt]     = useState<any>(null);
  const [desks,    setDesks]   = useState<any[]>([]);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // FIX: 2 calls instead of 3 — extended already contains all occupancy data
        const [e, d] = await Promise.all([
          appApi.locations.extended(LOCATION_ID),
          appApi.desks.status(LOCATION_ID),
        ]);
        setExt(e); setDesks(d?.desks ?? d);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  // ── All hooks must be BEFORE any conditional return ────────
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

  const onlineCount = useMemo(() => desks.filter(d => d.isOnline).length, [desks]);

  const methodData = useMemo(() => (ext?.methods ?? []).map((m: any) => ({
    name: t(`methods.${m.method}`),
    value: m._count,
    color: m.method === 'NFC' ? '#6366f1' : m.method === 'QR' ? '#38bdf8' : '#a78bfa',
  })), [ext?.methods, t]);

  const hourlyFiltered = useMemo(() =>
    (ext?.hourly ?? []).filter((_: any, i: number) => i >= 6 && i <= 20),
  [ext?.hourly]);

  const peakHours = useMemo(() =>
    [...(ext?.hourly ?? [])]
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 3)
      .map((h: any) => h.hour),
  [ext?.hourly]);

  const occupiedDesks = useMemo(() => desks.filter(d => d.isOccupied).length, [desks]);
  const todayCheckins = ext?.weekData?.[ext.weekData.length - 1]?.checkins ?? 0;
  const now           = new Date();

  // ── Early return AFTER all hooks ──────────────────────────
  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-6">

        <h1 className="text-xl font-semibold text-zinc-800">{t('pages.dashboard.title')}</h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          {now.toLocaleDateString(i18n.language?.startsWith('pl') ? 'pl-PL' : 'en-US', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label={t('dashboard.kpi.occupancy_now')} value={`${Math.round((occupiedDesks / Math.max(desks.length, 1)) * 100)}%`} accent />
        <Stat label={t('dashboard.kpi.occupied_desks')} value={occupiedDesks}
          sub={t('dashboard.kpi.of_active', { count: desks.length })} />
        <Stat label={t('dashboard.kpi.checkins_today')} value={todayCheckins} />
        <Stat label={t('dashboard.kpi.beacons_online')} value={onlineCount}
          sub={t('dashboard.kpi.registered_of', { count: desks.length })} />
      </div>

      {/* 7-day check-in trend */}
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-zinc-700">{t('dashboard.checkins_title')}</p>
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
            <Bar dataKey="checkins" name={t('dashboard.checkins')} fill={ACCENT} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Hourly + Zone row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Hourly heatmap */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-zinc-700">{t('dashboard.hourly.title')}</p>
            {peakHours.length > 0 && (
              <span className="text-xs text-zinc-400">
                {t('dashboard.hourly.peaks')}: <span className="text-zinc-600 font-medium">{peakHours.join(', ')}</span>
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
          <p className="text-sm font-semibold text-zinc-700 mb-3">{t('dashboard.zone.title')}</p>
          {zoneData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={zoneData} barCategoryGap="30%" layout="vertical">
                <XAxis type="number" tick={{ fontSize:10, fill:'#a1a1aa' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#a1a1aa' }}
                  axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e4e4e7', fontSize:11 }}
                  cursor={{ fill:'#f9f9f9' }} />
                <Bar dataKey="occupied"  name={t('dashboard.zone.occupied')}         fill={C_OCCUPIED} radius={[0,3,3,0]} stackId="a" />
                <Bar dataKey="reserved"  name={t('dashboard.zone.reserved')}         fill={C_RESERVED} radius={[0,0,0,0]} stackId="a" />
                <Bar dataKey="free"      name={t('dashboard.zone.free')}             fill={C_FREE}     radius={[0,3,3,0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-zinc-300 py-12 text-center">{t('dashboard.no_data')}</p>
          )}
        </Card>
      </div>

      {/* Top desks + Method breakdown + Desk grid row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Top 5 desks */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-zinc-700 mb-3">{t('dashboard.top.title')}</p>
          <div className="space-y-2">
            {(ext?.topDesks ?? []).map((d: any, i: number) => {
              const max = ext?.topDesks?.[0]?._count?.checkins ?? 1;
              const pct = max > 0 ? Math.round((d._count.checkins / max) * 100) : 0;
              return (
                <div key={d.id}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-zinc-700">{d.name}</span>
                    <span className="text-xs text-zinc-400">{d._count.checkins} {t('dashboard.top.checkins_suffix')}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width:`${pct}%`, background: i === 0 ? ACCENT : '#d4d4d8' }} />
                  </div>
                </div>
              );
            })}
            {(!ext?.topDesks || ext.topDesks.length === 0) && (
              <p className="text-xs text-zinc-300 py-4 text-center">{t('dashboard.no_data')}</p>
            )}
          </div>
        </Card>

        {/* Method breakdown */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-zinc-700 mb-3">{t('dashboard.methods.title')}</p>
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
                    <span className="text-xs text-zinc-500">{t(`methods.${m.name}`)}</span>
                    <span className="text-xs font-medium text-zinc-700">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-300 py-8 text-center">{t('dashboard.no_data')}</p>
          )}
        </Card>

        {/* Desk grid */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-zinc-700 mb-3">{t('dashboard.state.title')}</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {desks.map(d => (
              <div key={d.id}
                title={`${d.name} · ${d.isOccupied ? t('dashboard.legend.occupied') : d.currentReservation ? t('dashboard.legend.reserved') : t('dashboard.legend.free')}`}
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
            {
              const legend = [
                { color: C_FREE,     key: 'free' },
                { color: C_RESERVED, key: 'reserved' },
                { color: C_OCCUPIED, key: 'occupied' },
                { color: C_OFFLINE,  key: 'offline' },
              ];
              legend.map(({ color, key }) => (
                <span key={key} className="flex items-center gap-1 text-xs text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded" style={{ background: color }} />
                  {t(`dashboard.legend.${key}`)}
                </span>
              ))
            }
          </div>
        </Card>
      </div>
    </div>
  );
}

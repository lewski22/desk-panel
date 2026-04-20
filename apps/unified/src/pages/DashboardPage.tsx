/**
 * DashboardPage — Sprint A1
 * - KPI cards z trendem (↑↓) i tooltipem poprzedniego tygodnia
 * - Quick Actions strip: Zarezerwuj / Check-in / Ogłoszenie
 * - "Today's Issues" widget (zastępuje Desk Grid)
 * - Hourly heatmap z mobilnym uproszczeniem
 */
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { appApi } from '../api/client';
import { Stat, Card, Spinner, Modal, Btn, EmptyState } from '../components/ui';
import { format, formatDistanceToNow } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';

// ── Stałe kolorów ────────────────────────────────────────────
const ACCENT     = '#B53578';
const C_OCCUPIED = '#6366f1';
const C_RESERVED = '#38bdf8';
const C_FREE     = '#34d399';

// ── Helpers ──────────────────────────────────────────────────
function useRole() {
  return useMemo(() => {
    try { return JSON.parse(localStorage.getItem('app_user') ?? 'null')?.role ?? ''; } catch { return ''; }
  }, []);
}

function useLocationId() {
  return useMemo(() =>
    localStorage.getItem('desks_loc') ?? import.meta.env.VITE_LOCATION_ID ?? 'seed-location-01',
  []);
}

// ── Trend Badge ───────────────────────────────────────────────
function TrendBadge({ pct, prevLabel }: { pct: number; prevLabel?: string }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  if (pct === 0) return <span className="text-[11px] text-zinc-400">→ 0%</span>;
  const up   = pct > 0;
  const good = up; // dla check-inów i zajętości ↑ to dobra informacja

  return (
    <span ref={ref} className="relative inline-block"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded cursor-default ${
        good ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
      }`}>
        {up ? '↑' : '↓'} {Math.abs(pct)}%
      </span>
      {show && prevLabel && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap
          bg-zinc-800 text-white text-[10px] rounded-lg px-2 py-1 shadow-lg z-50 pointer-events-none">
          {prevLabel}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
        </span>
      )}
    </span>
  );
}

// ── KPI Card rozszerzony ─────────────────────────────────────
function KpiCard({
  label, value, sub, accent, trend, prevValue,
}: {
  label: string; value: string | number; sub?: string;
  accent?: boolean; trend?: number; prevValue?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${
      accent ? 'bg-[#B53578] border-[#B53578] text-white' : 'bg-white border-zinc-100'
    }`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${accent ? 'text-white/70' : 'text-zinc-400'}`}>
        {label}
      </p>
      <p className={`text-2xl font-bold font-mono ${accent ? 'text-white' : 'text-zinc-800'}`}>
        {value}
      </p>
      <div className="flex items-center gap-2">
        {sub && <span className={`text-xs ${accent ? 'text-white/60' : 'text-zinc-400'}`}>{sub}</span>}
        {trend !== undefined && !accent && (
          <TrendBadge pct={trend}
            prevLabel={prevValue ? `${t('dashboard.trend.prev')}: ${prevValue}` : undefined} />
        )}
      </div>
    </div>
  );
}

// ── Quick Actions ─────────────────────────────────────────────
function QuickActions({ locationId, onRefresh }: { locationId: string; onRefresh: () => void }) {
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const role     = useRole();
  const [announcing, setAnnouncing] = useState(false);
  const [annTitle,   setAnnTitle]   = useState('');
  const [annBody,    setAnnBody]    = useState('');
  const [annSending, setAnnSending] = useState(false);
  const [annOk,      setAnnOk]      = useState(false);

  const isAdmin = ['SUPER_ADMIN','OFFICE_ADMIN'].includes(role);
  if (!isAdmin) return null;

  const sendAnn = async () => {
    if (!annTitle.trim() || !annBody.trim()) return;
    setAnnSending(true);
    try {
      await appApi.inapp.announce({ title: annTitle, body: annBody, targetRoles: ['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'] });
      setAnnOk(true);
      setTimeout(() => { setAnnouncing(false); setAnnOk(false); setAnnTitle(''); setAnnBody(''); }, 1500);
    } catch {}
    setAnnSending(false);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => navigate('/map')}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#B53578] text-white rounded-xl text-xs font-semibold hover:bg-[#9d2d67] transition-colors shadow-sm">
          + {t('dashboard.qa.book')}
        </button>
        <button onClick={() => navigate('/reservations')}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold hover:bg-zinc-50 transition-colors">
          ✋ {t('dashboard.qa.checkin')}
        </button>
        <button onClick={() => setAnnouncing(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold hover:bg-zinc-50 transition-colors">
          📢 {t('dashboard.qa.announce')}
        </button>
      </div>

      {announcing && (
        <Modal title={t('notifications.rules.announce')} onClose={() => setAnnouncing(false)}>
          {annOk ? (
            <p className="text-emerald-600 font-semibold text-center py-4">✓ {t('notifications.rules.saved')}</p>
          ) : (
            <div className="space-y-3">
              <input value={annTitle} onChange={e => setAnnTitle(e.target.value)}
                placeholder={t('dashboard.qa.ann_title_ph')}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              <textarea value={annBody} onChange={e => setAnnBody(e.target.value)} rows={3}
                placeholder={t('dashboard.qa.ann_body_ph')}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none" />
              <div className="flex justify-end gap-2">
                <Btn variant="secondary" onClick={() => setAnnouncing(false)}>{t('btn.cancel')}</Btn>
                <Btn onClick={sendAnn} loading={annSending}
                  disabled={!annTitle.trim() || !annBody.trim()}>
                  {t('dashboard.qa.send')}
                </Btn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

// ── Today's Issues Widget ─────────────────────────────────────
const ISSUE_ICONS: Record<string, string> = {
  BEACON_OFFLINE: '🔴',
  LONG_CHECKIN:   '⏰',
  OTA_FAILED:     '🆙',
  NO_CHECKIN:     '📋',
};
const ISSUE_COLOR: Record<string, string> = {
  BEACON_OFFLINE: 'border-red-200 bg-red-50',
  LONG_CHECKIN:   'border-amber-200 bg-amber-50',
  OTA_FAILED:     'border-orange-200 bg-orange-50',
  NO_CHECKIN:     'border-blue-200 bg-blue-50',
};

function IssuesWidget({ locationId }: { locationId: string }) {
  const { t, i18n } = useTranslation();
  const navigate    = useNavigate();
  const [issues, setIssues]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const dfnsLocale = i18n.language === 'en' ? enUS : pl;

  useEffect(() => {
    if (!locationId) return;
    appApi.locations.issues(locationId)
      .then(setIssues)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  const allIssues = useMemo(() => {
    if (!issues) return [];
    return [
      ...issues.beaconsOffline,
      ...issues.longCheckins,
      ...issues.otaFailed,
      ...issues.noCheckins,
    ];
  }, [issues]);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-zinc-700">{t('dashboard.issues.title')}</p>
        {!loading && allIssues.length > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
            {allIssues.length}
          </span>
        )}
      </div>

      {loading && <div className="py-8 flex justify-center"><div className="w-4 h-4 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" /></div>}

      {!loading && allIssues.length === 0 && (
        <EmptyState
          icon="✅"
          title={t('dashboard.issues.all_ok')}
          sub={t('dashboard.issues.all_ok_sub')}
        />
      )}

      {!loading && allIssues.length > 0 && (
        <div className="space-y-2">
          {allIssues.map(issue => (
            <button key={`${issue.type}-${issue.id}`}
              onClick={() => navigate(issue.navTo)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all hover:shadow-sm ${ISSUE_COLOR[issue.type]}`}>
              <span className="text-base flex-shrink-0">{ISSUE_ICONS[issue.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-700 truncate">
                  {t(`dashboard.issues.type.${issue.type}`)} — {issue.label}
                </p>
                {issue.detail && (
                  <p className="text-[10px] text-zinc-500 truncate">{issue.detail}</p>
                )}
              </div>
              {issue.since && (
                <span className="text-[10px] text-zinc-400 flex-shrink-0">
                  {formatDistanceToNow(new Date(issue.since), { locale: dfnsLocale, addSuffix: true })}
                </span>
              )}
              <span className="text-zinc-400 flex-shrink-0">›</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Hourly chart — mobile simplified ─────────────────────────
function HourlyChart({ hourly }: { hourly: any[] }) {
  const { t } = useTranslation();
  const isMobile = window.innerWidth < 640;

  const data = useMemo(() => {
    if (!hourly?.length) return [];
    if (!isMobile) return hourly.filter((_: any, i: number) => i >= 6 && i <= 20);
    // Mobile: aggegate into 3 slots
    const sum = (from: number, to: number) =>
      hourly.slice(from, to).reduce((acc: number, h: any) => acc + h.count, 0);
    return [
      { hour: t('dashboard.hourly.morning'), count: sum(8, 12) },
      { hour: t('dashboard.hourly.noon'),    count: sum(12,16) },
      { hour: t('dashboard.hourly.evening'), count: sum(16,21) },
    ];
  }, [hourly, isMobile]);

  const peakHours = useMemo(() =>
    [...(hourly ?? [])].sort((a: any, b: any) => b.count - a.count).slice(0, 3).map((h: any) => h.hour),
  [hourly]);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-zinc-700">{t('dashboard.hourly.title')}</p>
        {peakHours.length > 0 && !isMobile && (
          <span className="text-xs text-zinc-400">
            {t('dashboard.hourly.peaks')}: <span className="text-zinc-600 font-medium">{peakHours.join(', ')}</span>
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barCategoryGap={isMobile ? '25%' : '15%'}>
          <XAxis dataKey="hour" tick={{ fontSize: isMobile ? 10 : 9, fill:'#a1a1aa' }}
            axisLine={false} tickLine={false} interval={isMobile ? 0 : 1} />
          <YAxis hide />
          <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e4e4e7', fontSize:11 }}
            cursor={{ fill:'#f9f9f9' }} />
          <Bar dataKey="count" name={t('dashboard.checkins')} radius={[3,3,0,0]}>
            {data.map((entry: any, index: number) => (
              <Cell key={index} fill={entry.count > 0 ? ACCENT : '#e4e4e7'}
                opacity={entry.count > 0 ? 0.4 + (entry.count / Math.max(...data.map((d: any) => d.count), 1)) * 0.6 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locationId   = useLocationId();
  const role         = useRole();
  const isAdmin      = ['SUPER_ADMIN','OFFICE_ADMIN'].includes(role);
  const locale       = i18n.language === 'en' ? 'en-GB' : 'pl-PL';

  const [ext,          setExt]          = useState<any>(null);
  const [desks,        setDesks]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [e, d] = await Promise.all([
        appApi.locations.extended(locationId),
        appApi.desks.status(locationId),
      ]);
      setExt(e);
      setDesks(d?.desks ?? d ?? []);
      setLastRefreshed(new Date());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const zoneData = useMemo(() => {
    const zones = new Map<string, { free:number; occupied:number; reserved:number }>();
    for (const d of desks) {
      const z = d.zone ?? t('dashboard.zone.other');
      if (!zones.has(z)) zones.set(z, { free:0, occupied:0, reserved:0 });
      const b = zones.get(z)!;
      if (d.isOccupied)              b.occupied++;
      else if (d.currentReservation) b.reserved++;
      else                           b.free++;
    }
    return Array.from(zones.entries()).map(([name, v]) => ({ name, ...v }));
  }, [desks, t]);

  const methodData = useMemo(() =>
    (ext?.methods ?? []).map((m: any) => ({
      name:  m.method,
      label: t(`methods.${m.method}`, m.method),
      value: m._count,
      color: m.method === 'NFC' ? '#6366f1' : m.method === 'QR' ? '#38bdf8' : '#a78bfa',
    })),
  [ext?.methods, i18n.language]);

  const occupiedDesks = useMemo(() => desks.filter(d => d.isOccupied).length, [desks]);
  const todayCheckins = ext?.weekData?.[ext.weekData.length - 1]?.checkins ?? 0;
  const onlineCount   = useMemo(() => desks.filter(d => d.isOnline).length, [desks]);

  if (loading) return <Spinner />;

  const now = new Date();

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">{t('pages.dashboard.title')}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {now.toLocaleDateString(locale, { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1 shrink-0">
          {lastRefreshed && (
            <span className="text-[11px] text-zinc-400 hidden sm:block">
              {lastRefreshed.toLocaleTimeString(locale, { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-40"
            title={t('btn.refresh') ?? 'Refresh'}
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.7 2.3A7 7 0 1 0 15 8" />
              <path d="M11 2h3V5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quick Actions — tylko dla Admin+ */}
      <QuickActions locationId={locationId} onRefresh={load} />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard
          label={t('dashboard.kpi.occupancy_now')}
          value={`${Math.round((occupiedDesks / Math.max(desks.length, 1)) * 100)}%`}
          accent
        />
        <KpiCard
          label={t('dashboard.kpi.occupied_desks')}
          value={occupiedDesks}
          sub={t('dashboard.kpi.of_active', { count: desks.length })}
          trend={ext?.weekTrend}
          prevValue={ext?.lastWeekCount !== undefined ? String(ext.lastWeekCount) : undefined}
        />
        <KpiCard
          label={t('dashboard.kpi.checkins_today')}
          value={todayCheckins}
          trend={ext?.weekTrend}
        />
        <KpiCard
          label={t('dashboard.kpi.beacons_online')}
          value={onlineCount}
          sub={t('dashboard.kpi.registered_of', { count: desks.length })}
        />
      </div>

      {/* 7-day trend chart */}
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-zinc-700">{t('dashboard.checkins_title')}</p>
          {ext && (
            <TrendBadge pct={ext.weekTrend}
              prevLabel={ext.lastWeekCount !== undefined
                ? `${t('dashboard.trend.prev')}: ${ext.lastWeekCount} ${t('dashboard.checkins')}`
                : undefined}
            />
          )}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={ext?.weekData ?? []} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize:11, fill:'#a1a1aa' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:11, fill:'#a1a1aa' }} axisLine={false} tickLine={false} width={24} />
            <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e4e4e7', fontSize:12 }}
              cursor={{ fill:'#f9f9f9' }} />
            <Bar dataKey="checkins" name={t('dashboard.checkins')} fill={ACCENT} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Middle row: Hourly + Zone + Issues */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        <HourlyChart hourly={ext?.hourly} />

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
                <Bar dataKey="occupied" name={t('dashboard.zone.occupied')} fill={C_OCCUPIED} radius={[0,3,3,0]} stackId="a" />
                <Bar dataKey="reserved" name={t('dashboard.zone.reserved')} fill={C_RESERVED} stackId="a" />
                <Bar dataKey="free"     name={t('dashboard.zone.free')}     fill={C_FREE}     radius={[0,3,3,0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon="📊" title={t('dashboard.no_data')} />
          )}
        </Card>

        {/* Today's Issues */}
        <IssuesWidget locationId={locationId} />
      </div>

      {/* Bottom row: Top desks + Methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className="h-full rounded-full" style={{ width:`${pct}%`, background: i === 0 ? ACCENT : '#d4d4d8' }} />
                  </div>
                </div>
              );
            })}
            {(!ext?.topDesks || ext.topDesks.length === 0) && (
              <EmptyState icon="📊" title={t('dashboard.no_data')} />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-zinc-700 mb-3">{t('dashboard.methods.title')}</p>
          {methodData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={methodData} dataKey="value" nameKey="label"
                    cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} stroke="none">
                    {methodData.map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e4e4e7', fontSize:11 }}
                    formatter={(val: any, name: any) => [val, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-1 flex-wrap justify-center">
                {methodData.map((m: any) => (
                  <div key={m.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                    <span className="text-xs text-zinc-500">{m.label}</span>
                    <span className="text-xs font-semibold text-zinc-700">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon="📊" title={t('dashboard.no_data')} />
          )}
        </Card>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { appApi }            from '../api/client';
import { Card, EmptyState, Spinner } from '../components/ui';
import { InsightsWidget }            from '../components/insights/InsightsWidget';

// ── Constants ─────────────────────────────────────────────────────
const ACCENT   = 'var(--brand)';
const DAYS_PL  = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
const DAYS_EN  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const METHOD_COLORS: Record<string, string> = {
  NFC:     '#6366f1',
  QR:      '#38bdf8',
  WEB:     '#34d399',
  MANUAL:  '#f59e0b',
  UNKNOWN: '#a1a1aa',
};
const TABS = ['snapshot', 'heatmap', 'reservations', 'methods', 'by_user', 'by_desk', 'utilization', 'insights'] as const;
type Tab = typeof TABS[number];

// ── Utils ──────────────────────────────────────────────────────────
function todayStr()    { return new Date().toISOString().slice(0, 10); }
function monthAgoStr() {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}
function cellColor(count: number, max: number): string {
  if (max === 0 || count === 0) return 'hsl(220 14% 94%)';
  const t = count / max;
  return `hsl(248 ${Math.round(40 + t * 40)}% ${Math.round(90 - t * 55)}%)`;
}
function downloadCsv(rows: string[][], filename: string) {
  const csv  = rows.map(r => r.map(v => (String(v).includes(',') ? `"${v}"` : v)).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Shared filter bar props ────────────────────────────────────────
interface Filters { from: string; to: string; locationId: string }

// ── Snapshot Tab — KPI bieżącego dnia (dane na żywo z dashboardu) ─
interface SnapshotRow {
  locationId: string; locationName: string;
  totalDesks: number; occupiedNow: number; occupancyPct: number;
  checkinsToday: number; reservationsToday: number;
  zones: { zone: string; total: number; occupied: number }[];
}

function SnapshotTab({ filters }: { filters: Filters }) {
  const { t } = useTranslation();
  const [data, setData]       = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filters.locationId) params.locationId = filters.locationId;
      const rows = await appApi.reports.get('/snapshot', params);
      setData(rows ?? []);
    } catch {}
    setLoading(false);
  }, [filters.locationId]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const header = [
      t('reports.snapshot.location'), t('reports.snapshot.total_desks'),
      t('reports.snapshot.occupied_now'), t('reports.snapshot.occupancy_pct'),
      t('reports.snapshot.checkins_today'), t('reports.snapshot.reservations_today'),
    ];
    const rows = data.map(r => [
      r.locationName, String(r.totalDesks), String(r.occupiedNow),
      `${r.occupancyPct}%`, String(r.checkinsToday), String(r.reservationsToday),
    ]);
    downloadCsv([header, ...rows], `snapshot-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">{t('reports.snapshot.hint')}</p>
        {data.length > 0 && (
          <button onClick={exportCsv}
            className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50">
            {t('reports.export.csv')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <EmptyState icon="📊" title={t('reports.no_data')} />
      ) : (
        <div className="space-y-4">
          {data.map(loc => (
            <Card key={loc.locationId} className="p-5">
              <p className="text-sm font-semibold text-zinc-700 mb-4">{loc.locationName}</p>

              {/* KPI grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                {[
                  { label: t('reports.snapshot.total_desks'),        value: loc.totalDesks,        color: 'text-zinc-700' },
                  { label: t('reports.snapshot.occupied_now'),       value: loc.occupiedNow,       color: 'text-indigo-600' },
                  { label: t('reports.snapshot.occupancy_pct'),      value: `${loc.occupancyPct}%`, color: loc.occupancyPct > 80 ? 'text-red-600' : 'text-emerald-600' },
                  { label: t('reports.snapshot.checkins_today'),     value: loc.checkinsToday,     color: 'text-zinc-700' },
                  { label: t('reports.snapshot.reservations_today'), value: loc.reservationsToday, color: 'text-zinc-700' },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">{kpi.label}</p>
                    <p className={`text-2xl font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Occupancy bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-400">{t('reports.snapshot.occupancy_bar')}</span>
                  <span className="text-xs font-semibold text-zinc-600">{loc.occupiedNow}/{loc.totalDesks}</span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${loc.occupancyPct}%`, background: loc.occupancyPct > 80 ? '#ef4444' : ACCENT }} />
                </div>
              </div>

              {/* Zones */}
              {loc.zones.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {loc.zones.map(z => (
                    <div key={z.zone} className="border border-zinc-100 rounded-lg px-3 py-2">
                      <p className="text-xs font-medium text-zinc-600 truncate mb-1">{z.zone}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">{z.occupied}/{z.total}</span>
                        <span className="text-xs font-semibold text-zinc-600">
                          {z.total > 0 ? `${Math.round((z.occupied / z.total) * 100)}%` : '—'}
                        </span>
                      </div>
                      <div className="h-1 bg-zinc-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: z.total > 0 ? `${Math.round((z.occupied / z.total) * 100)}%` : '0%', background: ACCENT }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Heatmap Tab ────────────────────────────────────────────────────
function HeatmapTab({ filters, onExport, exporting }: {
  filters: Filters;
  onExport: (fmt: 'csv' | 'xlsx') => void;
  exporting: boolean;
}) {
  const { t, i18n }   = useTranslation();
  const DAYS           = i18n.language === 'pl' ? DAYS_PL : DAYS_EN;
  const [cells, setCells] = useState<{ day: number; hour: number; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { from: filters.from, to: filters.to };
      if (filters.locationId) params.locationId = filters.locationId;
      const data = await appApi.reports.heatmap(params);
      setCells(data);
    } catch {}
    setLoading(false);
  }, [filters.from, filters.to, filters.locationId]);

  useEffect(() => { load(); }, [load]);

  const maxCount  = useMemo(() => Math.max(...cells.map(c => c.count), 1), [cells]);
  const heatLookup = useMemo(() => new Map(cells.map(c => [`${c.day}:${c.hour}`, c.count])), [cells]);
  const hours      = Array.from({ length: 24 }, (_, i) => i);
  const total      = cells.reduce((s, c) => s + c.count, 0);

  const peakDay = useMemo(() => {
    const byDay = DAYS.map((_, d) => cells.filter(c => c.day === d).reduce((s, c) => s + c.count, 0));
    const max   = Math.max(...byDay);
    return `${DAYS[byDay.indexOf(max)]} (${max})`;
  }, [cells, DAYS]);

  const peakHour = useMemo(() => {
    const byHour = hours.map(h => cells.filter(c => c.hour === h).reduce((s, c) => s + c.count, 0));
    const max    = Math.max(...byHour);
    return `${byHour.indexOf(max)}:00 (${max})`;
  }, [cells]);

  return (
    <div className="space-y-4">
      {/* Export */}
      <div className="flex gap-2">
        <button onClick={() => onExport('csv')} disabled={exporting}
          className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50">
          {t('reports.export.csv')}
        </button>
        <button onClick={() => onExport('xlsx')} disabled={exporting}
          className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50">
          {t('reports.export.xlsx')}
        </button>
        {exporting && <span className="text-xs text-zinc-400 self-center">{t('reports.export.loading')}</span>}
      </div>

      {/* Heatmap grid */}
      <Card className="p-5">
        <p className="text-sm font-semibold text-zinc-700 mb-4">{t('reports.heatmap.title')}</p>
        {loading ? (
          <div className="py-12 flex justify-center"><div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* Desktop/tablet: full day×hour matrix */}
            <div className="hidden sm:block scroll-x-fade">
              <div className="grid gap-[2px] min-w-[700px]" style={{ gridTemplateColumns: '52px repeat(24, 1fr)' }}>
                <div />
                {hours.map(h => (
                  <div key={h} className="text-center text-[10px] text-zinc-400 pb-1">
                    {h % 3 === 0 ? `${h}h` : ''}
                  </div>
                ))}
                {DAYS.map((dayLabel, dayIdx) => (
                  <>
                    <div key={`lbl-${dayIdx}`} className={`text-xs flex items-center pr-2 ${dayIdx < 5 ? 'text-zinc-500' : 'text-zinc-700 font-medium'}`}>
                      {dayLabel}
                    </div>
                    {hours.map(hour => {
                      const count = heatLookup.get(`${dayIdx}:${hour}`) ?? 0;
                      return (
                        <div
                          key={`${dayIdx}-${hour}`}
                          title={`${dayLabel} ${hour}:00 — ${count}`}
                          className="aspect-square rounded-[3px]"
                          style={{ background: cellColor(count, maxCount) }}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
            </div>

            {/* Mobile: working hours only (8–20), grouped view */}
            <div className="sm:hidden">
              <div className="grid gap-[2px]" style={{ gridTemplateColumns: '40px repeat(12, 1fr)' }}>
                <div />
                {Array.from({ length: 12 }, (_, i) => i + 8).map(h => (
                  <div key={h} className="text-center text-[9px] text-zinc-400 pb-1">
                    {h % 2 === 0 ? `${h}` : ''}
                  </div>
                ))}
                {DAYS.map((dayLabel, dayIdx) => (
                  <>
                    <div key={`lbl-${dayIdx}`} className={`text-[10px] flex items-center pr-1 ${dayIdx < 5 ? 'text-zinc-500' : 'text-zinc-700 font-medium'}`}>
                      {dayLabel}
                    </div>
                    {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => {
                      const count = heatLookup.get(`${dayIdx}:${hour}`) ?? 0;
                      return (
                        <div
                          key={`${dayIdx}-${hour}`}
                          title={`${dayLabel} ${hour}:00 — ${count}`}
                          className="aspect-square rounded-[2px]"
                          style={{ background: cellColor(count, maxCount) }}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
              <p className="text-[10px] text-zinc-400 mt-2 text-center">08:00 – 20:00</p>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-1.5 mt-3">
              <span className="text-[11px] text-zinc-400">0</span>
              {[0, 0.25, 0.5, 0.75, 1].map(v => (
                <div key={v} className="w-5 h-3 rounded-sm" style={{ background: cellColor(v * maxCount, maxCount) }} />
              ))}
              <span className="text-[11px] text-zinc-400">{maxCount}</span>
            </div>
          </>
        )}
      </Card>

      {/* Summary stats */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t('reports.heatmap.total'),      value: total.toLocaleString() },
            { label: t('reports.heatmap.peak_day'),   value: peakDay },
            { label: t('reports.heatmap.peak_hour'),  value: peakHour },
            { label: t('reports.heatmap.active_hrs'), value: String(cells.filter(c => c.count > 0).length) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
              <p className="text-xs text-zinc-400 mb-1">{label}</p>
              <p className="text-xl font-bold font-mono text-zinc-800">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reservations Tab ───────────────────────────────────────────────
function ReservationsTab({ filters }: { filters: Filters }) {
  const { t } = useTranslation();
  const [data, setData]       = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { from: filters.from, to: filters.to };
      if (filters.locationId) params.locationId = filters.locationId;
      const rows = await appApi.reports.get('/reservations', params);
      setData(rows);
    } catch {}
    setLoading(false);
  }, [filters.from, filters.to, filters.locationId]);

  useEffect(() => { load(); }, [load]);

  const total = data.reduce((s, r) => s + r.count, 0);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-700">{t('reports.reservations.title')}</p>
        {total > 0 && (
          <span className="text-xs text-zinc-400">
            {t('reports.heatmap.total')}: <span className="font-semibold text-zinc-600">{total.toLocaleString()}</span>
          </span>
        )}
      </div>
      {loading ? (
        <div className="py-12 flex justify-center"><div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <EmptyState icon="📅" title={t('reports.no_data')} />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false}
              interval={Math.floor(data.length / 10)} />
            <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }}
              cursor={{ fill: '#f9f9f9' }} />
            <Bar dataKey="count" name={t('reports.reservations.count')} fill={ACCENT} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ── Methods Tab ────────────────────────────────────────────────────
function MethodsTab({ filters }: { filters: Filters }) {
  const { t } = useTranslation();
  const [data, setData]       = useState<{ method: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { from: filters.from, to: filters.to };
      if (filters.locationId) params.locationId = filters.locationId;
      const rows = await appApi.reports.get('/by-method', params);
      setData(rows);
    } catch {}
    setLoading(false);
  }, [filters.from, filters.to, filters.locationId]);

  useEffect(() => { load(); }, [load]);

  const total = data.reduce((s, r) => s + r.count, 0);

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-zinc-700 mb-4">{t('reports.methods.title')}</p>
      {loading ? (
        <div className="py-12 flex justify-center"><div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <EmptyState icon="📊" title={t('reports.no_data')} />
      ) : (
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <ResponsiveContainer width={200} height={200} className="shrink-0">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="method"
                cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none">
                {data.map((entry, i) => (
                  <Cell key={i} fill={METHOD_COLORS[entry.method] ?? METHOD_COLORS.UNKNOWN} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 w-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{t('reports.methods.method')}</th>
                  <th className="text-right py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{t('reports.methods.count')}</th>
                  <th className="text-right py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">%</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.method} className="border-b border-zinc-50">
                    <td className="py-2 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: METHOD_COLORS[row.method] ?? METHOD_COLORS.UNKNOWN }} />
                      <span className="font-medium text-zinc-700">{row.method}</span>
                    </td>
                    <td className="py-2 text-right font-mono text-zinc-700">{row.count}</td>
                    <td className="py-2 text-right text-zinc-400">
                      {total > 0 ? `${Math.round((row.count / total) * 100)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── By User Tab ────────────────────────────────────────────────────
function ByUserTab({ filters }: { filters: Filters }) {
  const { t } = useTranslation();
  const [data, setData]       = useState<{ userId: string; email: string; firstName: string | null; lastName: string | null; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { from: filters.from, to: filters.to };
      if (filters.locationId) params.locationId = filters.locationId;
      const rows = await appApi.reports.get('/by-user', params);
      setData(rows);
    } catch {}
    setLoading(false);
  }, [filters.from, filters.to, filters.locationId]);

  useEffect(() => { load(); }, [load]);

  const maxCount = data[0]?.count ?? 1;

  const exportCsv = () => {
    const header = [t('reports.by_user.user'), 'Email', t('reports.by_user.count')];
    const rows   = data.map(r => [
      [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email,
      r.email,
      String(r.count),
    ]);
    downloadCsv([header, ...rows], `report-by-user-${filters.from}-${filters.to}.csv`);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-700">{t('reports.by_user.title')}</p>
        {data.length > 0 && (
          <button onClick={exportCsv}
            className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50">
            {t('reports.by_user.csv')}
          </button>
        )}
      </div>
      {loading ? (
        <div className="py-12 flex justify-center"><div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <EmptyState icon="👤" title={t('reports.no_data')} />
      ) : (
        <div className="space-y-2">
          {data.slice(0, 50).map((row, i) => {
            const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email;
            const pct  = Math.round((row.count / maxCount) * 100);
            return (
              <div key={row.userId}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-zinc-400 w-5 shrink-0">{i + 1}.</span>
                    <span className="text-xs font-medium text-zinc-700 truncate">{name}</span>
                    {name !== row.email && (
                      <span className="text-[10px] text-zinc-400 truncate hidden sm:block">{row.email}</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-zinc-600 shrink-0 ml-2">{row.count}</span>
                </div>
                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: i === 0 ? ACCENT : '#d4d4d8' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── By Desk Tab ────────────────────────────────────────────────────
function ByDeskTab({ filters }: { filters: Filters }) {
  const { t } = useTranslation();
  const [data, setData]       = useState<{ deskId: string; name: string; locationName: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { from: filters.from, to: filters.to };
      if (filters.locationId) params.locationId = filters.locationId;
      const rows = await appApi.reports.get('/by-desk', params);
      setData(rows);
    } catch {}
    setLoading(false);
  }, [filters.from, filters.to, filters.locationId]);

  useEffect(() => { load(); }, [load]);

  const maxCount = data[0]?.count ?? 1;

  const exportCsv = () => {
    const header = [t('reports.by_desk.desk'), t('reports.by_desk.location'), t('reports.by_desk.count')];
    const rows   = data.map(r => [r.name, r.locationName, String(r.count)]);
    downloadCsv([header, ...rows], `report-by-desk-${filters.from}-${filters.to}.csv`);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-700">{t('reports.by_desk.title')}</p>
        {data.length > 0 && (
          <button onClick={exportCsv}
            className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50">
            {t('reports.by_desk.csv')}
          </button>
        )}
      </div>
      {loading ? (
        <div className="py-12 flex justify-center"><div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <EmptyState icon="🪑" title={t('reports.no_data')} />
      ) : (
        <div className="space-y-2">
          {data.slice(0, 50).map((row, i) => {
            const pct = Math.round((row.count / maxCount) * 100);
            return (
              <div key={row.deskId}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-zinc-400 w-5 shrink-0">{i + 1}.</span>
                    <span className="text-xs font-medium text-zinc-700 truncate">{row.name}</span>
                    <span className="text-[10px] text-zinc-400 truncate hidden sm:block">{row.locationName}</span>
                  </div>
                  <span className="text-xs font-semibold text-zinc-600 shrink-0 ml-2">{row.count}</span>
                </div>
                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: i === 0 ? ACCENT : '#d4d4d8' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Utilization Tab (P4-B2) ────────────────────────────────────────
interface UtilizationRow {
  deskId: string; deskName: string; deskCode: string;
  floor: string | null; zone: string | null;
  locationId: string; locationName: string;
  reservations: number; workdays: number; utilizationPct: number;
}

function UtilizationTab({ filters }: { filters: Filters }) {
  const { t } = useTranslation();
  const [data, setData]       = useState<UtilizationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { from: filters.from, to: filters.to };
      if (filters.locationId) params.locationId = filters.locationId;
      const rows = await appApi.reports.get('/utilization', params);
      setData(rows ?? []);
    } catch {}
    setLoading(false);
  }, [filters.from, filters.to, filters.locationId]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const header = [
      t('reports.utilization.col_desk'), t('reports.utilization.col_code'),
      t('reports.utilization.col_floor'), t('reports.utilization.col_zone'),
      t('reports.utilization.col_location'), t('reports.utilization.col_reservations'),
      t('reports.utilization.col_workdays'), t('reports.utilization.col_pct'),
    ];
    const rows = data.map(r => [
      r.deskName, r.deskCode ?? '', r.floor ?? '', r.zone ?? '',
      r.locationName, String(r.reservations), String(r.workdays), `${r.utilizationPct}%`,
    ]);
    downloadCsv([header, ...rows], `utilization-${filters.from}-${filters.to}.csv`);
  };

  const pctColor = (pct: number) =>
    pct >= 70 ? 'text-emerald-600' : pct >= 30 ? 'text-amber-600' : 'text-zinc-400';

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-700">{t('reports.utilization.title')}</p>
        {data.length > 0 && (
          <button onClick={exportCsv}
            className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50">
            {t('reports.export.csv')}
          </button>
        )}
      </div>
      {loading ? (
        <div className="py-12 flex justify-center"><div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <EmptyState icon="📈" title={t('reports.no_data')} />
      ) : (
        <>
          <p className="text-xs text-zinc-400 mb-3">{t('reports.utilization.hint', { workdays: data[0]?.workdays ?? 0 })}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left py-2 pr-3 font-semibold text-zinc-400 uppercase tracking-wide">{t('reports.utilization.col_desk')}</th>
                  <th className="text-left py-2 pr-3 font-semibold text-zinc-400 uppercase tracking-wide hidden sm:table-cell">{t('reports.utilization.col_floor')}</th>
                  <th className="text-left py-2 pr-3 font-semibold text-zinc-400 uppercase tracking-wide hidden md:table-cell">{t('reports.utilization.col_location')}</th>
                  <th className="text-right py-2 pr-3 font-semibold text-zinc-400 uppercase tracking-wide">{t('reports.utilization.col_reservations')}</th>
                  <th className="text-right py-2 font-semibold text-zinc-400 uppercase tracking-wide">{t('reports.utilization.col_pct')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.deskId} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="py-2 pr-3">
                      <span className="font-medium text-zinc-700">{row.deskName}</span>
                      {row.deskCode && <span className="text-zinc-400 ml-1">· {row.deskCode}</span>}
                    </td>
                    <td className="py-2 pr-3 text-zinc-500 hidden sm:table-cell">{row.floor ?? '—'}</td>
                    <td className="py-2 pr-3 text-zinc-500 hidden md:table-cell">{row.locationName}</td>
                    <td className="py-2 pr-3 text-right font-mono text-zinc-600">{row.reservations}</td>
                    <td className="py-2 text-right">
                      <span className={`font-bold font-mono ${pctColor(row.utilizationPct)}`}>
                        {row.utilizationPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
function ReportsPage() {
  const { t } = useTranslation();
  const [activeTab,  setActiveTab]  = useState<Tab>('snapshot');
  const [from,       setFrom]       = useState(monthAgoStr());
  const [to,         setTo]         = useState(todayStr());
  const [locationId, setLocationId] = useState('');
  const [locations,  setLocations]  = useState<{ id: string; name: string }[]>([]);
  const [exporting,  setExporting]  = useState(false);

  const filters = useMemo<Filters>(() => ({ from, to, locationId }), [from, to, locationId]);

  useEffect(() => {
    appApi.locations.list().then(r => setLocations(Array.isArray(r) ? r : [])).catch((e) => console.error('[ReportsPage] load locations', e));
  }, []);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      const params: Record<string, string> = { from, to, format };
      if (locationId) params.locationId = locationId;
      const blob     = await appApi.reports.export(params);
      const filename = `reserti-report-${from}-${to}.${format}`;
      const url      = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: filename }).click();
      URL.revokeObjectURL(url);
    } catch {}
    setExporting(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-zinc-800">{t('pages.reports.title', 'Reports')}</h1>
      </div>

      {/* Filter bar */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 items-end mb-5 p-3 sm:p-4 bg-white border border-zinc-100 rounded-xl">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">{t('reports.filter.from')}</label>
          <input type="date" value={from} max={to}
            onChange={e => setFrom(e.target.value)}
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 min-h-touch focus:outline-none focus:ring-1 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">{t('reports.filter.to')}</label>
          <input type="date" value={to} min={from} max={todayStr()}
            onChange={e => setTo(e.target.value)}
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 min-h-touch focus:outline-none focus:ring-1 focus:ring-brand" />
        </div>
        {locations.length > 0 && (
          <div className="col-span-2 sm:col-auto">
            <label className="block text-xs text-zinc-400 mb-1">{t('reports.filter.location')}</label>
            <select value={locationId} onChange={e => setLocationId(e.target.value)}
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 min-h-touch focus:outline-none focus:ring-1 focus:ring-brand bg-white">
              <option value="">{t('reports.filter.all')}</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Tab bar — scroll-x-fade hides scrollbar but allows swipe */}
      <div className="scroll-x-fade -mx-4 sm:mx-0 px-4 sm:px-0 mb-5 border-b border-zinc-100">
        <div className="flex gap-1 min-w-max sm:min-w-0">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px min-h-touch ${
                activeTab === tab
                  ? 'border-brand text-brand'
                  : 'border-transparent text-zinc-500 active:text-zinc-700'
              }`}>
              {t(`reports.tabs.${tab}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'snapshot'     && <SnapshotTab filters={filters} />}
      {activeTab === 'heatmap'      && <HeatmapTab filters={filters} onExport={handleExport} exporting={exporting} />}
      {activeTab === 'reservations' && <ReservationsTab filters={filters} />}
      {activeTab === 'methods'      && <MethodsTab filters={filters} />}
      {activeTab === 'by_user'      && <ByUserTab filters={filters} />}
      {activeTab === 'by_desk'      && <ByDeskTab filters={filters} />}
      {activeTab === 'utilization'  && <UtilizationTab filters={filters} />}
      {activeTab === 'insights' && (
        // FIX P2-3: show in-context location picker when no location selected
        <Card className="p-5">
          {locationId ? (
            <InsightsWidget locationId={locationId} showRefresh />
          ) : (
            <div className="text-center py-8">
              <p className="text-2xl mb-3">🔍</p>
              <p className="text-sm font-medium text-zinc-700 mb-1">
                {t('reports.insights.select_location')}
              </p>
              <p className="text-xs text-zinc-400 mb-4">
                {t('reports.insights.select_location_hint', 'Choose an office to generate AI occupancy insights')}
              </p>
              {locations.length > 0 && (
                <select
                  value={locationId}
                  onChange={e => setLocationId(e.target.value)}
                  className="text-sm border border-zinc-200 rounded-lg px-3 py-2
                             focus:outline-none focus:ring-1 focus:ring-brand bg-white
                             min-w-[200px]">
                  <option value="">{t('reports.filter.all')}</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export { ReportsPage };
export default ReportsPage;

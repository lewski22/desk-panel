/**
 * WeeklyViewPage — Sprint E1
 * "Kto kiedy w biurze" — tygodniowy widok obecności zespołu
 * Inspiracja: Deskbird, Robin
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }          from '../api/client';
import { Spinner, EmptyState } from '../components/ui';

// ── Helpers ──────────────────────────────────────────────────
function currentIsoWeek(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const startW1 = new Date(jan4);
  startW1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
  const weekNum = Math.ceil(((now.getTime() - startW1.getTime()) / 86_400_000 + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function prevWeek(w: string): string {
  const [year, wn] = w.split('-W').map(Number);
  if (wn === 1) return `${year - 1}-W52`;
  return `${year}-W${String(wn - 1).padStart(2, '0')}`;
}

function nextWeek(w: string): string {
  const [year, wn] = w.split('-W').map(Number);
  if (wn >= 52) return `${year + 1}-W01`;
  return `${year}-W${String(wn + 1).padStart(2, '0')}`;
}

// ── Status cell ───────────────────────────────────────────────
const STATUS_CONFIG = {
  office:   { icon: '🏢', bg: 'bg-emerald-100', text: 'text-emerald-700', title: 'W biurze' },
  reserved: { icon: '📋', bg: 'bg-sky-100',     text: 'text-sky-700',     title: 'Rezerwacja' },
  unknown:  { icon: '',   bg: 'bg-zinc-50',     text: 'text-zinc-300',    title: 'Brak danych' },
};

function StatusCell({ status, isToday }: { status: string; isToday: boolean }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.unknown;
  return (
    <td className={`px-2 py-3 text-center border-l border-zinc-100 transition-colors ${
      isToday ? 'bg-[#B53578]/5' : ''
    }`}>
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-sm ${cfg.bg} ${cfg.text}`}
        title={cfg.title}>
        {cfg.icon || <span className="w-2 h-2 rounded-full bg-zinc-200" />}
      </span>
    </td>
  );
}

// ── Avatar inicjały ───────────────────────────────────────────
function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  // Deterministyczny kolor z nazwy
  const colors = ['bg-violet-100 text-violet-700','bg-indigo-100 text-indigo-700',
    'bg-sky-100 text-sky-700','bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700'];
  const idx = (firstName.charCodeAt(0) ?? 0) % colors.length;
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 ${colors[idx]}`}>
      {initials}
    </span>
  );
}

// ── Location picker ───────────────────────────────────────────
function LocationPicker({ locations, value, onChange }: {
  locations: any[]; value: string; onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (locations.length <= 1) return null;
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#B53578]/30">
      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
    </select>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function WeeklyViewPage() {
  const { t, i18n } = useTranslation();
  const locale       = i18n.language === 'en' ? 'en-GB' : 'pl-PL';

  const [locations, setLocations]   = useState<any[]>([]);
  const [locationId, setLocationId] = useState('');
  const [week, setWeek]             = useState(currentIsoWeek);
  const [data, setData]             = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');

  // Załaduj lokalizacje
  useEffect(() => {
    appApi.locations.listAll()
      .then(locs => {
        setLocations(locs);
        if (locs.length > 0) setLocationId(locs[0].id);
      })
      .catch(() => {});
  }, []);

  // Załaduj dane attendance
  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    appApi.locations.attendance(locationId, week)
      .then(setData)
      .catch(e => setError(e.message ?? t('common.error')))
      .finally(() => setLoading(false));
  }, [locationId, week]);

  const today = new Date().toISOString().split('T')[0];

  // Filtrowanie userów po nazwie
  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    if (!search.trim()) return data.rows;
    const q = search.toLowerCase();
    return data.rows.filter((r: any) =>
      `${r.user.firstName} ${r.user.lastName}`.toLowerCase().includes(q)
    );
  }, [data?.rows, search]);

  // Statystyki dziś
  const todayStats = useMemo(() => {
    if (!data?.rows) return { office: 0, total: 0 };
    const todayRows = data.rows.map((r: any) =>
      r.days.find((d: any) => d.date === today)?.status ?? 'unknown'
    );
    return {
      office: todayRows.filter((s: string) => s === 'office' || s === 'reserved').length,
      total:  data.rows.length,
    };
  }, [data?.rows, today]);

  const isCurrentWeek = week === currentIsoWeek();

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">{t('weekly.title')}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{t('weekly.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
          <LocationPicker locations={locations} value={locationId} onChange={setLocationId} />
          {/* Week navigator */}
          <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1">
            <button onClick={() => setWeek(prevWeek(week))}
              className="w-8 h-7 rounded-lg text-zinc-500 hover:bg-white hover:text-zinc-800 transition-all text-sm font-medium">‹</button>
            <span className="text-xs font-semibold text-zinc-700 px-2 whitespace-nowrap">{week}</span>
            <button onClick={() => setWeek(nextWeek(week))}
              className="w-8 h-7 rounded-lg text-zinc-500 hover:bg-white hover:text-zinc-800 transition-all text-sm font-medium">›</button>
          </div>
          {!isCurrentWeek && (
            <button onClick={() => setWeek(currentIsoWeek())}
              className="text-xs text-[#B53578] px-2 py-1 rounded-lg hover:bg-[#B53578]/5 transition-colors">
              {t('weekly.today_week')}
            </button>
          )}
        </div>
      </div>

      {/* KPI dziś */}
      {data && (
        <div className="flex gap-3 mb-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
            <span className="text-xl">🏢</span>
            <div>
              <p className="text-lg font-bold font-mono text-emerald-700">{todayStats.office}</p>
              <p className="text-[10px] text-emerald-500 uppercase tracking-wide">{t('weekly.in_office_today')}</p>
            </div>
          </div>
          <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
            <span className="text-xl">👥</span>
            <div>
              <p className="text-lg font-bold font-mono text-zinc-700">{todayStats.total}</p>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wide">{t('weekly.team_size')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('weekly.search_placeholder')}
          className="w-full sm:w-64 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
        />
      </div>

      {loading && <Spinner />}
      {error && <EmptyState icon="⚠️" title={t('common.error')} sub={error} />}

      {/* Grid — desktop */}
      {!loading && data && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-y sm:border border-zinc-100">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider w-52">
                    {t('weekly.person')}
                  </th>
                  {data.days.map((d: any) => {
                    const isToday = d.date === today;
                    return (
                      <th key={d.date}
                        className={`py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider border-l border-zinc-100 ${
                          isToday ? 'text-[#B53578] bg-[#B53578]/5' : 'text-zinc-400'
                        }`}>
                        {d.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-zinc-400 text-sm">{t('weekly.no_users')}</td></tr>
                )}
                {filteredRows.map((row: any) => (
                  <tr key={row.user.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar firstName={row.user.firstName} lastName={row.user.lastName} />
                        <div>
                          <p className="font-medium text-zinc-800 text-sm leading-tight">
                            {row.user.firstName} {row.user.lastName}
                          </p>
                          <p className="text-[10px] text-zinc-400">{row.user.role}</p>
                        </div>
                      </div>
                    </td>
                    {row.days.map((day: any) => (
                      <StatusCell key={day.date} status={day.status} isToday={day.date === today} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile — tylko dzisiaj + swipe hint */}
          <div className="md:hidden space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {data.days.find((d: any) => d.date === today)?.label ?? data.days[0]?.label}
              </p>
              <p className="text-[10px] text-zinc-400">{t('weekly.mobile_hint')}</p>
            </div>
            {filteredRows.map((row: any) => {
              const todayDay = row.days.find((d: any) => d.date === today) ?? row.days[0];
              const cfg = STATUS_CONFIG[todayDay?.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.unknown;
              return (
                <div key={row.user.id} className="flex items-center justify-between bg-white border border-zinc-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar firstName={row.user.firstName} lastName={row.user.lastName} />
                    <p className="font-medium text-zinc-800 text-sm">{row.user.firstName} {row.user.lastName}</p>
                  </div>
                  <span className={`text-lg ${cfg.text}`} title={cfg.title}>{cfg.icon || '—'}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Legenda */}
      {data && (
        <div className="flex flex-wrap gap-4 mt-4">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${cfg.bg}`}>
                {cfg.icon || <span className="w-1.5 h-1.5 rounded-full bg-zinc-300"/>}
              </span>
              {t(`weekly.status.${key}`)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }         from '../api/client';

// ── Types ──────────────────────────────────────────────────────
interface HeatmapCell {
  day:   number;
  hour:  number;
  count: number;
}

const DAYS_PL  = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
const DAYS_EN  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Utils ──────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

// ── Heatmap cell coloring ──────────────────────────────────────
function cellColor(count: number, max: number): string {
  if (max === 0 || count === 0) return 'hsl(220 14% 94%)';
  const t = count / max;
  // purple ramp: light → deep
  const l = Math.round(90 - t * 55);
  const s = Math.round(40 + t * 40);
  return `hsl(248 ${s}% ${l}%)`;
}

// ── Component ─────────────────────────────────────────────────
export default function ReportsPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';
  const DAYS = lang === 'pl' ? DAYS_PL : DAYS_EN;

  const [from,       setFrom]       = useState(monthAgoStr());
  const [to,         setTo]         = useState(todayStr());
  const [locationId, setLocationId] = useState('');
  const [locations,  setLocations]  = useState<{ id: string; name: string }[]>([]);
  const [heatmap,    setHeatmap]    = useState<HeatmapCell[]>([]);
  const [maxCount,   setMaxCount]   = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [error,      setError]      = useState('');

  // Pobierz lokalizacje na start
  useEffect(() => {
    appApi.get('/locations').then(r => {
      setLocations(r.data?.data ?? r.data ?? []);
    }).catch(() => {});
  }, []);

  // Załaduj heatmapę
  const loadHeatmap = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { from, to };
      if (locationId) params.locationId = locationId;
      const r = await appApi.get('/reports/heatmap', { params });
      const cells: HeatmapCell[] = r.data;
      setHeatmap(cells);
      setMaxCount(Math.max(...cells.map(c => c.count), 1));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error loading heatmap');
    } finally {
      setLoading(false);
    }
  }, [from, to, locationId]);

  useEffect(() => { loadHeatmap(); }, [loadHeatmap]);

  // Eksport pliku
  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      const params: Record<string, string> = { from, to, format };
      if (locationId) params.locationId = locationId;
      const r = await appApi.get('/reports/export', {
        params,
        responseType: 'blob',
      });
      const ext      = format === 'xlsx' ? 'xlsx' : 'csv';
      const filename = `reserti-report-${from}-${to}.${ext}`;
      const url      = URL.createObjectURL(new Blob([r.data]));
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed');
    } finally {
      setExporting(false);
    }
  };

  // Zbuduj lookup heatmapy: "day:hour" → count
  const heatLookup = new Map(heatmap.map(c => [`${c.day}:${c.hour}`, c.count]));

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4, color: 'var(--color-text-primary)' }}>
        {lang === 'pl' ? 'Raporty' : 'Reports'}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 24 }}>
        {lang === 'pl'
          ? 'Analiza zajętości biurek i eksport danych.'
          : 'Desk occupancy analysis and data export.'}
      </p>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle}>{lang === 'pl' ? 'Od' : 'From'}</label>
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'pl' ? 'Do' : 'To'}</label>
          <input type="date" value={to} min={from} max={todayStr()} onChange={e => setTo(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{lang === 'pl' ? 'Lokalizacja' : 'Location'}</label>
          <select value={locationId} onChange={e => setLocationId(e.target.value)} style={inputStyle}>
            <option value="">{lang === 'pl' ? 'Wszystkie' : 'All'}</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <button onClick={loadHeatmap} disabled={loading} style={btnStyle}>
          {loading ? '...' : (lang === 'pl' ? 'Odśwież' : 'Refresh')}
        </button>
      </div>

      {/* ── Export buttons ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button onClick={() => handleExport('csv')} disabled={exporting} style={btnOutlineStyle}>
          ↓ CSV
        </button>
        <button onClick={() => handleExport('xlsx')} disabled={exporting} style={btnOutlineStyle}>
          ↓ XLSX
        </button>
        {exporting && <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
          {lang === 'pl' ? 'Pobieranie...' : 'Downloading...'}
        </span>}
      </div>

      {error && (
        <div style={{ background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Heatmap ──────────────────────────────────────────── */}
      <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '20px 16px', overflowX: 'auto' }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16, color: 'var(--color-text-primary)' }}>
          {lang === 'pl' ? 'Heatmapa zajętości — dzień × godzina' : 'Occupancy heatmap — day × hour'}
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            {lang === 'pl' ? 'Ładowanie...' : 'Loading...'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(24, 1fr)`, gap: 2, minWidth: 700 }}>
            {/* Header row: hours */}
            <div />
            {hours.map(h => (
              <div key={h} style={{ textAlign: 'center', fontSize: 10, color: 'var(--color-text-tertiary)', paddingBottom: 4 }}>
                {h % 3 === 0 ? `${h}h` : ''}
              </div>
            ))}

            {/* Data rows: days */}
            {DAYS.map((dayLabel, dayIdx) => (
              <>
                <div key={`label-${dayIdx}`} style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', paddingRight: 8, fontWeight: dayIdx < 5 ? 400 : 500 }}>
                  {dayLabel}
                </div>
                {hours.map(hour => {
                  const count = heatLookup.get(`${dayIdx}:${hour}`) ?? 0;
                  const bg    = cellColor(count, maxCount);
                  return (
                    <div
                      key={`${dayIdx}-${hour}`}
                      title={`${dayLabel} ${hour}:00 — ${count} check-in${count !== 1 ? 's' : ''}`}
                      style={{
                        aspectRatio: '1',
                        borderRadius: 3,
                        background: bg,
                        cursor: count > 0 ? 'pointer' : 'default',
                      }}
                    />
                  );
                })}
              </>
            ))}
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>0</span>
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <div key={t} style={{ width: 20, height: 12, borderRadius: 2, background: cellColor(t * maxCount, maxCount) }} />
          ))}
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{maxCount} check-ins</span>
        </div>
      </div>

      {/* ── Summary stats ─────────────────────────────────────── */}
      {heatmap.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 20 }}>
          <StatCard
            label={lang === 'pl' ? 'Łączne check-in' : 'Total check-ins'}
            value={heatmap.reduce((s, c) => s + c.count, 0).toLocaleString()}
          />
          <StatCard
            label={lang === 'pl' ? 'Szczyt (dzień)' : 'Peak day'}
            value={(() => {
              const byDay = DAYS.map((_, d) => heatmap.filter(c => c.day === d).reduce((s, c) => s + c.count, 0));
              const max   = Math.max(...byDay);
              return `${DAYS[byDay.indexOf(max)]} (${max})`;
            })()}
          />
          <StatCard
            label={lang === 'pl' ? 'Szczyt (godzina)' : 'Peak hour'}
            value={(() => {
              const byHour = hours.map(h => heatmap.filter(c => c.hour === h).reduce((s, c) => s + c.count, 0));
              const max    = Math.max(...byHour);
              return `${byHour.indexOf(max)}:00 (${max})`;
            })()}
          />
          <StatCard
            label={lang === 'pl' ? 'Aktywne godziny' : 'Active hours'}
            value={String(heatmap.filter(c => c.count > 0).length)}
          />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-text-primary)' }}>{value}</div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--color-text-secondary)',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '6px 10px',
  borderRadius: 8,
  border: '0.5px solid var(--color-border-secondary)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  minWidth: 140,
};

const btnStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '7px 16px',
  borderRadius: 8,
  border: '0.5px solid var(--color-border-secondary)',
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
};

const btnOutlineStyle: React.CSSProperties = {
  ...btnStyle,
  background: 'transparent',
};

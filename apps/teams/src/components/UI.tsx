/**
 * UI.tsx — Shared components dla Teams App
 *
 * Styl: Fluent UI-like (Segoe UI, zaokrąglone karty, kolory Teams)
 * apps/teams/src/components/UI.tsx
 */
import type { ReactNode, CSSProperties } from 'react';

const ACCENT = '#B53578'; // Reserti brand

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   '#fff',
        borderRadius: 8,
        border:       '1px solid #edebe9',
        padding:      '12px 14px',
        boxShadow:    '0 1px 4px rgba(0,0,0,0.06)',
        cursor:       onClick ? 'pointer' : 'default',
        transition:   'box-shadow 0.15s',
        ...style,
      }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
    >
      {children}
    </div>
  );
}

// ── Btn ──────────────────────────────────────────────────────────────────────
export function Btn({
  children, onClick, variant = 'primary', disabled = false, style,
}: {
  children: ReactNode; onClick?: () => void;
  variant?: 'primary' | 'secondary'; disabled?: boolean; style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:      '8px 16px',
        borderRadius: 6,
        border:       variant === 'primary' ? 'none' : '1px solid #edebe9',
        background:   variant === 'primary' ? ACCENT : '#fff',
        color:        variant === 'primary' ? '#fff' : '#323130',
        fontFamily:   'Segoe UI, system-ui, sans-serif',
        fontSize:     13,
        fontWeight:   600,
        cursor:       disabled ? 'not-allowed' : 'pointer',
        opacity:      disabled ? 0.6 : 1,
        transition:   'background 0.15s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── StatusDot ─────────────────────────────────────────────────────────────────
export function StatusDot({ color, style }: { color: string; style?: CSSProperties }) {
  return (
    <span style={{
      display:      'inline-block',
      width:        8,
      height:       8,
      borderRadius: '50%',
      background:   color,
      flexShrink:   0,
      ...style,
    }} />
  );
}

// ── DeskGrid ─────────────────────────────────────────────────────────────────
interface Desk { id: string; name: string; code: string; zone?: string; isOccupied: boolean; isOnline: boolean; }

export function DeskGrid({
  desks, selectedId, onSelect,
}: { desks: Desk[]; selectedId?: string; onSelect: (id: string) => void }) {
  // Grupuj po strefie
  const zones = new Map<string, Desk[]>();
  for (const d of desks) {
    const z = d.zone ?? 'Biurka';
    if (!zones.has(z)) zones.set(z, []);
    zones.get(z)!.push(d);
  }

  return (
    <div>
      {Array.from(zones.entries()).map(([zone, zDesks]) => (
        <div key={zone} style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#605e5c', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            {zone}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
            {zDesks.map(desk => {
              const selected  = desk.id === selectedId;
              const available = !desk.isOccupied && desk.isOnline;
              return (
                <button
                  key={desk.id}
                  onClick={() => available && onSelect(desk.id)}
                  disabled={!available}
                  title={!desk.isOnline ? 'Beacon offline' : desk.isOccupied ? 'Zajęte' : 'Wolne'}
                  style={{
                    padding:      '10px 6px',
                    borderRadius: 6,
                    border:       selected ? `2px solid ${ACCENT}` : '1px solid #edebe9',
                    background:   selected     ? '#fdf4f8' :
                                  !desk.isOnline ? '#f3f2f1' :
                                  desk.isOccupied ? '#fde8ec' : '#f0fdf4',
                    color:        !available ? '#a19f9d' : '#201f1e',
                    cursor:       available ? 'pointer' : 'not-allowed',
                    fontSize:     12,
                    fontWeight:   600,
                    textAlign:    'center',
                    fontFamily:   'Segoe UI, sans-serif',
                    transition:   'background 0.15s, border 0.15s',
                  }}
                >
                  {desk.code}
                  <div style={{ fontSize: 10, fontWeight: 400, color: '#605e5c', marginTop: 2 }}>
                    {!desk.isOnline ? '⚫' : desk.isOccupied ? '🔴' : '🟢'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        {[['🟢', 'Wolne'], ['🔴', 'Zajęte'], ['⚫', 'Offline']].map(([icon, label]) => (
          <span key={label} style={{ fontSize: 11, color: '#605e5c' }}>{icon} {label}</span>
        ))}
      </div>
    </div>
  );
}

// ── TimeSlotPicker ─────────────────────────────────────────────────────────────
export function TimeSlotPicker({
  label, slots, value, onChange,
}: { label: string; slots: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#a19f9d', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #edebe9', fontSize: 13 }}>
        {slots.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}

// ── PageShell ─────────────────────────────────────────────────────────────────
export function PageShell({
  title, children, onBack,
}: { title: string; children: ReactNode; onBack?: () => void }) {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#605e5c', padding: '0 4px' }}>
            ‹
          </button>
        )}
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#201f1e', flex: 1 }}>{title}</h1>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT }} title="Reserti" />
      </div>
      {children}
    </div>
  );
}

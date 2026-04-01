import { useState } from 'react';

interface Desk {
  id:    string;
  name:  string;
  code:  string;
  floor: string | null;
  zone:  string | null;
}

interface Props {
  desks:    Desk[];
  loading:  boolean;
  onSelect: (desk: Desk) => void;
}

export function DeskPicker({ desks, loading, onSelect }: Props) {
  const [filter, setFilter] = useState('');
  const [floor,  setFloor]  = useState('');

  const floors = Array.from(new Set(desks.map(d => d.floor).filter(Boolean)));

  const visible = desks.filter(d => {
    const matchText  = !filter || d.name.toLowerCase().includes(filter.toLowerCase()) || d.code.toLowerCase().includes(filter.toLowerCase());
    const matchFloor = !floor  || d.floor === floor;
    return matchText && matchFloor;
  });

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '24px', color: '#888', fontSize: '13px' }}>
      Wyszukiwanie wolnych biurek…
    </div>
  );

  if (!desks.length) return (
    <div style={{ textAlign: 'center', padding: '24px', color: '#888', fontSize: '13px' }}>
      Brak wolnych biurek w tym terminie.
    </div>
  );

  return (
    <div>
      {/* Filtry */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          placeholder="Szukaj biurka…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            flex: 1, padding: '7px 10px', borderRadius: '6px',
            border: '1px solid #d1d5db', fontSize: '13px', outline: 'none',
          }}
        />
        {floors.length > 1 && (
          <select
            value={floor}
            onChange={e => setFloor(e.target.value)}
            style={{
              padding: '7px 10px', borderRadius: '6px',
              border: '1px solid #d1d5db', fontSize: '13px',
              background: '#fff', cursor: 'pointer',
            }}
          >
            <option value="">Wszystkie piętra</option>
            {floors.map(f => <option key={f} value={f!}>Piętro {f}</option>)}
          </select>
        )}
      </div>

      {/* Lista biurek */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
        {visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '16px', color: '#aaa', fontSize: '12px' }}>
            Brak wyników dla podanego filtra.
          </div>
        )}
        {visible.map(desk => (
          <button
            key={desk.id}
            onClick={() => onSelect(desk)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', borderRadius: '8px',
              border: '1px solid #e5e7eb', background: '#fff',
              cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#B53578')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{desk.name}</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '1px' }}>
                {[desk.code, desk.floor && `Piętro ${desk.floor}`, desk.zone].filter(Boolean).join(' · ')}
              </div>
            </div>
            <svg width="14" height="14" fill="none" stroke="#B53578" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  deskName:  string;
  deskCode:  string;
  date:      string;
  startTime: string;
  endTime:   string;
  onNew:     () => void;
}

export function BookingSuccess({ deskName, deskCode, date, startTime, endTime, onNew }: Props) {
  const dateLabel = new Date(date + 'T12:00').toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div style={{ textAlign: 'center', padding: '24px 16px' }}>
      {/* Checkmark */}
      <div style={{
        width: '52px', height: '52px', borderRadius: '50%',
        background: '#ecfdf5', margin: '0 auto 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="24" height="24" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </div>

      <div style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', marginBottom: '4px' }}>
        Zarezerwowano!
      </div>
      <div style={{ fontSize: '13px', color: '#555', marginBottom: '20px' }}>
        Pole Lokalizacja spotkania zostało zaktualizowane.
      </div>

      {/* Szczegóły rezerwacji */}
      <div style={{
        background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px',
        padding: '14px', textAlign: 'left', marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Biurko</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{deskName} ({deskCode})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Data</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{dateLabel}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Godziny</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{startTime} – {endTime}</span>
        </div>
      </div>

      <button
        onClick={onNew}
        style={{
          width: '100%', padding: '10px',
          background: 'transparent', border: '1px solid #d1d5db',
          borderRadius: '8px', fontSize: '13px', color: '#555',
          cursor: 'pointer',
        }}
      >
        Zarezerwuj inne biurko
      </button>
    </div>
  );
}

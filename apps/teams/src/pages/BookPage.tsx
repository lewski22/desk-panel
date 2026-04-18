/**
 * BookPage — "Rezerwuj" tab
 *
 * Flow: Lokalizacja → Data → Czas → Biurko → Potwierdź
 * apps/teams/src/pages/BookPage.tsx
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resrApi, type Location, type Desk } from '../api/client';
import { Card, Btn, DeskGrid, PageShell, TimeSlotPicker } from '../components/UI';

type Step = 'location' | 'datetime' | 'desk' | 'confirm' | 'success';

const TODAY = () => new Date().toISOString().slice(0, 10);

// Sloty czasowe co 30 minut 07:00–20:00
const TIME_SLOTS = Array.from({ length: 27 }, (_, i) => {
  const h = Math.floor((i * 30 + 420) / 60);
  const m = (i * 30 + 420) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

export function BookPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();

  const [step,       setStep]       = useState<Step>('location');
  const [locations,  setLocations]  = useState<Location[]>([]);
  const [desks,      setDesks]      = useState<Desk[]>([]);
  const [locationId, setLocationId] = useState(params.get('locationId') ?? '');
  const [date,       setDate]       = useState(TODAY());
  const [startTime,  setStartTime]  = useState('09:00');
  const [endTime,    setEndTime]    = useState('17:00');
  const [deskId,     setDeskId]     = useState(params.get('deskId') ?? '');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [saved,      setSaved]      = useState<any>(null);

  // Załaduj lokalizacje
  useEffect(() => {
    resrApi.locations.list().then(locs => {
      setLocations(locs);
      // Jeśli jest tylko jedna lokalizacja — przeskocz krok
      if (locs.length === 1 && !locationId) {
        setLocationId(locs[0].id);
        setStep('datetime');
      } else if (locationId) {
        setStep('datetime');
      }
    });
  }, []);

  // Załaduj biurka gdy zna się date + czas
  const loadDesks = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const list = await resrApi.desks.status(locationId);
      setDesks(list);
    } catch { setError('Nie można załadować biurek'); }
    finally { setLoading(false); }
  }, [locationId, date, startTime, endTime]);

  useEffect(() => {
    if (step === 'desk') loadDesks();
  }, [step]);

  const confirm = async () => {
    if (!deskId) return;
    setLoading(true); setError('');
    try {
      const dateISO   = date;
      const startISO  = `${dateISO}T${startTime}:00.000Z`;
      const endISO    = `${dateISO}T${endTime}:00.000Z`;
      const res = await resrApi.reservations.create({ deskId, date: dateISO, startTime: startISO, endTime: endISO });
      setSaved(res);
      setStep('success');
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Błąd rezerwacji');
    } finally { setLoading(false); }
  };

  const selectedDesk = desks.find(d => d.id === deskId);

  return (
    <PageShell title="Zarezerwuj biurko" onBack={step !== 'location' ? () => {
      const prev: Record<Step, Step> = { location: 'location', datetime: 'location', desk: 'datetime', confirm: 'desk', success: 'success' };
      setStep(prev[step]);
    } : undefined}>

      {/* ── Krok: Lokalizacja ── */}
      {step === 'location' && (
        <>
          <p style={hint}>Wybierz biuro</p>
          {locations.map(loc => (
            <Card key={loc.id} onClick={() => { setLocationId(loc.id); setStep('datetime'); }}
              style={{ marginBottom: 8, cursor: 'pointer' }}>
              <p style={{ fontWeight: 500 }}>{loc.name}</p>
              {loc.address && <p style={muted}>{loc.address}</p>}
            </Card>
          ))}
        </>
      )}

      {/* ── Krok: Data i czas ── */}
      {step === 'datetime' && (
        <>
          <p style={hint}>Kiedy chcesz przyjść?</p>
          <Card>
            <label style={label}>Data</label>
            <input type="date" value={date} min={TODAY()}
              onChange={e => setDate(e.target.value)} style={inputStyle} />

            <TimeSlotPicker label="Od" slots={TIME_SLOTS} value={startTime} onChange={v => { setStartTime(v); if (v >= endTime) setEndTime(TIME_SLOTS[TIME_SLOTS.indexOf(v) + 4] ?? '17:00'); }} />
            <TimeSlotPicker label="Do" slots={TIME_SLOTS.filter(s => s > startTime)} value={endTime} onChange={setEndTime} />
          </Card>
          <Btn onClick={() => setStep('desk')} style={{ marginTop: 12, width: '100%' }}>
            Pokaż wolne biurka →
          </Btn>
        </>
      )}

      {/* ── Krok: Wybór biurka ── */}
      {step === 'desk' && (
        <>
          <p style={hint}>{date} · {startTime}–{endTime}</p>
          {loading ? <p style={muted}>Ładowanie biurek…</p> : (
            <>
              <DeskGrid
                desks={desks}
                selectedId={deskId}
                onSelect={id => { setDeskId(id); setStep('confirm'); }}
              />
              {desks.filter(d => !d.isOccupied).length === 0 && (
                <Card><p style={muted}>Brak wolnych biurek w tym czasie.</p></Card>
              )}
            </>
          )}
        </>
      )}

      {/* ── Krok: Potwierdzenie ── */}
      {step === 'confirm' && selectedDesk && (
        <>
          <Card style={{ marginBottom: 12 }}>
            <p style={label}>Biurko</p>
            <p style={{ fontWeight: 600, fontSize: 15 }}>{selectedDesk.name} ({selectedDesk.code})</p>
            {selectedDesk.zone && <p style={muted}>{selectedDesk.zone}</p>}

            <p style={{ ...label, marginTop: 12 }}>Data i godzina</p>
            <p style={{ fontWeight: 500 }}>{date}</p>
            <p style={muted}>{startTime} – {endTime}</p>
          </Card>

          {error && <p style={{ fontSize: 13, color: '#c4314b', marginBottom: 8 }}>{error}</p>}

          <Btn onClick={confirm} disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Rezerwuję…' : '✓ Potwierdź rezerwację'}
          </Btn>
          <Btn variant="secondary" onClick={() => setStep('desk')} style={{ width: '100%', marginTop: 8 }}>
            Zmień biurko
          </Btn>
        </>
      )}

      {/* ── Krok: Sukces ── */}
      {step === 'success' && saved && (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Rezerwacja potwierdzona!</h2>
          <p style={muted}>Biurko zarezerwowane na {date}, {startTime}–{endTime}</p>
          <Btn onClick={() => navigate('/my-bookings')} style={{ marginTop: 20 }}>
            Moje rezerwacje
          </Btn>
        </div>
      )}
    </PageShell>
  );
}

const hint:       React.CSSProperties = { fontSize: 13, color: '#605e5c', marginBottom: 12 };
const muted:      React.CSSProperties = { fontSize: 13, color: '#a19f9d' };
const label:      React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#a19f9d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, display: 'block' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #edebe9', fontSize: 13, marginBottom: 12 };

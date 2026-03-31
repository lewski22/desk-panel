import { useState, useEffect } from 'react';
import { outlookApi, getUser, clearAuth } from '../api/client';
import { getItemStart, getItemEnd, toDateStr, toHHMM, setItemLocation, isOfficeContext } from '../utils/office';
import { DeskPicker } from '../components/DeskPicker';
import { BookingSuccess } from '../components/BookingSuccess';

interface Props {
  onLogout: () => void;
}

type Step = 'loading' | 'pick-location' | 'pick-desk' | 'confirming' | 'success' | 'error';

export function TaskpaneApp({ onLogout }: Props) {
  const user = getUser();

  // Dane ze spotkania
  const [date,      setDate]      = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime,   setEndTime]   = useState('');

  // Stany
  const [step,      setStep]      = useState<Step>('loading');
  const [locations, setLocations] = useState<any[]>([]);
  const [locId,     setLocId]     = useState('');
  const [desks,     setDesks]     = useState<any[]>([]);
  const [loadingDesks, setLoadingDesks] = useState(false);
  const [booked,    setBooked]    = useState<any>(null);
  const [errMsg,    setErrMsg]    = useState('');

  // Inicjalizacja — pobierz daty ze spotkania i lokalizacje
  useEffect(() => {
    (async () => {
      try {
        let d = new Date();
        let s = new Date();
        let e = new Date();
        s.setHours(s.getHours() + 1, 0, 0, 0);
        e.setHours(s.getHours() + 1, 0, 0, 0);

        if (isOfficeContext()) {
          d = await getItemStart();
          s = await getItemStart();
          e = await getItemEnd();
        }

        setDate(toDateStr(d));
        setStartTime(toHHMM(s));
        setEndTime(toHHMM(e));

        const locs = await outlookApi.locations.list();
        setLocations(locs);
        if (locs.length === 1) {
          setLocId(locs[0].id);
          setStep('pick-desk');
          loadDesks(locs[0].id, toDateStr(d), toHHMM(s), toHHMM(e));
        } else {
          setStep('pick-location');
        }
      } catch (err: any) {
        setErrMsg(err.message ?? 'Błąd inicjalizacji');
        setStep('error');
      }
    })();
  }, []);

  const loadDesks = async (lid: string, d: string, s: string, e: string) => {
    setLoadingDesks(true);
    try {
      const data = await outlookApi.desks.available({ locationId: lid, date: d, startTime: s, endTime: e });
      setDesks(data);
    } catch (err: any) {
      setErrMsg(err.message);
      setStep('error');
    }
    setLoadingDesks(false);
  };

  const selectLocation = (id: string) => {
    setLocId(id);
    setStep('pick-desk');
    loadDesks(id, date, startTime, endTime);
  };

  const selectDesk = async (desk: any) => {
    setStep('confirming');
    try {
      const res = await outlookApi.reservations.create({ deskId: desk.id, date, startTime, endTime });
      // Aktualizuj pole Lokalizacja w spotkaniu
      const locationLabel = `${desk.name}${desk.floor ? `, piętro ${desk.floor}` : ''}`;
      if (isOfficeContext()) {
        await setItemLocation(locationLabel).catch(() => {});
      }
      setBooked({ ...desk, reservation: res });
      setStep('success');
    } catch (err: any) {
      setErrMsg(err.message);
      setStep('error');
    }
  };

  const reset = () => {
    setBooked(null);
    setStep(locations.length === 1 ? 'pick-desk' : 'pick-location');
    if (locations.length === 1) loadDesks(locId, date, startTime, endTime);
  };

  // ── Render ────────────────────────────────────────────────────
  const locName = locations.find(l => l.id === locId)?.name ?? '';
  const dateLabel = date
    ? new Date(date + 'T12:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: '100vh', background: '#f8f9fa', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#B53578' }}>RESERTI</div>
          {dateLabel && (
            <div style={{ fontSize: '10px', color: '#888', marginTop: '1px' }}>
              {dateLabel} · {startTime}–{endTime}
            </div>
          )}
        </div>
        <button
          onClick={() => { clearAuth(); onLogout(); }}
          style={{
            fontSize: '11px', color: '#aaa', background: 'none',
            border: 'none', cursor: 'pointer', padding: '4px',
          }}
          title="Wyloguj"
        >
          Wyloguj
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>

        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '32px', color: '#888', fontSize: '13px' }}>
            <div style={{
              width: '20px', height: '20px', border: '2px solid #e5e7eb',
              borderTopColor: '#B53578', borderRadius: '50%',
              margin: '0 auto 12px', animation: 'spin 0.8s linear infinite',
            }} />
            Ładowanie…
          </div>
        )}

        {step === 'pick-location' && (
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', marginBottom: '4px' }}>
              Wybierz biuro
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '14px' }}>
              W którym biurze szukasz biurka?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {locations.map(loc => (
                <button
                  key={loc.id}
                  onClick={() => selectLocation(loc.id)}
                  style={{
                    padding: '12px 14px', borderRadius: '8px',
                    border: '1px solid #e5e7eb', background: '#fff',
                    cursor: 'pointer', textAlign: 'left', fontSize: '13px',
                    fontWeight: 600, color: '#1a1a1a',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#B53578')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
                >
                  {loc.name}
                  {loc.city && <span style={{ fontSize: '11px', color: '#888', fontWeight: 400, marginLeft: '6px' }}>{loc.city}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'pick-desk' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>
                  Wolne biurka
                </div>
                {locName && (
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '1px' }}>{locName}</div>
                )}
              </div>
              {locations.length > 1 && (
                <button
                  onClick={() => setStep('pick-location')}
                  style={{ fontSize: '11px', color: '#B53578', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Zmień biuro
                </button>
              )}
            </div>
            <DeskPicker desks={desks} loading={loadingDesks} onSelect={selectDesk} />
          </div>
        )}

        {step === 'confirming' && (
          <div style={{ textAlign: 'center', padding: '32px', color: '#888', fontSize: '13px' }}>
            <div style={{
              width: '20px', height: '20px', border: '2px solid #e5e7eb',
              borderTopColor: '#B53578', borderRadius: '50%',
              margin: '0 auto 12px', animation: 'spin 0.8s linear infinite',
            }} />
            Rezerwowanie biurka…
          </div>
        )}

        {step === 'success' && booked && (
          <BookingSuccess
            deskName={booked.name}
            deskCode={booked.code}
            date={date}
            startTime={startTime}
            endTime={endTime}
            onNew={reset}
          />
        )}

        {step === 'error' && (
          <div style={{ padding: '16px' }}>
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
              padding: '12px', fontSize: '13px', color: '#dc2626', marginBottom: '16px',
            }}>
              {errMsg}
            </div>
            <button
              onClick={reset}
              style={{
                width: '100%', padding: '10px', background: '#B53578',
                color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Spróbuj ponownie
            </button>
          </div>
        )}
      </div>

      {/* CSS animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

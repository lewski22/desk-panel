/**
 * MyBookingsPage — "Moje rezerwacje" tab
 * apps/teams/src/pages/MyBookingsPage.tsx
 */
import React, { useEffect, useState, useCallback } from 'react';
import { resrApi, type Reservation } from '../api/client';
import { Card, Btn, StatusDot, PageShell } from '../components/UI';

export function MyBookingsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [bookings,     setBookings]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [cancelling,   setCancelling]   = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      resrApi.reservations.my(),
      resrApi.bookings.myList().catch(() => [] as any[]),
    ])
      .then(([res, bk]) => {
        setReservations(res.filter(r => r.status === 'CONFIRMED' || r.status === 'PENDING'));
        setBookings(bk.filter((b: any) => b.status === 'CONFIRMED'));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancel = async (id: string) => {
    if (!confirm('Anulować rezerwację?')) return;
    setCancelling(id);
    try {
      await resrApi.reservations.cancel(id);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Błąd anulowania');
    } finally { setCancelling(null); }
  };

  const grouped = groupByDate(reservations);

  return (
    <PageShell title="Moje rezerwacje">
      {loading ? (
        <p style={muted}>Ładowanie…</p>
      ) : reservations.length === 0 && bookings.length === 0 ? (
        <Card>
          <p style={muted}>Nie masz aktywnych rezerwacji.</p>
        </Card>
      ) : (
        <>
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date} style={{ marginBottom: 16 }}>
              <p style={dateLabel}>{fmtDate(date)}</p>
              {items.map(r => (
                <Card key={r.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <StatusDot color={r.status === 'CONFIRMED' ? '#10b981' : '#f59e0b'} style={{ marginTop: 3 }} />
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>{r.desk?.name ?? r.deskId}</p>
                        <p style={muted}>{fmtTime(r.startTime)} – {fmtTime(r.endTime)}</p>
                        <p style={{ fontSize: 11, color: statusColor(r.status), marginTop: 2 }}>
                          {statusLabel(r.status)}
                        </p>
                      </div>
                    </div>
                    <Btn
                      variant="secondary"
                      onClick={() => cancel(r.id)}
                      disabled={cancelling === r.id}
                      style={{ fontSize: 12, padding: '4px 10px', color: '#c4314b', borderColor: '#c4314b' }}
                    >
                      {cancelling === r.id ? '…' : 'Anuluj'}
                    </Btn>
                  </div>
                </Card>
              ))}
            </div>
          ))}

          {bookings.length > 0 && (
            <>
              <p style={sectionTitle}>🏛 Sale i Parkingi</p>
              {bookings.map((b: any) => (
                <Card key={b.id} style={{ marginBottom: 8 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>
                    {b.resource?.type === 'PARKING' ? '🅿️' : '🏛'} {b.resource?.name ?? '—'}
                  </p>
                  <p style={muted}>
                    {fmtTime(b.startTime)} – {fmtTime(b.endTime)}
                  </p>
                </Card>
              ))}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}

function groupByDate(res: Reservation[]): Record<string, Reservation[]> {
  return res.reduce((acc, r) => {
    const d = r.date.slice(0, 10);
    if (!acc[d]) acc[d] = [];
    acc[d].push(r);
    return acc;
  }, {} as Record<string, Reservation[]>);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}
function statusColor(s: string) {
  return s === 'CONFIRMED' ? '#10b981' : s === 'PENDING' ? '#f59e0b' : '#a19f9d';
}
function statusLabel(s: string) {
  return s === 'CONFIRMED' ? 'Potwierdzona' : s === 'PENDING' ? 'Oczekuje' : s;
}

const muted:        React.CSSProperties = { fontSize: 13, color: '#a19f9d' };
const dateLabel:    React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#605e5c', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 };
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#605e5c', marginBottom: 8, marginTop: 16 };

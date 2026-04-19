/**
 * HomePage — "Moje biurko" tab
 *
 * Pokazuje: dzisiejsze rezerwacje + sugerowane biurko + szybki link do rezerwacji.
 * apps/teams/src/pages/HomePage.tsx
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resrApi, type Reservation, type Location } from '../api/client';
import { Card, Btn, StatusDot, PageShell } from '../components/UI';

const TODAY = new Date().toISOString().slice(0, 10);

export function HomePage() {
  const navigate = useNavigate();

  const [user,         setUser]         = useState<any>(null);
  const [locations,    setLocations]    = useState<Location[]>([]);
  const [todayRes,     setTodayRes]     = useState<Reservation[]>([]);
  const [recommended,  setRecommended]  = useState<any>(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    Promise.all([
      resrApi.me.get(),
      resrApi.locations.list(),
      resrApi.reservations.my(TODAY),
    ]).then(([me, locs, res]) => {
      setUser(me);
      setLocations(locs);
      setTodayRes(res.filter(r => r.status !== 'CANCELLED'));
      // Pobierz rekomendację dla pierwszej lokalizacji
      if (locs[0]) {
        resrApi.desks.recommended(locs[0].id, TODAY).then(setRecommended).catch(() => {});
      }
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageShell title="Moje biurko"><p style={muted}>Ładowanie…</p></PageShell>;

  return (
    <PageShell title={`Cześć, ${user?.firstName ?? 'Użytkowniku'} 👋`}>

      {/* Dzisiaj */}
      <h3 style={sectionTitle}>Dzisiaj</h3>
      {todayRes.length === 0 ? (
        <Card>
          <p style={muted}>Nie masz rezerwacji na dzisiaj.</p>
          <Btn onClick={() => navigate('/book')} style={{ marginTop: 12 }}>
            + Zarezerwuj biurko
          </Btn>
        </Card>
      ) : (
        todayRes.map(r => (
          <Card key={r.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusDot color="#10b981" />
              <div>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{r.desk?.name ?? r.deskId}</p>
                <p style={muted}>
                  {fmtTime(r.startTime)} – {fmtTime(r.endTime)}
                </p>
              </div>
            </div>
          </Card>
        ))
      )}

      {/* Rekomendacja */}
      {recommended && todayRes.length === 0 && (
        <>
          <h3 style={sectionTitle}>Sugerowane biurko</h3>
          <Card style={{ background: '#fdf4f8', borderColor: '#f3b8d4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14 }}>💡 {recommended.deskCode || recommended.deskName}</p>
                {recommended.zone && <p style={muted}>{recommended.zone}</p>}
                <p style={{ fontSize: 11, color: '#B53578', marginTop: 2 }}>
                  {recommended.reason === 'FAVORITE' ? 'Twoje ulubione biurko' :
                   recommended.reason === 'FAVORITE_ZONE' ? 'Ulubiona strefa' : 'Wolne biurko'}
                </p>
              </div>
              <Btn onClick={() => navigate(`/book?deskId=${recommended.deskId}`)}>
                Zarezerwuj
              </Btn>
            </div>
          </Card>
        </>
      )}

      {/* Lokalizacje */}
      {locations.length > 1 && (
        <>
          <h3 style={{ ...sectionTitle, marginTop: 16 }}>Lokalizacje</h3>
          {locations.map(loc => (
            <Card key={loc.id} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 500, fontSize: 13 }}>{loc.name}</p>
                  {loc.address && <p style={muted}>{loc.address}</p>}
                </div>
                <Btn variant="secondary" onClick={() => navigate(`/book?locationId=${loc.id}`)}>
                  Rezerwuj
                </Btn>
              </div>
            </Card>
          ))}
        </>
      )}
    </PageShell>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

const muted:        React.CSSProperties = { fontSize: 13, color: '#605e5c' };
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#323130', marginBottom: 8, marginTop: 16 };

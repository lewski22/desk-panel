/**
 * App.tsx — Root komponent Teams App
 *
 * Inicjalizuje Teams SDK → SSO login → routing.
 * Jeśli auth nie powiódł się → ErrorView z instrukcją.
 *
 * apps/teams/src/App.tsx
 */
import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { loginViaTeams } from './auth/teamsAuth';
import { HomePage }       from './pages/HomePage';
import { BookPage }       from './pages/BookPage';
import { MyBookingsPage } from './pages/MyBookingsPage';

type AuthState = 'loading' | 'ok' | 'error';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    loginViaTeams()
      .then(() => setAuthState('ok'))
      .catch((err) => {
        setAuthError(err.message ?? 'Błąd logowania');
        setAuthState('error');
      });
  }, []);

  if (authState === 'loading') return <LoadingView />;
  if (authState === 'error')   return <ErrorView message={authError} />;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Routes>
        <Route path="/"            element={<HomePage />} />
        <Route path="/book"        element={<BookPage />} />
        <Route path="/my-bookings" element={<MyBookingsPage />} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function LoadingView() {
  return (
    <div style={centered}>
      <div style={spinner} />
      <p style={{ marginTop: 16, color: '#605e5c', fontSize: 14 }}>Łączenie z Reserti…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div style={{ ...centered, flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
      <span style={{ fontSize: 32 }}>⚠️</span>
      <h2 style={{ fontSize: 16, color: '#201f1e' }}>Nie udało się zalogować</h2>
      <p style={{ fontSize: 13, color: '#605e5c', maxWidth: 320 }}>
        {message}
      </p>
      <p style={{ fontSize: 12, color: '#a19f9d' }}>
        Upewnij się że Twoja organizacja ma skonfigurowaną integrację Azure Entra ID w panelu Reserti
        (<em>Ustawienia → Integracje → Azure Entra ID</em>).
      </p>
    </div>
  );
}

const centered: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', minHeight: '100vh',
};
const spinner: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  border: '3px solid #edebe9',
  borderTopColor: '#B53578',
  animation: 'spin 0.8s linear infinite',
};

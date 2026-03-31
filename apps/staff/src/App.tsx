import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth }          from './hooks';
import { Layout }           from './components/layout/Layout';
import { LoginPage }        from './pages/LoginPage';
import { DeskMapPage }      from './pages/DeskMapPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { DevicesPage }      from './pages/DevicesPage';
import { QrCheckinPage }    from './pages/QrCheckinPage';

function ProtectedRoute({ user, children }: { user: any; children: React.ReactNode }) {
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, login, loginAzure, logout } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public — QR check-in (bez auth) */}
        <Route path="/checkin/:token" element={<QrCheckinPage />} />

        {/* Public — Login */}
        <Route path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={login} onLoginAzure={loginAzure} />}
        />

        {/* Protected */}
        <Route path="/*" element={
          <ProtectedRoute user={user}>
            <Layout user={user} onLogout={logout}>
              <Routes>
                <Route path="/"             element={<DeskMapPage />} />
                <Route path="/reservations" element={<ReservationsPage />} />
                <Route path="/devices"      element={<DevicesPage />} />
                <Route path="*"             element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

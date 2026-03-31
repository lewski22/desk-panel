import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ownerApi }          from './api/client';
import { OwnerLayout }       from './components/OwnerLayout';
import { LoginPage }         from './pages/LoginPage';
import { ClientsPage }       from './pages/ClientsPage';
import { ClientDetailPage }  from './pages/ClientDetailPage';
import { NewClientPage }     from './pages/NewClientPage';
import { HealthPage }        from './pages/HealthPage';
import { StatsPage }         from './pages/StatsPage';

export default function App() {
  const [user, setUser] = useState<any>(() => {
    const u = ownerApi.auth.user();
    return u?.role === 'OWNER' ? u : null;
  });

  const handleLogout = () => setUser(null);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/clients" replace /> : <LoginPage onLogin={setUser} />
        } />

        <Route path="/*" element={
          !user
            ? <Navigate to="/login" replace />
            : <OwnerLayout user={user} onLogout={handleLogout} />
        }>
          <Route path="clients"     element={<ClientsPage />} />
          <Route path="clients/new" element={<NewClientPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="health"      element={<HealthPage />} />
          <Route path="stats"       element={<StatsPage />} />
          <Route path="*"           element={<Navigate to="clients" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

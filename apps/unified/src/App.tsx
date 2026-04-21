import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { appApi }              from './api/client';
import { AppLayout }           from './components/layout/AppLayout';
import { LoginPage }           from './pages/LoginPage';
import { ImpersonatePage }     from './pages/ImpersonatePage';
import { QrCheckinPage }       from './pages/QrCheckinPage';
import { DashboardPage }       from './pages/DashboardPage';
import { DesksPage }           from './pages/DesksPage';
import { UsersPage }           from './pages/UsersPage';
import { ReservationsAdminPage } from './pages/ReservationsAdminPage';
import { ReservationsPage }    from './pages/ReservationsPage';
import { ProvisioningPage }    from './pages/ProvisioningPage';
import { ReportsPage }         from './pages/ReportsPage';
import { OrganizationsPage }   from './pages/OrganizationsPage';
import { DeskMapPage }         from './pages/DeskMapPage';
import { MyReservationsPage }  from './pages/MyReservationsPage';
import { DevicesPage }         from './pages/DevicesPage';
import { OwnerPage }           from './pages/OwnerPage';
import { NotificationsPage }   from './pages/NotificationsPage';
import { NotificationRulesPage } from './pages/NotificationRulesPage';
import { ChangePasswordPage }  from './pages/ChangePasswordPage';
import { FloorPlanEditorPage } from './pages/FloorPlanEditorPage';
import { WeeklyViewPage }      from './pages/WeeklyViewPage';
import { KioskPage }           from './pages/KioskPage';
import { VisitorsPage }        from './pages/VisitorsPage';
import { SubscriptionPage }    from './pages/SubscriptionPage';
import { ResourcesPage }       from './pages/ResourcesPage';
import IntegrationsPage         from './pages/IntegrationsPage';
import { PwaBanners }           from './components/PwaBanners';

// Role sets
const ADMIN_ROLES  = ['SUPER_ADMIN', 'OFFICE_ADMIN'];
const ALL_ROLES    = ['SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF', 'END_USER'];
const STAFF_ROLES  = ['SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF'];
const SUPER_ONLY   = ['SUPER_ADMIN'];
const STAFF_ONLY   = ['STAFF'];
const OWNER_ONLY   = ['OWNER'];

// Redirect po zalogowaniu per rola
function homeFor(role: string): string {
  if (role === 'END_USER') return '/my-reservations';
  if (role === 'OWNER')    return '/owner';
  return '/dashboard';
}

// Guard — chroniony route
function Guard({ user, allowed, children }: { user: any; allowed: string[]; children: React.ReactNode }) {
  if (!user)                        return <Navigate to="/login" replace />;
  if (!allowed.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

// SubscriptionExpiredGate — blokuje nawigację gdy plan wygasł
// Dozwolone: /subscription, /change-password
const ALLOWED_WHEN_EXPIRED = ['/subscription', '/change-password'];
function SubscriptionExpiredGate({ status, children }: { status?: string | null; children: React.ReactNode }) {
  const { pathname } = useLocation();
  if (status === 'expired' && !ALLOWED_WHEN_EXPIRED.some(p => pathname.startsWith(p))) {
    return <Navigate to="/subscription" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<any>(() => {
    const u = appApi.auth.user();
    return u;
  });

  useEffect(() => {
    if (!user) return;
    appApi.auth.getMe().then(setUser).catch(() => {});

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        appApi.auth.getMe().then(setUser).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const handleLogout = () => {
    appApi.auth.logout();
    setUser(null);
  };

  return (
    <BrowserRouter>
      <PwaBanners />
      <Routes>
        {/* Publiczne */}
        <Route path="/login" element={
          user ? <Navigate to={homeFor(user.role)} replace /> : <LoginPage onLogin={setUser} />
        } />
        <Route path="/auth/impersonate" element={<ImpersonatePage onLogin={setUser} />} />
        <Route path="/checkin/:token"   element={<QrCheckinPage />} />
        <Route path="/kiosk"            element={<KioskPage />} />

        {/* Chronione — z AppLayout */}
        <Route path="/*" element={
          !user
            ? <Navigate to="/login" replace />
            : (
              <AppLayout user={user} onLogout={handleLogout}>
                <SubscriptionExpiredGate status={user.subscriptionStatus}>
                <Routes>
                  {/* Redirect root → home per rola */}
                  <Route path="/" element={<Navigate to={homeFor(user.role)} replace />} />

                  {/* Admin */}
                  <Route path="/dashboard" element={
                    <Guard user={user} allowed={STAFF_ROLES}><DashboardPage /></Guard>
                  } />
                  <Route path="/desks" element={
                    <Guard user={user} allowed={ADMIN_ROLES}><DesksPage /></Guard>
                  } />
                  <Route path="/reservations" element={
                    <Guard user={user} allowed={STAFF_ROLES}><ReservationsAdminPage /></Guard>
                  } />
                  <Route path="/users" element={
                    <Guard user={user} allowed={ADMIN_ROLES}><UsersPage /></Guard>
                  } />
                  <Route path="/provisioning" element={
                    <Guard user={user} allowed={ADMIN_ROLES}><ProvisioningPage /></Guard>
                  } />
                  <Route path="/reports" element={
                    <Guard user={user} allowed={ADMIN_ROLES}><ReportsPage /></Guard>
                  } />
                  <Route path="/organizations" element={
                    <Guard user={user} allowed={SUPER_ONLY}><OrganizationsPage /></Guard>
                  } />

                  <Route path="/integrations" element={
                    <Guard user={user} allowed={ADMIN_ROLES}><IntegrationsPage /></Guard>
                  } />
                  <Route path="/notifications" element={
                    <Guard user={user} allowed={SUPER_ONLY}><NotificationsPage /></Guard>
                  } />
                  <Route path="/notification-rules" element={
                    <Guard user={user} allowed={OWNER_ONLY}><NotificationRulesPage /></Guard>
                  } />
                  <Route path="/owner" element={
                    <Guard user={user} allowed={OWNER_ONLY}><OwnerPage /></Guard>
                  } />

                  {/* Wspólne (staff + admin) */}
                  <Route path="/map" element={
                    <Guard user={user} allowed={ALL_ROLES}><DeskMapPage /></Guard>
                  } />
                  <Route path="/weekly" element={
                    <Guard user={user} allowed={ALL_ROLES}><WeeklyViewPage /></Guard>
                  } />
                  <Route path="/subscription" element={
                    <Guard user={user} allowed={['SUPER_ADMIN','OFFICE_ADMIN']}><SubscriptionPage /></Guard>
                  } />
                  <Route path="/visitors" element={
                    <Guard user={user} allowed={['SUPER_ADMIN','OFFICE_ADMIN','STAFF']}><VisitorsPage /></Guard>
                  } />
                  <Route path="/resources" element={
                    <Guard user={user} allowed={['SUPER_ADMIN','OFFICE_ADMIN']}><ResourcesPage /></Guard>
                  } />
                  <Route path="/floor-plan/:locationId" element={
                    <Guard user={user} allowed={['SUPER_ADMIN','OFFICE_ADMIN']}><FloorPlanEditorPage /></Guard>
                  } />
                  <Route path="/my-reservations" element={
                    <Guard user={user} allowed={ALL_ROLES}><MyReservationsPage /></Guard>
                  } />
                  <Route path="/devices" element={
                    <Guard user={user} allowed={STAFF_ROLES}><DevicesPage /></Guard>
                  } />
                  <Route path="/change-password" element={
                    <Guard user={user} allowed={[...ALL_ROLES, 'OWNER']}><ChangePasswordPage /></Guard>
                  } />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to={homeFor(user.role)} replace />} />
                </Routes>
                </SubscriptionExpiredGate>
              </AppLayout>
            )
        } />
      </Routes>
    </BrowserRouter>
  );
}

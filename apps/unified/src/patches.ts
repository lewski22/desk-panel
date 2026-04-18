// ═══════════════════════════════════════════════════════════════════════════
// PATCH 1: backend/src/app.module.ts
// ═══════════════════════════════════════════════════════════════════════════

// Dodaj import:
import { IntegrationsModule } from './modules/integrations/integrations.module';

// Dodaj do tablicy imports w @Module({ imports: [...] }):
//   IntegrationsModule,

// PEŁNY przykład (dołącz do istniejącej listy, nie zastępuj):
// @Module({
//   imports: [
//     ...istniejące...,
//     IntegrationsModule,   // ← Sprint F
//   ],
// })


// ═══════════════════════════════════════════════════════════════════════════
// PATCH 2: apps/unified/src/App.tsx — dodaj route
// ═══════════════════════════════════════════════════════════════════════════

// Dodaj import (lazy):
// const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));

// Dodaj route w sekcji chronionych (SUPER_ADMIN):
// <Route
//   path="/settings/integrations"
//   element={
//     <ProtectedRoute roles={['OWNER', 'SUPER_ADMIN']}>
//       <IntegrationsPage />
//     </ProtectedRoute>
//   }
// />


// ═══════════════════════════════════════════════════════════════════════════
// PATCH 3: apps/unified/src/components/layout/AppLayout.tsx — nawigacja
// ═══════════════════════════════════════════════════════════════════════════

// Znajdź tablicę NAV_ITEMS lub sekcję nawigacji KONFIGURACJA.
// Dodaj po linku do SMTP / powiadomień:

// {
//   to:    '/settings/integrations',
//   label: t('nav.integrations', 'Integracje'),
//   icon:  '🔗',               // lub ikona z lucide-react
//   roles: ['OWNER', 'SUPER_ADMIN'],
// }

// Jeśli sidebar używa NavLink bezpośrednio, dodaj:
// <NavLink
//   to="/settings/integrations"
//   className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
// >
//   🔗 {t('nav.integrations')}
// </NavLink>

// ─── i18n — dodaj klucz nav.integrations ────────────────────────────────────
// pl: "nav": { ..., "integrations": "Integracje" }
// en: "nav": { ..., "integrations": "Integrations" }


// ═══════════════════════════════════════════════════════════════════════════
// PATCH 4: Podpięcie IntegrationEventService w istniejących serwisach
// ═══════════════════════════════════════════════════════════════════════════

// backend/src/modules/reservations/reservations.service.ts
// ─── Dodaj import + konstruktor ─────────────────────────────────────────────
// import { IntegrationEventService } from '../integrations/integration-event.service';
//
// constructor(
//   private prisma:            PrismaService,
//   private ledEvents:         LedEventsService,
//   private gateways:          GatewaysService,
//   private notify:            NotificationsService,
//   private integrationEvents: IntegrationEventService,  // ← DODAJ
// ) {}
//
// W metodzie create() — po prisma.reservation.create():
//   // Dispatch integracji (fire-and-forget)
//   this.integrationEvents.onReservationCreated(actorOrgId ?? '', {
//     id:          reservation.id,
//     deskName:    reservation.desk?.name,
//     userName:    `${reservation.user?.firstName ?? ''} ${reservation.user?.lastName ?? ''}`.trim(),
//     locationName: reservation.desk?.location?.name,
//     date:        reservation.date?.toISOString().slice(0, 10),
//   }).catch(() => {});
//
// W metodzie cancel() — po zmianie statusu:
//   this.integrationEvents.onReservationCancelled(actorOrgId ?? '', {
//     id: id,
//   }).catch(() => {});


// backend/src/modules/checkins/checkins.service.ts
// ─── W metodzie nfcCheckin() — po LED emit ───────────────────────────────────
//   this.integrationEvents.onCheckin(
//     desk.location?.organizationId ?? '',
//     'nfc',
//     { deskId: desk.id, deskName: desk.name, userId: user.id,
//       userName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() },
//   ).catch(() => {});
//
// ─── Analogicznie w checkinQr() i manual() ──────────────────────────────────


// backend/src/modules/devices/devices.service.ts (lub mqtt.handlers.ts)
// ─── Gdy beacon przechodzi offline: ─────────────────────────────────────────
//   this.integrationEvents.onBeaconOffline(orgId, {
//     deviceId:    device.hardwareId,
//     deskName:    device.desk?.name,
//     locationName: device.desk?.location?.name,
//     lastSeenAgo: Math.round((Date.now() - device.lastSeen.getTime()) / 1000),
//   }).catch(() => {});


// ═══════════════════════════════════════════════════════════════════════════
// PATCH 5: INTEGRATION_ENCRYPTION_KEY — nowa zmienna środowiskowa
// ═══════════════════════════════════════════════════════════════════════════

// .env backendu — DODAJ:
// INTEGRATION_ENCRYPTION_KEY=<64 hex chars>
//
// Generuj:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// NIGDY nie używaj tego samego klucza co SMTP_ENCRYPTION_KEY.
// Klucz musi być zapisany bezpiecznie (password manager / Vault).
// Utrata klucza = niemożność odczytu credentiali wszystkich integracji.

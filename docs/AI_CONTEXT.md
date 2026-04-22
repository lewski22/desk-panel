# Reserti — AI_CONTEXT (Zbiorczy v0.17.2)
> **Data:** 2026-04-22 | **Repo:** `github.com/lewski22/desk-panel`
> Zastępuje wszystkie docs/AI_*.md. Jedyne źródło prawdy dla sesji AI.

---

## 1. PROJEKT

**Reserti** = SaaS IoT hot-desk booking platform. Składa się z:
- ESP32 beaconów (NFC + LED) przy biurkach
- Raspberry Pi gatewayów (MQTT bridge, offline-first SQLite cache)
- NestJS backendu (multi-tenant REST API)
- React Staff Panel (rezerwacje, mapa biurek, admin)
- Microsoft Teams App (rezerwacje z Teams)

**Produkcja:** `api.prohalw2026.ovh/api/v1`, `staff.prohalw2026.ovh`, `teams.prohalw2026.ovh`
**Deploy:** Coolify na Proxmox LXC + Cloudflare Tunnel (HTTPS automatycznie)
**Stack:** NestJS 11 + Prisma 5 + PostgreSQL 15 + React 18/Vite + ESP32 PlatformIO
**Repo:** monorepo `desk-panel` (backend + apps/unified + apps/teams)

---

## 2. APP.MODULE.TS — AKTUALNY STAN

```typescript
// backend/src/app.module.ts — pełna lista imports[]
ConfigModule.forRoot({ isGlobal: true }),
ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 30 }]),
ScheduleModule.forRoot(),
SharedModule,           // LedEventsService @Global rxjs Subject
DatabaseModule,         // PrismaService @Global
AuthModule,             // JWT + Local + Azure SSO + Google SSO
UsersModule,
OrganizationsModule,
LocationsModule,
DesksModule,
DevicesModule,
GatewaysModule,         // + InstallController poza /api/v1
ResourcesModule,        // Sale/Parking/Equipment
PushModule,             // Web Push VAPID
VisitorsModule,
SubscriptionsModule,
ReservationsModule,
CheckinsModule,
MqttModule,
OwnerModule,
MetricsModule,          // Prometheus poza /api/v1
NotificationsModule,
InAppNotificationsModule,
// ── DODANE 2026-04-18 ─────────────────────────────
IntegrationsModule,     // @Global — Sprint F
RecommendationsModule,  // Sprint K1
InsightsModule,         // Sprint K2
GraphSyncModule,        // M4 — Microsoft Graph
```

**main.ts — exclude (bez /api/v1 prefiksu):**
```typescript
app.setGlobalPrefix('api/v1', {
  exclude: [
    { path: 'install/{*path}',      method: RequestMethod.GET  },
    { path: 'metrics',              method: RequestMethod.GET  },
    { path: 'health',               method: RequestMethod.GET  },
    { path: 'auth/google/callback', method: RequestMethod.GET  }, // Google OAuth2
    { path: 'auth/graph/redirect',  method: RequestMethod.GET  }, // MS Graph OAuth2
    { path: 'auth/graph/callback',  method: RequestMethod.GET  }, // MS Graph OAuth2
    { path: 'graph/webhook',        method: RequestMethod.POST }, // MS Graph notyfikacje
  ],
});
```

---

## 3. PRISMA SCHEMA — PEŁNY STAN

### Enums

```prisma
enum UserRole       { OWNER | SUPER_ADMIN | OFFICE_ADMIN | STAFF | END_USER }
enum DeskStatus     { ACTIVE | INACTIVE | MAINTENANCE }
enum ReservationStatus { PENDING | CONFIRMED | CANCELLED | EXPIRED | COMPLETED }
enum CheckinMethod  { NFC | QR | MANUAL }
enum EventType {
  DESK_CREATED | DESK_UPDATED | DESK_STATUS_CHANGED
  RESERVATION_CREATED | RESERVATION_CANCELLED | RESERVATION_EXPIRED
  CHECKIN_NFC | CHECKIN_QR | CHECKIN_MANUAL | CHECKOUT
  DEVICE_ONLINE | DEVICE_OFFLINE | DEVICE_PROVISIONED | DEVICE_OTA_SUCCESS | DEVICE_OTA_FAILED
  GATEWAY_ONLINE | GATEWAY_OFFLINE | GATEWAY_RESET
  UNAUTHORIZED_SCAN | USER_CREATED | USER_UPDATED | OWNER_IMPERSONATION
}
enum NotificationType {
  FIRMWARE_UPDATE_AVAILABLE | GATEWAY_OFFLINE | BEACON_OFFLINE
  RESERVATION_CONFIRMED | RESERVATION_REMINDER | RESERVATION_CANCELLED
  CHECKIN_MISSED | DAILY_REPORT
}
enum InAppNotifType {
  GATEWAY_OFFLINE | GATEWAY_BACK_ONLINE | BEACON_OFFLINE | FIRMWARE_UPDATE
  GATEWAY_RESET_NEEDED | RESERVATION_CHECKIN_MISSED | SYSTEM_ANNOUNCEMENT
  GATEWAY_KEY_ROTATION_FAILED | SUBSCRIPTION_EXPIRING | SUBSCRIPTION_EXPIRED
  TRIAL_EXPIRING | LIMIT_WARNING
}
// NOWE 2026-04-18:
enum IntegrationProvider {
  AZURE_ENTRA | SLACK | GOOGLE_WORKSPACE | MICROSOFT_TEAMS | WEBHOOK_CUSTOM
}
```

### Modele

```prisma
model Organization {
  id             String   @id @default(cuid())
  name           String
  slug           String   @unique
  isActive       Boolean  @default(true)
  plan           String   @default("starter")  // starter|pro|enterprise|trial
  planExpiresAt  DateTime?
  trialEndsAt    DateTime?
  limitDesks     Int?     // null = ∞
  limitUsers     Int?
  limitGateways  Int?
  limitLocations Int?
  billingEmail   String?
  mrr            Int?     // grosze PLN
  nextInvoiceAt  DateTime?
  notes          String?  @db.Text
  contactEmail   String?
  createdBy      String?
  enabledModules String[] @default([])
  // DEPRECATED (→ OrgIntegration backward compat przez 2 wersje):
  azureTenantId  String?
  azureEnabled   Boolean  @default(false)
  integrations   OrgIntegration[]  // NOWE 2026-04-18
}

model Location {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  address        String?
  city           String?
  timezone       String   @default("Europe/Warsaw")
  isActive       Boolean  @default(true)
  openTime       String   @default("08:00")
  closeTime      String   @default("17:00")
  maxDaysAhead   Int      @default(14)
  maxHoursPerDay Int      @default(8)
  kioskPin       String?
  floorPlanUrl   String?
  floorPlanKey   String?  // NOWE 2026-04-18 (R2/S3 key)
  floorPlanW     Int?
  floorPlanH     Int?
  gridSize       Int?     @default(40)
  insights       UtilizationInsight[]  // Sprint K2
  floorPlans     LocationFloorPlan[]   // per-floor plan images (2026-04-22)
}

model Desk {
  id         String     @id @default(cuid())
  locationId String
  name       String
  code       String
  floor      String?
  zone       String?
  status     DeskStatus @default(ACTIVE)
  qrToken    String     @unique @default(cuid())
  posX       Float?
  posY       Float?
  rotation   Int?       @default(0)
  width      Float?     @default(2)
  height     Float?     @default(1)
  @@unique([locationId, code])
}

model Device {
  id              String   @id @default(cuid())
  deskId          String?  @unique
  gatewayId       String?
  hardwareId      String   @unique
  mqttUsername    String   @unique
  mqttPasswordHash String
  firmwareVersion String?
  lastSeen        DateTime?
  isOnline        Boolean  @default(false)
  rssi            Int?
  otaStatus       String?  // idle | in_progress | success | failed
  otaVersion      String?
  otaStartedAt    DateTime?
  otaFinishedAt   DateTime?
}

model Gateway {
  id                     String    @id @default(cuid())
  locationId             String
  name                   String
  secretHash             String
  secretHashPending      String?
  secretPendingExpiresAt DateTime?
  ipAddress              String?
  lastSeen               DateTime?
  isOnline               Boolean   @default(false)
  version                String?
}

model GatewaySetupToken {
  id         String    @id @default(cuid())
  token      String    @unique @default(cuid())
  locationId String
  gatewayId  String?
  createdBy  String
  expiresAt  DateTime
  usedAt     DateTime?
}

model User {
  id             String    @id @default(cuid())
  organizationId String?
  email          String    @unique
  passwordHash   String    // 'AZURE_SSO_ONLY' | 'GOOGLE_SSO_ONLY' dla kont SSO
  firstName      String?
  lastName       String?
  role           UserRole  @default(END_USER)
  cardUid        String?   @unique
  isActive       Boolean   @default(true)
  azureObjectId  String?   @unique
  azureTenantId  String?
  deletedAt      DateTime?
  scheduledDeleteAt DateTime?
  retentionDays  Int?
  graphToken     GraphToken?          // NOWE 2026-04-18
  graphSubscriptions GraphSubscription[] // NOWE 2026-04-18
}

model Reservation {
  id                String            @id @default(cuid())
  deskId            String
  userId            String
  date              DateTime          @db.Date
  startTime         DateTime
  endTime           DateTime
  status            ReservationStatus @default(PENDING)
  qrToken           String            @unique @default(cuid())
  notes             String?
  checkedInAt       DateTime?
  checkedInMethod   String?
  recurrenceRule    String?
  recurrenceGroupId String?
  graphEventId      String?  // NOWE 2026-04-18 (Outlook Calendar event ID)
}

model Checkin {
  id            String        @id @default(cuid())
  reservationId String?       @unique
  deskId        String
  userId        String
  method        CheckinMethod
  cardUid       String?
  checkedInAt   DateTime      @default(now())
  checkedOutAt  DateTime?
}

model Resource {
  id          String  @id @default(cuid())
  locationId  String
  type        String  // ROOM | PARKING | EQUIPMENT
  name        String
  code        String
  description String?
  capacity    Int?
  amenities   String[]
  vehicleType String?
  floor       String?
  zone        String?
  status      String  @default("ACTIVE")
  posX        Float?
  posY        Float?
  rotation    Int?
  bookings    Booking[]
}

model Booking {
  id         String   @id @default(cuid())
  resourceId String
  userId     String
  date       DateTime @db.Date
  startTime  DateTime
  endTime    DateTime
  status     String   @default("CONFIRMED")
  notes      String?
}

model Visitor {
  id         String   @id @default(cuid())
  locationId String
  hostId     String
  name       String
  email      String?
  company    String?
  purpose    String?
  status     String   @default("INVITED")
  qrToken    String   @unique @default(cuid())
  invitedAt  DateTime @default(now())
  checkedInAt DateTime?
  checkedOutAt DateTime?
}

model PushSubscription {
  id       String @id @default(cuid())
  userId   String
  endpoint String @unique
  p256dh   String
  auth     String
}

model SubscriptionEvent {
  id             String   @id @default(cuid())
  organizationId String
  type           String   // plan_changed|renewed|expired|trial_started|limit_exceeded
  previousPlan   String?
  newPlan        String?
  changedBy      String?
  note           String?
}

model OrganizationSmtpConfig {
  id             String   @id @default(cuid())
  organizationId String   @unique
  host           String
  port           Int      @default(587)
  secure         Boolean  @default(false)
  user           String
  passwordEnc    String   // AES-256-GCM (SMTP_ENCRYPTION_KEY)
  fromName       String   @default("Reserti")
  fromEmail      String
  isVerified     Boolean  @default(false)
  lastTestedAt   DateTime?
}

// ── NOWE MODELE 2026-04-18 ─────────────────────────────────────────────────

model OrgIntegration {
  id               String              @id @default(cuid())
  organizationId   String
  provider         IntegrationProvider
  isEnabled        Boolean             @default(false)
  configEncrypted  String?             // AES-256-GCM (INTEGRATION_ENCRYPTION_KEY)
  displayName      String?
  tenantHint       String?             // Azure: tenantId plaintext; Slack: workspace
  lastTestedAt     DateTime?
  lastTestOk       Boolean?
  lastTestError    String?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
  @@unique([organizationId, provider])
  @@index([organizationId])
}

model LocationFloorPlan {
  id           String   @id @default(cuid())
  locationId   String
  floor        String   // np. "0", "1", "A", "Parter"
  floorPlanUrl String?
  floorPlanKey String?  // R2/S3 CDN key (future)
  floorPlanW   Int?
  floorPlanH   Int?
  gridSize     Int?     @default(40)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@unique([locationId, floor])
  @@index([locationId])
}

model UtilizationInsight {
  id          String   @id @default(cuid())
  locationId  String
  orgId       String
  generatedAt DateTime @default(now())
  periodDays  Int      @default(30)
  insights    Json     @default("[]")  // InsightItem[]
  @@index([locationId])
  @@index([orgId, generatedAt(sort: Desc)])
}

model GraphToken {
  id              String   @id @default(cuid())
  userId          String   @unique
  organizationId  String
  accessTokenEnc  String   // AES-256-GCM (INTEGRATION_ENCRYPTION_KEY)
  refreshTokenEnc String   // AES-256-GCM
  expiresAt       DateTime
  scope           String   @default("Calendars.ReadWrite offline_access User.Read")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@index([organizationId])
  @@index([expiresAt])
}

model GraphSubscription {
  id             String   @id @default(cuid())
  userId         String
  subscriptionId String   @unique
  calendarId     String   @default("primary")
  expiresAt      DateTime // max ~3 dni — cron odnawia co 24h
  clientState    String   // secret do walidacji webhooków Microsoft
  createdAt      DateTime @default(now())
  @@index([userId])
  @@index([expiresAt])
}
```

### Migracje (kolejność)

```
20260407000000_init
20260407000001_location_limits
20260407000002_gateway_key_rotation
20260409000000_cascade_desk_delete
20260409000001_notifications
20260409000002_org_smtp
20260409000003_inapp_notifications
20260409000004_device_ota_status
20260416000001_gateway_key_rotation_notif  ← no-transaction
20260417000001_sprints_schema               ← skonsolidowana D-B
20260418000001_add_floor_plan_key           ← Tech Debt #3
20260418000002_add_utilization_insight      ← Sprint K
20260418000003_add_org_integration          ← Sprint F + data migration
20260418000004_add_graph_sync               ← M4
20260421000001_location_floor_plans         ← Multi-floor per-location plan images
```

---

## 4. REST API — PEŁNA LISTA

### Auth

```
POST   /api/v1/auth/login                    throttle 5/min
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
PATCH  /api/v1/auth/change-password          JWT required
POST   /api/v1/auth/azure                    Azure ID token → Reserti JWT
GET    /api/v1/auth/azure/check?email=       publiczny
GET    /api/v1/auth/google/redirect          JWT required → redirect do Google
GET    /auth/google/callback                 POZA /api/v1 (Google callback)
GET    /api/v1/auth/google/check?email=      publiczny
GET    /auth/graph/redirect                  POZA /api/v1, JWT required → MS OAuth2
GET    /auth/graph/callback                  POZA /api/v1 (MS Graph callback)
```

### Microsoft Graph (NOWE 2026-04-18)

```
POST   /graph/webhook                        POZA /api/v1, publiczny — MS notyfikacje
GET    /api/v1/graph/status                  JWT — status połączenia
POST   /api/v1/graph/subscribe               JWT — utwórz webhook subskrypcję
DELETE /api/v1/graph/disconnect              JWT — odłącz Graph
```

### Integracje (NOWE 2026-04-18)

```
GET    /api/v1/integrations                  OWNER/SUPER_ADMIN
GET    /api/v1/integrations/:provider
PUT    /api/v1/integrations/:provider        upsert konfiguracji
PATCH  /api/v1/integrations/:provider/toggle
DELETE /api/v1/integrations/:provider
POST   /api/v1/integrations/:provider/test   → { ok, message }
```
`provider` ∈ `AZURE_ENTRA | SLACK | GOOGLE_WORKSPACE | MICROSOFT_TEAMS | WEBHOOK_CUSTOM`

### AI Recommendations + Insights (NOWE 2026-04-18)

```
GET    /api/v1/desks/recommended?locationId=&date=&start=&end=
       → { recommendation: DeskRecommendation | null }
GET    /api/v1/insights?locationId=          STAFF+
GET    /api/v1/insights/org?orgId=           OWNER/SUPER_ADMIN
POST   /api/v1/insights/refresh?locationId=  OFFICE_ADMIN+
```

### Reports (NOWE 2026-04-18)

```
GET    /api/v1/reports/heatmap?locationId=&from=&to=
GET    /api/v1/reports/export?locationId=&from=&to=&format=csv|xlsx
```

### Desks

```
GET    /api/v1/locations/:locId/desks
GET    /api/v1/locations/:locId/desks/status  live occupancy map
GET    /api/v1/desks/available?locationId=&date=&startTime=&endTime=
GET    /api/v1/desks/:id
GET    /api/v1/desks/:id/availability?date=
GET    /api/v1/desks/qr/:token               publiczny
POST   /api/v1/locations/:locId/desks
PATCH  /api/v1/desks/:id
PATCH  /api/v1/desks/batch-positions
DELETE /api/v1/desks/:id
DELETE /api/v1/desks/:id/permanent
POST   /api/v1/desks/:id/activate
DELETE /api/v1/desks/:id/unpair
```

### Reservations

```
GET    /api/v1/reservations/my?date=&limit=
GET    /api/v1/reservations?locationId=&deskId=&date=&status=   STAFF+
GET    /api/v1/reservations/:id
GET    /api/v1/reservations/:id/qr
POST   /api/v1/reservations
POST   /api/v1/reservations/recurring
POST   /api/v1/reservations/:id/cancel-recurring { scope: single|following|all }
DELETE /api/v1/reservations/:id
```

### Check-ins

```
POST   /api/v1/checkins/nfc                  auth: x-gateway-id + x-gateway-secret
POST   /api/v1/checkins/qr                   JWT
POST   /api/v1/checkins/qr/walkin            JWT — tworzy rezerwację + check-in
POST   /api/v1/checkins/manual               STAFF+
PATCH  /api/v1/checkins/:id/checkout
```

### Locations

```
GET    /api/v1/locations/my
GET    /api/v1/locations
POST   /api/v1/locations
PATCH  /api/v1/locations/:id
DELETE /api/v1/locations/:id
GET    /api/v1/locations/:id/floors              → string[] (lista pięter z planami)
GET    /api/v1/locations/:id/floor-plan?floor=  zwraca meta (url, w, h, gridSize); bez ?floor → backward compat z Location
POST   /api/v1/locations/:id/floor-plan?floor=  upload base64 PNG/SVG; bez ?floor → Location (backward compat)
POST   /api/v1/locations/:id/floor-plan/delete?floor=
GET    /api/v1/locations/:id/attendance?week=
POST   /api/v1/locations/:id/kiosk/verify-pin
```

### Resources + Visitors + Users + Owner — pełna lista w docs/api.md

### Install + Metrics (poza /api/v1)

```
GET    /install/gateway/:token               bash script
GET    /metrics                              Prometheus (IP whitelist)
GET    /health
```

---

## 5. NOWE MODUŁY — SZCZEGÓŁY (2026-04-18)

### IntegrationsModule (@Global)

```
src/modules/integrations/
  integrations.module.ts        @Global, exports IntegrationEventService
  integrations.service.ts       CRUD + AES-256-GCM + _scrubSecrets()
  integrations.controller.ts    REST + org isolation
  integration-crypto.service.ts AES-256-GCM (INTEGRATION_ENCRYPTION_KEY)
  integration-event.service.ts  dispatcher fire-and-forget
  providers/
    azure.provider.ts    OIDC discovery test, BYOA
    slack.provider.ts    chat.postMessage, auth.test
    google.provider.ts   OAuth2 buildAuthUrl, verifyIdToken(hd=)
    teams.provider.ts    Incoming Webhook, Adaptive Card
    webhook.provider.ts  HMAC-SHA256, retry 3× (5s/30s/120s)
  types/integration-config.types.ts
```

**IntegrationEventService** — wstrzyknij w: `reservations.service`, `checkins.service`, `inapp-notifications.service`:

```typescript
// reservations.service.ts — po create():
this.integrationEvents.onReservationCreated(orgId, { id, deskName, date, startTime, endTime }).catch(() => {});

// reservations.service.ts — po cancel():
this.integrationEvents.onReservationCancelled(orgId, { id, deskName }).catch(() => {});

// checkins.service.ts — po NFC/QR/manual emit LED:
this.prisma.desk.findUnique({ where: { id: deskId }, select: { name: true, location: { select: { organizationId: true, name: true } } } })
  .then(d => d && this.integrationEvents.onCheckin(d.location.organizationId, 'nfc'|'qr'|'manual', { deskId, deskName: d.name, userId, ... }))
  .catch(() => {});

// inapp-notifications.service.ts — w scanInfrastructure() cron:
if (orgId) this.integrationEvents.onGatewayOffline(orgId, { gatewayId: gw.id, locationName }).catch(() => {});
if (orgId) this.integrationEvents.onBeaconOffline(orgId, { deviceId, deskName, locationName, lastSeenAgo }).catch(() => {});
// + zaktualizuj isOnline = false w DB po dispatch
```

**OrgIntegration config shapes (szyfrowane JSON):**

```typescript
AzureEntraConfig:  { tenantId, useCustomApp, clientId?, clientSecret?, allowedDomains[], groupSync }
SlackConfig:       { botToken, signingSecret, defaultChannel, notifyOnReservation, notifyOnCheckin, notifyOnBeaconAlert, notifyOnGatewayAlert }
GoogleWorkspaceConfig: { clientId, clientSecret, allowedDomain }
MicrosoftTeamsConfig:  { incomingWebhookUrl, notifyOnReservation, notifyOnCheckin, notifyOnBeaconAlert, notifyOnGatewayAlert }
WebhookCustomConfig:   { url, secret, events[], timeoutMs, maxRetries, headers? }
```

**AzureAuthService — backward compat:**
```
_resolveOrgByTenantId():
  1. Szukaj w OrgIntegration (provider=AZURE_ENTRA, isEnabled=true, tenantHint=tenantId)
  2. Fallback: Organization.azureTenantId + azureEnabled=true
```

### RecommendationsModule (K1)

Algorytm scoring:

| Sygnał | Waga |
|--------|------|
| To samo biurko co najczęściej (historia 20 rez.) | 50 pkt |
| Ta sama strefa | 25 pkt |
| Beacon online | 15 pkt |
| Użyte w ostatnich 7 dniach | 10 pkt |

Fallback chain: ulubiona strefa → dowolne wolne → null.
Twarde wykluczenia: konflikty rezerwacji, status !== ACTIVE, inna org.

### InsightsModule (K2)

Cron `0 7 * * *`, stale-while-revalidate 36h, min. 10 check-inów w 30 dniach.
Wzorce: `PEAK_DAY | UNDERUTILIZED_ZONE | GHOST_DESKS | MORNING_RUSH | NFC_VS_QR | AVG_DURATION`

### GraphSyncModule (M4)

```
src/modules/graph-sync/
  graph.service.ts     token lifecycle (auto-refresh 5min margin), Calendar CRUD,
                       webhook subscriptions, cron renewal (0 6 * * *)
  graph.controller.ts  /auth/graph/redirect|callback (POZA prefix), /graph/webhook|status|subscribe|disconnect
  graph-sync.module.ts exports GraphService
```

**Graph Sync flow:**
```
1. User → /auth/graph/redirect → MS OAuth2 consent (scope: Calendars.ReadWrite offline_access)
2. → /auth/graph/callback → saveTokens() → createSubscription()
3. Reservation create → graphService.createCalendarEvent() fire-and-forget → save graphEventId
4. Reservation cancel → graphService.deleteCalendarEvent(graphEventId) fire-and-forget
5. MS Graph → POST /graph/webhook → processWebhookNotification()
   - walidacja clientState → fetch event → jeśli Reserti event → sync/anuluj
6. Cron 06:00 → renewExpiringSubscriptions() (próg: expiresAt < now+48h)
```

**GraphToken storage:** `accessTokenEnc` + `refreshTokenEnc` — AES-256-GCM tym samym `INTEGRATION_ENCRYPTION_KEY`.

### Google SSO (F3)

```
src/modules/auth/google-auth.service.ts
  buildRedirectUrl(orgId, redirectUrl?)  → URL z state=base64({nonce, orgId}) + hd=domain
  handleCallback(code, state)           → exchange code → verify id_token → JIT provision → JWT
  checkAvailable(email?, orgSlug?)      → { available, domain? }
```

Nonce store: in-memory Map, TTL 10min, jednorazowy (delete po użyciu).
JIT provisioning: `passwordHash = 'GOOGLE_SSO_ONLY'`, rola `END_USER`, organizationId z OrgIntegration.

---

## 6. FRONTEND (apps/unified) — STAN

### Design system (2026-04-22)

**Kolor brand** — jeden token w dwóch miejscach:
- `tailwind.config.js`: `colors.brand.DEFAULT = '#B53578'`, `colors.brand.hover = '#9d2d66'`
- `src/index.css`: `:root { --brand: #B53578; --brand-hover: #9d2d66; }`
- Użycie: klasy Tailwind `bg-brand`, `text-brand`, `hover:bg-brand-hover` itp.; inline style `'var(--brand)'`
- Zmiana koloru brand = jedna linijka w `index.css` lub `tailwind.config.js`

**Paleta statusów biurek / urządzeń** — spójna we wszystkich komponentach:

| Status | Kolor | Hex | Pliki |
|--------|-------|-----|-------|
| free / wolne | emerald | `#10b981` | DeskPin, DeskToken, DeskCard, KioskPage, DashboardPage |
| reserved / zarezerwowane | amber | `#f59e0b` | j.w. |
| occupied / zajęte | red | `#ef4444` | j.w. |
| offline | zinc | `#a1a1aa` | j.w. |

**Ikony** — `components/icons/SidebarIcons.tsx` re-eksportuje ikony z `lucide-react` pod identycznymi nazwami (`IconFloorPlan`, `IconCalendar`, `IconDesk` itd.) — wszystkie konsumenci mogą importować bez zmian.

**i18n** — 100% pokrycie: zero hardkodowanych stringów PL/EN w kodzie produkcyjnym. Oba pliki: `locales/pl/translation.json` i `locales/en/translation.json`. Każda nowa strona / komponent musi używać `useTranslation()` — nie wolno wstawiać literałów.

### Strony

```
DashboardPage       ReportsPage (NOWE C)    IntegrationsPage (NOWE F)
DeskMapPage         FloorPlanPage           FloorPlanEditorPage
ReservationsAdminPage  MyReservationsPage   WeeklyViewPage
VisitorsPage        DevicesPage             ProvisioningPage
NotificationsPage   SubscriptionPage        OrganizationsPage
OwnerPage           KioskPage              ProfilePage (CalendarSyncSection)
LoginPage (Google SSO button)
```

### Nowe komponenty (2026-04-18)

```
components/integrations/
  ProviderCard.tsx + forms/{Azure,Slack,Google,Teams,Webhook}ConfigForm.tsx
components/insights/InsightsWidget.tsx       compact + full + OrgInsightsWidget
components/recommendations/RecommendationBanner.tsx   dismissable, localStorage per userId+date
components/calendar/CalendarSyncSection.tsx  Outlook connect/disconnect
components/calendar/GraphConnectButton.tsx
KioskLinkButton.tsx
```

### api/client.ts — nowe metody

```typescript
appApi.desks.getRecommended({ locationId, date, start?, end? })

appApi.insights.getForLocation(locationId)
appApi.insights.getForOrg(orgId?)
appApi.insights.refresh(locationId)

appApi.integrations.list()
appApi.integrations.get(provider)
appApi.integrations.upsert(provider, { config, displayName?, tenantHint?, isEnabled? })
appApi.integrations.toggle(provider, isEnabled)
appApi.integrations.remove(provider)
appApi.integrations.test(provider)   → { ok: boolean, message: string }

appApi.graph.status()                → { connected: boolean, tokenValid?: boolean }
appApi.graph.disconnect()
appApi.graph.subscribe()

appApi.google.check(email?, orgSlug?) → { available: boolean, domain?: string }
```

### i18n — nowe namespace (2026-04-18)

```
locales/pl/integrations.json   ~80 kluczy — 5 providerów + formularze
locales/en/integrations.json
locales/graph-google.i18n.json  calendar_sync.* + google_sso.*
```

---

## 7. TEAMS APP (apps/teams) — NOWE

```
apps/teams/
  package.json              React 18 + @microsoft/teams-js + Vite (port 3003)
  manifest/manifest.json    v1.17, 3 static tabs
  Dockerfile                node:20-alpine build → nginx:1.25-alpine serve
  nginx.conf                SPA fallback + CSP frame-ancestors teams.microsoft.com
  src/
    auth/teamsAuth.ts       SSO: app.initialize() → getAuthToken() → POST /auth/azure
                            sessionStorage cache, 401 auto-refresh
    api/client.ts           axios + Bearer interceptor + 401 retry
    pages/
      HomePage.tsx          rezerwacje dziś + AI rekomendacja
      BookPage.tsx          5 kroków: lokalizacja → data/czas → biurko → confirm → sukces
      MyBookingsPage.tsx    lista aktywnych + anulowanie
    components/UI.tsx       Card, Btn, StatusDot, DeskGrid, TimeSlotPicker, PageShell
```

**manifest.json — wymagane placeholdery przed publikacją:**
- `REPLACE-WITH-GUID` → `node -e "console.log(require('crypto').randomUUID())"`
- `REPLACE-WITH-AZURE-CLIENT-ID` → Azure App Registration Client ID

**Azure App Registration wymagania dla Teams SSO:**
- Application ID URI: `api://teams.prohalw2026.ovh/<CLIENT_ID>`
- Scope: `access_as_user`
- Trusted client IDs: `1fec8e78-...` (Teams desktop), `5e3ce6c0-...` (Teams mobile)

---

## 8. MONITORING (Sprint C)

```
monitoring/
  docker-compose.yml       Prometheus 2.51 + Grafana 10.4 w Coolify
  prometheus.yml           scrape: backend :3000/metrics, gateway :9100/metrics
  grafana/dashboards/      system-health, fleet-overview, desk-analytics, iot-health
```

---

## 9. WZORCE KODU — OBOWIĄZKOWE

### Izolacja org

```typescript
// Kontroler — zawsze z JWT:
const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
// Serwis — actorOrgId jako ostatni param, walidacja przez łańcuch zasobów
// Błąd — zawsze generyczny: throw new ForbiddenException('Brak dostępu do zasobu')
```

### Fire-and-forget (integracje, Graph, notifikacje)

```typescript
// NIGDY await — nie blokuj request path
this.integrationEvents.onReservationCreated(orgId, data).catch(() => {});
this.graphService.createCalendarEvent(userId, input).then(id => {
  if (id) this.prisma.reservation.update({ where: { id: res.id }, data: { graphEventId: id } }).catch(() => {});
}).catch(() => {});
```

### Szyfrowanie integracji

```typescript
// IntegrationCryptoService (INTEGRATION_ENCRYPTION_KEY env)
const enc  = this.crypto.encrypt(plaintext);          // string
const dec  = this.crypto.tryDecrypt(enc);             // string | null (nie rzuca)
const obj  = this.crypto.decryptJson<Config>(enc);    // T | null
const str  = this.crypto.encryptJson(obj);            // string
```

### Migracje Prisma (wzorce idempotentne)

```sql
-- ALTER TYPE enum (wymaga no-transaction header):
-- This migration requires no transaction.
ALTER TYPE "EnumName" ADD VALUE IF NOT EXISTS 'NOWA_WARTOSC';

-- CREATE TYPE:
DO $$ BEGIN CREATE TYPE "MyEnum" AS ENUM ('A', 'B');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CREATE TABLE:
CREATE TABLE IF NOT EXISTS "MyTable" ("id" TEXT NOT NULL DEFAULT gen_random_uuid(), ...);

-- Data migration (idempotent):
INSERT INTO "OrgIntegration" (...) SELECT ... FROM "Organization" WHERE ...
ON CONFLICT (organizationId, provider) DO NOTHING;
```

---

## 10. ZMIENNE ŚRODOWISKOWE

```env
# ── Istniejące ────────────────────────────────────────────────
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
MQTT_BROKER_URL=mqtt://mosquitto:1883
GATEWAY_PROVISION_KEY=...
FIRMWARE_REPO=lewski22/desk-firmware
SMTP_ENCRYPTION_KEY=...                  # 64 hex — dla OrganizationSmtpConfig
SMTP_HOST= SMTP_PORT=587 SMTP_USER= SMTP_PASS= SMTP_FROM=
METRICS_ALLOWED_IPS=127.0.0.1
AZURE_CLIENT_ID=...                      # globalna App Registration
AZURE_CLIENT_SECRET=...
AZURE_REDIRECT_URI=https://api.prohalw2026.ovh/api/v1/auth/azure/callback
GATEWAY_INSTALL_SCRIPT_URL=https://raw.githubusercontent.com/.../install.sh

# ── DODANE 2026-04-18 ─────────────────────────────────────────
INTEGRATION_ENCRYPTION_KEY=             # 64 hex — dla OrgIntegration + GraphToken
VAPID_PUBLIC_KEY=                        # web-push
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@reserti.pl
R2_ACCOUNT_ID=                           # Cloudflare R2 (Floor Plan CDN)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=reserti-floor-plans
R2_PUBLIC_URL=https://cdn.reserti.pl
PUBLIC_API_URL=https://api.prohalw2026.ovh/api/v1
FRONTEND_URL=https://staff.prohalw2026.ovh
CORS_ORIGINS=https://staff.prohalw2026.ovh,https://teams.prohalw2026.ovh
```

Generowanie:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # INTEGRATION_ENCRYPTION_KEY
node backend/generate-vapid-keys.js                                         # VAPID
```

---

## 11. BEZPIECZEŃSTWO

| Aspekt | Rozwiązanie |
|--------|-------------|
| Auth API | JWT Bearer 15min + 7d refresh rotacja |
| Auth gateway | x-gateway-secret (bcrypt) + provision key |
| Auth MQTT | Mosquitto passwd + ACL per beacon |
| Multi-tenant | organizationId z JWT, nie z request |
| SMTP hasła | AES-256-GCM (SMTP_ENCRYPTION_KEY) |
| Integration credentials | AES-256-GCM (INTEGRATION_ENCRYPTION_KEY) |
| Graph tokens | AES-256-GCM (INTEGRATION_ENCRYPTION_KEY) — ten sam klucz |
| Google OAuth CSRF | nonce in-memory Map, TTL 10min, jednorazowy |
| MS Graph OAuth CSRF | state in-memory Map, TTL 10min, jednorazowy |
| Webhook HMAC | X-Reserti-Signature: sha256=hex |
| Provisioning tokens | randomBytes(32).hex, jednorazowe, TTL 24h |
| Impersonacja | JWT 30min, impersonated:true, OWNER_IMPERSONATION audit log |

---

## 12. HARDWARE

| Urządzenie | Wymagania |
|------------|-----------|
| Beacon | ESP32 (4MB flash), PN532 NFC I2C SDA=21/SCL=22, WS2812B LED pin=13 |
| Gateway | RPi 3B+/4/Zero 2W (nie 1B+ — ARMv6) |
| NTP | `time_utils.h` — ntpSync() po WiFi, fallback EPOCH_2024+millis()/1000 |

---

## 13. KONTA TESTOWE

```
owner@reserti.pl      Owner1234!    OWNER
superadmin@reserti.pl Admin1234!    SUPER_ADMIN
admin@demo-corp.pl    Admin1234!    OFFICE_ADMIN
staff@demo-corp.pl    Staff1234!    STAFF
user@demo-corp.pl     User1234!     END_USER
```

---

## 14. TYPOWE BŁĘDY

| Błąd | Rozwiązanie |
|------|-------------|
| `ENOTFOUND mosquitto` | healthcheck na mosquitto w docker-compose |
| `0700 passwd file` | `chmod 0600 + chown mosquitto:mosquitto` |
| `Cannot inject GraphService` | GraphSyncModule w ReservationsModule.imports[] I AppModule.imports[] |
| `Cannot inject IntegrationEventService` | IntegrationsModule musi być @Global() |
| `POST /graph/webhook → 404` | Dodaj do main.ts exclude list |
| Graph token wygasa co 1h | Azure: dodaj `offline_access` w API permissions + re-consent |
| `INTEGRATION_ENCRYPTION_KEY 64 hex` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| OTA stuck in_progress | cron timeoutStaleOta() po 10min → failed |

---

## 15. ROADMAP

| Wersja | Status | Co |
|--------|--------|----|
| v0.11.0 | ✅ | i18n + PWA + testy + OTA |
| v0.12.0 | ✅ | Sprinty A-J + Prisma fix |
| v0.12.1 | ✅ | Sprint C (Grafana + Reports) |
| v0.12.2 | ✅ | Tech Debt (VAPID, Floor Plan CDN, Playwright, NTP) |
| v0.15.1 | ✅ | Sprint K (AI Recommendations + Insights) |
| **v0.17.0** | ✅ **2026-04-18** | **Sprint F (Integrations) + Teams App + Graph Sync + Google SSO** |
| **v0.17.1** | ✅ **2026-04-21** | **i18n 100% + status colors (amber/red) + brand token centralizacja + security fixes (privilege escalation, IDOR)** |
| **v0.17.2** | ✅ **2026-04-22** | **Lucide icons + i18n audit (ChangePasswordModal, AppLayout, OrganizationsPage) + FloorPlanEditor position sync + KioskPage PWA install + LocationFloorPlan multi-floor backend** |
| v0.18.0 | Q2 2026 | Multi-floor frontend editor + Stripe public booking |
| v1.0.0 | Q1 2027 | Self-hosted + ISO 27001 |

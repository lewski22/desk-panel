# Reserti — AI Context (zbiorczy)

> **Ostatnia aktualizacja:** 2026-05-08 | **Wersja:** v0.17.10 | **Repo:** `github.com/lewski22/desk-panel`
> Jedyne źródło prawdy dla sesji AI.

---

## 1. PROJEKT

**Reserti** = SaaS IoT hot-desk booking platform. Składa się z:
- ESP32 beaconów (NFC + LED) przy biurkach
- Raspberry Pi gatewayów (MQTT bridge, offline-first SQLite cache)
- NestJS backendu (multi-tenant REST API)
- React Unified Panel (rezerwacje, mapa biurek, admin)
- Microsoft Teams App (rezerwacje z Teams)

**Produkcja:** `api.prohalw2026.ovh/api/v1`, `app.prohalw2026.ovh`, `teams.prohalw2026.ovh`
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
    { path: 'auth/google/callback', method: RequestMethod.GET  },
    { path: 'auth/graph/redirect',  method: RequestMethod.GET  },
    { path: 'auth/graph/callback',  method: RequestMethod.GET  },
    { path: 'graph/webhook',        method: RequestMethod.POST },
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
enum EventType      { DESK_CREATED | DESK_UPDATED | ... | OWNER_IMPERSONATION }
enum NotificationType { FIRMWARE_UPDATE_AVAILABLE | GATEWAY_OFFLINE | ... | DAILY_REPORT }
enum InAppNotifType { GATEWAY_OFFLINE | ... | LIMIT_WARNING }
enum IntegrationProvider { AZURE_ENTRA | SLACK | GOOGLE_WORKSPACE | MICROSOFT_TEAMS | WEBHOOK_CUSTOM }
```

### Modele (kluczowe pola)

```prisma
model Organization {
  id, name, slug @unique, isActive, plan, planExpiresAt, trialEndsAt
  limitDesks?, limitUsers?, limitGateways?, limitLocations?
  billingEmail?, mrr?, notes?, enabledModules String[] @default([])
  customAmenities String[] @default([])
  passwordExpiryDays Int?   // null = brak rotacji; 1-365 = dni do wygaśnięcia hasła
  azureTenantId?, azureEnabled  // DEPRECATED
  integrations OrgIntegration[]
}

model Location {
  id, organizationId, name, address?, city?
  timezone @default("Europe/Warsaw"), isActive, openTime, closeTime
  maxDaysAhead @default(14), maxHoursPerDay @default(8), kioskPin?
  floorPlanUrl?, floorPlanKey?, floorPlanW?, floorPlanH?, gridSize? @default(40)
  floorPlans LocationFloorPlan[]
}

model Desk {
  id, locationId, name, code, floor?, zone?, status DeskStatus @default(ACTIVE)
  qrToken @unique, posX?, posY?, rotation? @default(0), width? @default(2), height? @default(1)
  @@unique([locationId, code])
}

model Reservation {
  id, deskId, userId, date DateTime @db.Date, startTime, endTime
  status ReservationStatus @default(PENDING), qrToken @unique
  notes?, checkedInAt?, checkedInMethod?
  recurrenceRule?, recurrenceGroupId?, graphEventId?
  @@index([deskId, date, status])
}

model Checkin {
  id, reservationId? @unique, deskId, userId, method CheckinMethod
  cardUid?, checkedInAt @default(now()), checkedOutAt?
  @@index([deskId, checkedOutAt])
}

model Device {
  id, deskId? @unique, gatewayId?, hardwareId @unique, mqttUsername @unique
  mqttPasswordHash, firmwareVersion?, lastSeen?, isOnline @default(false), rssi?
  otaStatus?, otaVersion?, otaStartedAt?, otaFinishedAt?
}

model OrgIntegration {
  id, organizationId, provider IntegrationProvider, isEnabled @default(false)
  configEncrypted?, displayName?, tenantHint?
  @@unique([organizationId, provider])
}

model LocationFloorPlan {
  id, locationId, floor, floorPlanUrl?, floorPlanW?, floorPlanH?, gridSize? @default(40)
  @@unique([locationId, floor])
}

// User (kluczowe pola bezpieczeństwa):
//   passwordHash, mustChangePassword Boolean @default(false)
//   passwordChangedAt DateTime?, createdAt, updatedAt
// + Gateway, GatewaySetupToken, Resource, Booking, Visitor
// + PushSubscription, SubscriptionEvent, OrganizationSmtpConfig
// + UtilizationInsight, GraphToken, GraphSubscription, InvitationToken
```

### Migracje (kolejność)

```
20260407000000_init
20260409000000_cascade_desk_delete ... 20260409000004_device_ota_status
20260416000001_gateway_key_rotation_notif
20260417000001_sprints_schema              ← skonsolidowana D-B
20260418000001_add_floor_plan_key
20260418000002_add_utilization_insight
20260418000003_add_org_integration
20260418000004_add_graph_sync
20260419000001_fix_notiftype_to_text
20260419000002_plan_templates
20260420000001_checkin_method_web
20260421000001_location_floor_plans
20260422000001_invitation_tokens
20260423000001_add_perf_indexes           ← indeksy wydajnościowe
20260507000001_custom_amenities           ← Organization.customAmenities
20260507000002_password_policy            ← User.mustChangePassword + passwordChangedAt, Org.passwordExpiryDays
```

---

## 4. REST API — PEŁNA LISTA

```
POST   /api/v1/auth/login                  throttle 5/min
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/invite                 Admin → wysyła zaproszenie
GET    /api/v1/auth/invite/:token          publiczny
POST   /api/v1/auth/register               publiczny, throttle 5/min
PATCH  /api/v1/auth/change-password
POST   /api/v1/auth/azure                  Azure ID token → JWT
GET    /api/v1/auth/azure/check?email=     publiczny
GET    /auth/google/callback               POZA /api/v1
GET    /api/v1/auth/google/check?email=    publiczny
GET    /auth/graph/redirect                POZA /api/v1, JWT required
GET    /auth/graph/callback                POZA /api/v1
POST   /graph/webhook                      POZA /api/v1, MS notyfikacje
GET    /api/v1/graph/status
POST   /api/v1/graph/subscribe
DELETE /api/v1/graph/disconnect

GET/POST/PATCH/DELETE /api/v1/locations/:id (+ floor-plan, floors, attendance, kiosk)
GET/POST/PATCH/DELETE /api/v1/locations/:locId/desks
GET/POST/PATCH/DELETE /api/v1/desks/:id (+ batch-positions, availability, qr, recommended)
GET/POST/PATCH/DELETE /api/v1/reservations (+ /my, /recurring, /cancel-recurring)
POST   /api/v1/checkins/nfc|qr|qr/walkin|manual
PATCH  /api/v1/checkins/:id/checkout
GET/POST/PATCH/DELETE /api/v1/users/:id (+ card, nfc-scan, deactivate, restore)
GET/POST/PATCH/DELETE /api/v1/devices/:id (+ assign, command, firmware, ota)
GET/POST/DELETE        /api/v1/gateway (+ setup-tokens, regenerate-secret, update)
GET/POST/DELETE        /api/v1/locations/:locId/resources
GET/POST/PATCH/DELETE  /api/v1/resources/:id (+ availability, bookings)
GET/POST/PATCH/DELETE  /api/v1/visitors/:id
GET/PUT/PATCH/DELETE   /api/v1/integrations/:provider (+ toggle, test)
GET    /api/v1/insights?locationId=
GET    /api/v1/reports/heatmap | export
GET    /api/v1/organizations/me/amenities               SUPER_ADMIN własna org
PUT    /api/v1/organizations/me/amenities               SUPER_ADMIN własna org
POST   /api/v1/organizations/:id/force-password-reset   SUPER_ADMIN (własna org) + OWNER
GET/POST/PATCH/DELETE  /api/v1/owner/organizations/:id (+ subscription, modules, impersonate)
POST   /api/v1/owner/organizations/:id/force-password-reset  OWNER — per org
POST   /api/v1/owner/force-password-reset               OWNER — cała platforma
GET    /api/v1/subscription/status
GET    /install/gateway/:token             POZA /api/v1 — bash script
GET    /metrics | /health                  POZA /api/v1
```

---

## 5. FRONTEND (apps/unified) — STAN

### Design system

- **Design tokens:** jedyne źródło prawdy → `design/brand.tokens.ts`
  Generator: `npm run tokens` → regeneruje `tailwind.config.js`,
  `src/index.css`, `docs/DESIGN_TOKENS.md`
- **Kolor brand:** `#B53578` (primary) / `#9C2264` (hover/sidebar)
  Klasy Tailwind: `bg-brand`, `text-brand`, `border-brand`, `hover:bg-brand-hover`
  CSS vars: `--brand`, `--brand-hover`, `--brand-surface`
- **Paleta ink:** `#1A0A2E` primary / `#6B5F7A` muted / `#A898B8` faint
- **Paleta statusów:** `--status-free` #10B981 / `--status-pending` #F59E0B
  / `--status-occ` #EF4444 / `--status-offline` #71717A
- **Ikony:** Tabler Icons (klasy CSS `ti-*`, już załadowane) — zero emoji w UI.
  Dekoracyjne: `aria-hidden="true"` zawsze.
- **Dokumentacja tokenów:** `docs/DESIGN_TOKENS.md` (generowana)
- **i18n:** 100% pokrycie, `useTranslation()` wszędzie, zero literałów PL/EN w kodzie

### Kluczowe wzorce w client.ts

```typescript
// Singleton refresh — eliminuje race condition przy równoległych 401
let _refreshPromise: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => { /* ... */ })().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

// Debounce getMe() na visibilitychange (App.tsx)
let timer: ReturnType<typeof setTimeout>;
const onVisible = () => {
  if (document.visibilityState !== 'visible') return;
  clearTimeout(timer);
  timer = setTimeout(() => appApi.auth.getMe().then(setUser).catch(() => {}), 2000);
};
```

### Strony

```
DashboardPage, ReportsPage, IntegrationsPage
DeskMapPage, FloorPlanEditorPage, FloorPlanPage
ReservationsAdminPage, MyReservationsPage, WeeklyViewPage
VisitorsPage, DevicesPage, ProvisioningPage
NotificationsPage, NotificationRulesPage, SubscriptionPage
OrganizationsPage, OwnerPage, KioskPage
LoginPage, RegisterPage, ImpersonatePage, ChangePasswordPage
```

---

## 6. TEAMS APP (apps/teams)

```
apps/teams/
  manifest/manifest.json  v1.17, 3 static tabs
  src/auth/teamsAuth.ts   SSO: getAuthToken() → POST /auth/azure
  src/pages/
    HomePage.tsx          rezerwacje dziś + AI rekomendacja
    BookPage.tsx          5 kroków: lokalizacja → data/czas → biurko → confirm → sukces
    MyBookingsPage.tsx    lista aktywnych + anulowanie
```

**Azure App Registration wymagania:**
- Application ID URI: `api://teams.prohalw2026.ovh/<CLIENT_ID>`
- Scope: `access_as_user`
- Trusted client IDs: `1fec8e78-...` (Teams desktop), `5e3ce6c0-...` (Teams mobile)

---

## 7. WZORCE KODU — OBOWIĄZKOWE

### Izolacja org

```typescript
// Kontroler:
const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
// Serwis: actorOrgId jako param, walidacja przez łańcuch zasobów
// Błąd: throw new ForbiddenException('Brak dostępu do zasobu')  // zawsze generyczny
```

### Fire-and-forget (integracje, Graph, notyfikacje)

```typescript
// NIGDY await — nie blokuj request path
this.integrationEvents.onReservationCreated(orgId, data).catch(() => {});
```

### Szyfrowanie integracji

```typescript
// IntegrationCryptoService (INTEGRATION_ENCRYPTION_KEY env)
const enc = this.crypto.encrypt(plaintext);
const obj = this.crypto.decryptJson<Config>(enc);  // T | null
```

### Migracje Prisma (wzorce idempotentne)

```sql
-- ALTER TYPE (no-transaction):
-- This migration requires no transaction.
ALTER TYPE "EnumName" ADD VALUE IF NOT EXISTS 'NOWA_WARTOSC';

-- CREATE TYPE:
DO $$ BEGIN CREATE TYPE "MyEnum" AS ENUM ('A', 'B');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CREATE TABLE:
CREATE TABLE IF NOT EXISTS "MyTable" ("id" TEXT NOT NULL DEFAULT gen_random_uuid(), ...);
```

---

## 8. ZMIENNE ŚRODOWISKOWE

```env
DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
MQTT_BROKER_URL=mqtt://mosquitto:1883
GATEWAY_PROVISION_KEY
SMTP_ENCRYPTION_KEY                 # 64 hex
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI
INTEGRATION_ENCRYPTION_KEY          # 64 hex — OrgIntegration + GraphToken
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
PUBLIC_API_URL, FRONTEND_URL
CORS_ORIGINS=https://app.prohalw2026.ovh,https://teams.prohalw2026.ovh
METRICS_ALLOWED_IPS=127.0.0.1
GATEWAY_INSTALL_SCRIPT_URL
```

Generowanie kluczy:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node backend/generate-vapid-keys.js
```

---

## 9. BEZPIECZEŃSTWO

| Aspekt | Rozwiązanie |
|--------|-------------|
| Auth API | JWT Bearer 15min + 7d refresh rotacja |
| Auth gateway | x-gateway-secret (bcrypt) + provision key |
| Auth MQTT | Mosquitto passwd + ACL per beacon |
| Multi-tenant | organizationId z JWT, nigdy z request |
| SMTP hasła | AES-256-GCM (SMTP_ENCRYPTION_KEY) |
| Integration credentials | AES-256-GCM (INTEGRATION_ENCRYPTION_KEY) |
| Google/MS Graph CSRF | nonce/state in-memory Map, TTL 10min, jednorazowy — single-instance deployment |
| Webhook HMAC | X-Reserti-Signature: sha256=hex |
| Provisioning tokens | randomBytes(32).hex, jednorazowe, TTL 24h |
| Impersonacja | JWT 30min, impersonated:true, OWNER_IMPERSONATION audit log |

**Naprawione w v0.17.3 (security review 2026-04-23):**
- Race condition refresh tokena → Singleton `_refreshPromise` w `client.ts`
- QR kody przez zewnętrzny serwis → lokalna biblioteka `qrcode`
- Silent catch handlers → `.catch((e) => console.error(...))`
- Brakujące DB indeksy → migracja `20260423000001_add_perf_indexes`
- Timezone-unsafe date parsing → `parseISO` z date-fns
- `getMe()` bez debounce → debounce 2000ms w `App.tsx`
- `scrollTo 'instant'` → `'auto'`

**Naprawione w v0.17.9 (security review 2026-05-07 — polityka haseł):**
- `_assertSameOrg()` — SUPER_ADMIN ograniczony do własnej org w force-password-reset (oddzielne od `_assertOrgAccess()` która obejmuje SSO endpoints)
- Jawny whitelist ról `{ in: ['END_USER', 'STAFF', 'OFFICE_ADMIN', 'SUPER_ADMIN'] }` we wszystkich 3 serwisach force-reset — OWNER nie może zresetować własnego hasła przez te endpointy
- `_checkPasswordExpiry()` wywołana w `getMe()` — gate niemożliwy do ominięcia przez odświeżenie strony
- `@ValidateIf(o => o.passwordExpiryDays !== null)` w DTO — `null` poprawnie przechodzi przez `@IsInt()`
- `organizations.service.ts update()` — jawna lista pól zamiast `data: dto` (eliminacja mass-assignment)
- Demo stubs dla 3 endpointów force-password-reset — brak JS error w trybie demo

**Polityka haseł — flow:**
```
login() / getMe() → _checkPasswordExpiry(user, org.passwordExpiryDays)
  → jeśli daysSince >= limit: UPDATE User SET mustChangePassword=true → return true
  → user.mustChangePassword=true → MustChangePasswordGate → redirect /change-password
changePassword() → UPDATE User SET mustChangePassword=false, passwordChangedAt=now()

Cron 07:00: checkPasswordExpiry() w SubscriptionsService
  → dla każdej org z passwordExpiryDays!=null: bulk UPDATE expired users
```

**Otwarty dług techniczny:**
- **Tokeny w localStorage** — access + refresh token w `localStorage` podatne na XSS. Migracja do httpOnly cookies = duży zakres. Patrz `docs/BACKLOG.md` #1.

---

## 10. HARDWARE

| Urządzenie | Wymagania |
|------------|-----------|
| Beacon | ESP32 (4MB flash), PN532 NFC I2C SDA=21/SCL=22, WS2812B LED pin=13 |
| Gateway | RPi 3B+/4/Zero 2W (nie 1B+ — ARMv6) |
| NTP | `time_utils.h` — ntpSync() po WiFi, fallback EPOCH_2024+millis()/1000 |

---

## 11. KONTA TESTOWE

```
owner@reserti.pl      Owner1234!    OWNER
superadmin@reserti.pl Admin1234!    SUPER_ADMIN
admin@demo-corp.pl    Admin1234!    OFFICE_ADMIN
staff@demo-corp.pl    Staff1234!    STAFF
user@demo-corp.pl     User1234!     END_USER
```

---

## 12. TYPOWE BŁĘDY

| Błąd | Rozwiązanie |
|------|-------------|
| `ENOTFOUND mosquitto` | healthcheck na mosquitto w docker-compose |
| `Cannot inject GraphService` | GraphSyncModule w ReservationsModule.imports[] i AppModule.imports[] |
| `Cannot inject IntegrationEventService` | IntegrationsModule musi być @Global() |
| `POST /graph/webhook → 404` | Dodaj do main.ts exclude list |
| Graph token wygasa co 1h | Azure: dodaj `offline_access` w API permissions + re-consent |
| `INTEGRATION_ENCRYPTION_KEY 64 hex` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| OTA stuck in_progress | cron timeoutStaleOta() po 10min → failed |

---

## 13. CO ZOSTAŁO DO ZROBIENIA

Pełny backlog → `docs/BACKLOG.md`.

### Zrobione w v0.21.0
- ✅ Sprint FREE TIER (plan free, FreeUpgradeNudge, QrStickersPrint, RegisterOrgPage)
- ✅ UserContext — localStorage app_user → React Context (useUser, useRole, useOrgUser)
- ✅ LED desync fix (request_sync retransmit w mqtt.handlers.ts)
- ✅ Gateway install.sh (desk-gateway-python main)
- ✅ CI Playwright (.github/workflows/playwright.yml)

### Priorytet wysoki

- **R2 env vars** — skonfigurować w Coolify (kod gotowy w `r2.service.ts`)

### Priorytet średni

- **M365 calendar sync — sale** — Booking.graphEventId + webhook room mailbox
- **Playwright CI secrets** — GitHub Secrets dla test DB

### Priorytet niski

- **Gateway Faza 2** — Raspberry Pi OS image (.img)
- **ISO 27001** — audyt procesów
- **OpenAPI-typescript** — generowanie typów

### FUTURE

- Sprint L (Stripe) — odłożony na decyzję
- Cloud MQTT Faza 3 — gdy klientów > 10

---

## 14. ROLE I UPRAWNIENIA

### Hierarchia ról

| Rola | Identyfikator | Kto |
|------|---------------|-----|
| Owner | `OWNER` | Operator platformy Reserti (jeden na całą platformę) |
| Super Admin | `SUPER_ADMIN` | Administrator firmy-klienta |
| Office Admin | `OFFICE_ADMIN` | Administrator konkretnego biura |
| Staff | `STAFF` | Pracownik recepcji / helpdesk |
| Użytkownik | `END_USER` | Zwykły pracownik korzystający z biurek |

### Tabela uprawnień

| Akcja | END_USER | STAFF | OFFICE_ADMIN | SUPER_ADMIN | OWNER |
|-------|:--------:|:-----:|:------------:|:-----------:|:-----:|
| Mapa biurek | ✅ | ✅ | ✅ | ✅ | — |
| Rezerwacja własna | ✅ | ✅ | ✅ | ✅ | — |
| QR / NFC check-in | ✅ | ✅ | ✅ | ✅ | — |
| Moje rezerwacje | ✅ | ✅ | ✅ | ✅ | — |
| Zmiana hasła | ✅ | ✅ | ✅ | ✅ | — |
| Ręczny check-in/out (cudzy) | ❌ | ✅ | ✅ | ✅ | — |
| Wszystkie rezerwacje (filtr) | ❌ | ✅ | ✅ | ✅ | — |
| Raporty i analityka | ❌ | ✅ | ✅ | ✅ | — |
| Stan urządzeń | ❌ | ✅ | ✅ | ✅ | — |
| CRUD biurek | ❌ | ❌ | ✅ | ✅ | — |
| CRUD użytkowników | ❌ | ❌ | ✅ | ✅ | — |
| Provisioning beaconów / OTA | ❌ | ❌ | ✅ | ✅ | — |
| Konfiguracja SMTP | ❌ | ❌ | ❌ | ✅ | — |
| Konfiguracja SSO (Entra ID) | ❌ | ❌ | ❌ | ✅ | — |
| Stan subskrypcji | ❌ | ❌ | ❌ | ✅ | — |
| Zarządzanie org (CRUD) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Wymuś reset hasła (własna org) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Wymuś reset hasła (per org) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Wymuś reset hasła (cała platforma) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Zarządzanie subskrypcjami | ❌ | ❌ | ❌ | ❌ | ✅ |
| Impersonacja SUPER_ADMIN | ❌ | ❌ | ❌ | ❌ | ✅ |
| Stats globalne platformy | ❌ | ❌ | ❌ | ❌ | ✅ |

### Zasady zmiany roli

- Rolę `SUPER_ADMIN` może nadać tylko inny SUPER_ADMIN lub OWNER
- `OFFICE_ADMIN` może zmieniać role między `END_USER`, `STAFF`, `OFFICE_ADMIN`
- Rola `OWNER` unikalna — przypisana tylko raz w seedzie, nie zmieniana przez UI
- Użytkownicy SSO (Entra ID) mają `passwordHash = 'AZURE_SSO_ONLY'` — nie logują się hasłem lokalnym

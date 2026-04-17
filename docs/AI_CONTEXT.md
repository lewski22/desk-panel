# Reserti Desk Management — Kontekst dla narzędzi AI

> Aktualizacja: 2026-04-17 — v0.12.0 (Sprinty A–B + naprawa migracji Prisma)

---

## Czym jest Reserti

SaaS do zarządzania hot-deskami w biurach z fizycznymi beaconami IoT.
Pracownicy rezerwują biurka przez przeglądarkę lub Microsoft Teams.
Beacon ESP32 przy każdym biurku: LED status + check-in kartą NFC lub QR kodem.

**Produkcja:** `api.prohalw2026.ovh`, `app.prohalw2026.ovh`
**Deploy:** Coolify na Proxmox LXC + Cloudflare Tunnel

---

## Repozytoria

| Repo | Branch | Opis |
|------|--------|------|
| `github.com/lewski22/desk-panel` | main | Backend NestJS + Unified Panel React |
| `github.com/lewski22/desk-gateway-python` | master | Python gateway (RPi) |
| `github.com/lewski22/desk-firmware` | master | ESP32 PlatformIO |

---

## Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Backend | NestJS 11 + Prisma 5 + PostgreSQL 15 |
| Frontend | React 18 + Vite + Tailwind CSS + i18next + vite-plugin-pwa |
| Testing | Vitest + @testing-library/react (frontend), Jest (backend) |
| Gateway | Python 3.8+ + paho-mqtt + requests + sqlite3 (stdlib) |
| Firmware | ESP32 + PlatformIO + ArduinoJson + PubSubClient + PN532 + NeoPixel |
| Infra | Docker, Coolify, Proxmox, Cloudflare Tunnel, Mosquitto (MQTT) |

---

## Architektura modułów backend

```
AppModule
├── SharedModule (@Global)          ← LedEventsService (rxjs Subject — event bus)
├── DatabaseModule                  ← Prisma
├── AuthModule                      ← JWT + Entra ID SSO
├── UsersModule
├── OrganizationsModule             ← Azure SSO config
├── LocationsModule                 ← getAttendance() — weekly view
├── DesksModule                     ← batchPositions, floor plan
├── DevicesModule → MqttModule      ← JEDNA STRONA
├── GatewaysModule
├── ReservationsModule              ← createRecurring (RRULE parser)
├── CheckinsModule
├── NotificationsModule             ← email per org (SMTP AES-256-GCM) + in-app
├── ResourcesModule                 ← Sale/Parking/Equipment + bookings
├── PushModule                      ← PWA Push Subscriptions (web-push)
├── VisitorsModule                  ← Visitor Management
├── SubscriptionsModule             ← plan/limits/MRR + crony expiry check
├── MqttModule → [CheckinsModule, GatewaysModule]
└── OwnerModule                     ← CRUD org, impersonacja, stats, modules
```

**Kluczowa zasada:** LED commands idą przez `LedEventsService → MqttHandlers`.
Żaden moduł domenowy nie importuje MqttModule bezpośrednio (oprócz DevicesModule).

---

## Schemat bazy danych

```
Organization ─┬── Location ─┬── Desk ─── Device (Beacon)
              │             ├── Gateway
              │             ├── GatewaySetupToken
              │             ├── Resource (Sale/Parking/Equipment)
              │             └── Visitor
              ├── User ─────── RefreshToken, PushSubscription
              ├── OrganizationSmtpConfig
              └── SubscriptionEvent

Reservation (Desk + User) — recurrenceRule/recurrenceGroupId
  └── Checkin

Resource (Room/Parking/Equipment)
  └── Booking (startTime/endTime, conflict detection)

Visitor (INVITED → CHECKED_IN → CHECKED_OUT)

SubscriptionEvent (audit log zmian planu)
```

### Organization — kluczowe pola
```
plan:           String    @default("starter")  // starter|pro|enterprise|trial
planExpiresAt:  DateTime?
trialEndsAt:    DateTime?
enabledModules: String[]  @default([])  // [] = wszystkie aktywne (backward compat)
limitDesks:     Int?      // null = ∞ (Enterprise)
limitUsers:     Int?
limitGateways:  Int?
limitLocations: Int?
billingEmail:   String?
mrr:            Int?      // grosze PLN
```

### enabledModules — semantyka
- `[]` (pusta) = wszystkie moduły aktywne — backward compatible
- `['DESKS','ROOMS','PARKING','FLOOR_PLAN','WEEKLY_VIEW']` = konkretna whitelist
- OWNER ustawia przez `PATCH /owner/organizations/:id/modules`
- Hook `useOrgModules()` w frontendzie pilnuje widoczności zakładek i nav items

---

## Migracje Prisma — WAŻNE

### Lista migracji (w kolejności)
```
20260407000000_init                    ← baseline, już na prod
20260407000001_location_limits
20260407000002_gateway_key_rotation
20260409000000_cascade_desk_delete
20260409000001_notifications
20260409000002_org_smtp
20260409000003_inapp_notifications
20260409000004_device_ota_status
20260416000001_gateway_key_rotation_notif  ← no-transaction, IF NOT EXISTS
20260417000001_sprints_schema              ← skonsolidowana migracja sprintów D-B
```

### Wzorzec dla NOWYCH migracji z ALTER TYPE ADD VALUE
```sql
-- This migration requires no transaction.
ALTER TYPE "EnumName" ADD VALUE IF NOT EXISTS 'NOWA_WARTOSC';
```

### Wzorzec dla nowych tabel/typów (idempotentny)
```sql
DO $$ BEGIN
  CREATE TYPE "MyEnum" AS ENUM ('A', 'B');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MyTable" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  ...
  CONSTRAINT "MyTable_pkey" PRIMARY KEY ("id")
);
```

### entrypoint.sh — mechanizm auto-resolve
Przy każdym starcie kontenera:
1. Sprawdza czy `_prisma_migrations` istnieje
2. Jeśli nie — `prisma migrate deploy` (świeża instalacja)
3. Jeśli tak — sprawdza `failed` migracje (started_at bez finished_at)
4. Failed migracje → `UPDATE SET rolled_back_at = NOW()` (pozwala na re-run)
5. `prisma migrate deploy` uruchamia pending/re-run migracje

Bezpieczne bo WSZYSTKIE nasze migracje są idempotentne.

---

## Frontend — kluczowe pliki

| Plik | Rola |
|------|------|
| `src/api/client.ts` | Wszystkie wywołania API (appApi.*) |
| `src/App.tsx` | Routing z Guards |
| `src/components/layout/AppLayout.tsx` | Sidebar + BottomNav + ExpiryBanner |
| `src/components/layout/BottomNav.tsx` | Mobile bottom nav (< 640px) |
| `src/hooks/useOrgModules.ts` | Guard modułów per org |
| `src/hooks/useSwipe.ts` | Touch gesture hook (zero deps) |
| `src/hooks/useSortable.ts` | URL-persisted sort state |
| `src/components/floor-plan/` | Floor Plan Editor (D1-D4) |
| `src/components/subscription/` | PlanBadge, UsageBar |
| `src/components/reservations/RecurringToggle.tsx` | RRULE picker + preview |
| `src/components/push/PushOptIn.tsx` | PWA Push opt-in dialog |
| `src/pages/DeskMapPage.tsx` | Mapa + Sale/Parking tabs + module guards |
| `src/pages/WeeklyViewPage.tsx` | Weekly attendance view |
| `src/pages/KioskPage.tsx` | Kiosk/Tablet mode (fullscreen + PIN) |
| `src/pages/VisitorsPage.tsx` | Visitor Management |
| `src/pages/SubscriptionPage.tsx` | Plan status + UsageBars + Features |
| `src/pages/OwnerPage.tsx` | Owner dashboard + Subscriptions tab + module toggles |
| `src/utils/date.ts` | `localDateStr()`, `localDateTimeISO()` |

---

## API endpoints (nowe od v0.12.0)

### Sprint D — Floor Plan
```
PATCH /desks/batch-positions          ← bulk save pozycji
GET   /locations/:id/floor-plan
POST  /locations/:id/floor-plan
POST  /locations/:id/floor-plan/delete
```

### Sprint E — Resources
```
GET   /locations/:id/resources?type=  ← ROOM|PARKING|EQUIPMENT
POST  /locations/:id/resources
PATCH /resources/:id
DELETE /resources/:id
GET   /resources/:id/availability?date=
POST  /resources/:id/bookings
POST  /bookings/:id/cancel
GET   /users/me/bookings
GET   /locations/:id/attendance?week=2026-W20
```

### Sprint G — Recurring + Push
```
POST  /reservations/recurring
POST  /reservations/:id/cancel-recurring  { scope: single|following|all }
GET   /users/me/push-vapid-key
POST  /users/me/push-subscription
DELETE /users/me/push-subscription
```

### Sprint J — Visitors
```
GET  /locations/:id/visitors?date=
POST /locations/:id/visitors
POST /visitors/:id/checkin
POST /visitors/qr/:token              ← publiczny (bez auth)
POST /visitors/:id/checkout
POST /visitors/:id/cancel
```

### Sprint B — Subscription
```
GET  /subscription/status             ← SUPER_ADMIN/OFFICE_ADMIN
GET  /owner/organizations/:id/subscription
POST /owner/organizations/:id/subscription
GET  /owner/organizations/:id/subscription/events
GET  /owner/subscription/dashboard
```

### Owner — modules
```
PATCH /owner/organizations/:id/modules  { enabledModules: string[] }
```

---

## Testy (Vitest — frontend)

```
src/__tests__/
  setup.ts           ← globalne mocki (i18n, router, localStorage, appApi)
  ui.test.tsx        ← TrendBadge, EmptyState, SortHeader (17 testów)
  useFloorPlanEditor.test.ts  ← reducer + snap + undo/redo (10 testów)
  useOrgModules.test.ts       ← module guard (6 testów)
  useSortable.test.ts         ← sort hook (6 testów)
  UsageBar.test.tsx           ← subscription UsageBar (9 testów)
```

Uruchomienie: `cd apps/unified && npm test`

---

## Konta testowe

| Email | Hasło | Rola |
|-------|-------|------|
| `owner@reserti.pl` | `Owner1234!` | OWNER |
| `superadmin@reserti.pl` | `Admin1234!` | SUPER_ADMIN |
| `admin@demo-corp.pl` | `Admin1234!` | OFFICE_ADMIN |
| `staff@demo-corp.pl` | `Staff1234!` | STAFF |

---

## Znane ograniczenia / TODO

| # | Temat | Opis |
|---|-------|------|
| 1 | web-push library | Wymaga `npm install web-push` + VAPID keys w `.env` |
| 2 | Visitor email invite | TODO w kodzie — wymaga podpięcia NotificationsService |
| 3 | Floor Plan CDN | Upload base64 do DB (limit ~2MB) — produkcja: S3/R2 |
| 4 | Kiosk link w UI | Brak przycisku `/kiosk?location=...` w OrganizationsPage |
| 5 | Playwright E2E | Brak konfiguracji i testów |
| 6 | Beacon timestamp | `millis()/1000` reset przy restarcie — TTL queue niedokładne |
| 7 | Entra ID SSO scope | Tylko OFFICE_ADMIN może logować przez SSO |

---

## Hardware constraints

| Urządzenie | Wymagania | Uwagi |
|------------|-----------|-------|
| Beacon | ESP32 (4MB flash) | Nie ESP8266 — brak MQTT TLS |
| Gateway | RPi 3B+, 4, Zero 2W | RPi 1B+ NIE — ARMv6, brak Node.js 20/Docker |
| NFC | PN532 | I2C: SDA=21, SCL=22 |
| LED | WS2812B 12-LED ring | Pin 13, 5V zasilanie |

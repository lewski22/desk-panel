# Changelog — Reserti Desk Management

## [0.12.0] — 2026-04-17 — Sprinty A–B + naprawa Prisma

### Sprinty zrealizowane

**Sprint A — UI Quick Wins** (`67cbef9`)
- Dashboard: KPI cards z trendem ↑↓%, Quick Actions strip, Today's Issues widget
- Mapa biurek: Location Tabs z live occupancy (kolor <70%/70-89%/≥90%), avatary inicjały
- Tabele: sortowanie URL state (`useSortable`), bulk cancel rezerwacji, OTA progress bar
- Nawigacja: sidebar z grupami (WORKSPACE/ZARZĄDZANIE/ANALITYKA/KONFIGURACJA/OPERATOR)
- Nowe komponenty: `EmptyState`, `TrendBadge`, `SortHeader`

**Sprint D — Floor Plan Editor** (`6276f47`)
- Schema: `Desk.posX/posY/rotation/width/height`, `Location.floorPlanUrl/W/H/gridSize`
- Backend: `PATCH /desks/batch-positions`, `GET|POST /locations/:id/floor-plan`
- Frontend: `useFloorPlanEditor` (reducer: MOVE/ROTATE/UNDO/REDO), `DeskToken` (drag+touch),
  `FloorPlanCanvas`, `FloorPlanToolbar`, `FloorPlanEditor`, `FloorPlanEditorPage`
- Widok: `DeskPin` + `FloorPlanView` (readonly, DeskInfoCard popup), toggle Plan/Karty

**Sprint E — Weekly View + Sale/Parking** (`b2ff6c0`)
- Backend: `getAttendance(locationId, week)` — ISO week, Checkin + Reservation aggregate
- Frontend: `WeeklyViewPage` — siatka 5×N, nawigator tygodnia, KPI, search
- Schema: `Resource` + `Booking` (ROOM/PARKING/EQUIPMENT, conflict detection co 30 min)
- Frontend: `ResourceCard`, `BookingModal` (slot picker), `ResourcesPage` (admin CRUD)
- DeskMapPage: zakładki `[🪑 Biurka] [🏛 Sale] [🅿️ Parking]`

**Owner: Module Management** (`d275d18`)
- Schema: `Organization.enabledModules String[]` ([] = wszystkie aktywne)
- Backend: `PATCH /owner/organizations/:id/modules`, whitelist walidacja
- Frontend: `EditOrgModal` z 5 toggle switches (DESKS/ROOMS/PARKING/FLOOR_PLAN/WEEKLY_VIEW)
- Guards: DeskMapPage tabs, AppLayout nav, ResourcesPage redirect
- Hook: `useOrgModules()` — `isEnabled(AppModule)`
- `login()` zwraca `enabledModules` w odpowiedzi

**Sprint G — Recurring + PWA Push** (`467c053`)
- Schema: `Reservation.recurrenceRule/recurrenceGroupId`, `PushSubscription`
- Backend: `createRecurring()` z RRULE parserem (bez bibliotek), `cancelRecurring(scope)`
- Frontend: `RecurringToggle` — preset buttons + custom builder + preview dat
- Backend: `PushService` (dynamic import web-push, graceful fallback), `PushController`
- Frontend: `PushOptIn` (compact + card mode, Web Push API)

**Sprint H — Mobile UX** (`467c053`)
- `BottomNav.tsx` — 4 przyciski mobile, badge aktywnych rezerwacji, safe-area-inset
- `KioskPage.tsx` — `/kiosk?location=&pin=`, fullscreen, auto-refresh 30s, NumPad PIN exit

**Sprint H2 — Swipe Gestures** (`ead8e05`)
- `useSwipe.ts` hook (zero bibliotek), touch events z threshold + drift detection
- `MyReservationsPage` z swipe-left → reveal Anuluj (iOS Mail pattern), real-time translateX

**Sprint I — Vitest Tests** (`ead8e05`)
- Konfiguracja: Vitest + @testing-library/react + jsdom + coverage
- `src/__tests__/setup.ts` — mocki i18n/router/localStorage/appApi
- 48 testów: ui.test, useFloorPlanEditor.test, useOrgModules.test, useSortable.test, UsageBar.test

**Sprint J — Visitor Management** (`ead8e05`)
- Schema: `Visitor` (INVITED→CHECKED_IN→CHECKED_OUT, qrToken unique)
- Backend: `VisitorsService` + 6 endpointów (invite, checkin, checkinByQr, checkout, cancel)
- Frontend: `VisitorsPage` — KPI row, tabela hover-reveal, `InviteModal`, route `/visitors`

**Sprint B — Subscriptions** (`b2b85f4`)
- Schema: `Organization` +7 pól billing/limits, `SubscriptionEvent`, InAppNotifType +4 wartości
- Backend: `SubscriptionsService` — `PLAN_LIMITS` stała, `getStatus()`, `getDashboard()`
- Crony: `checkExpiringSubscriptions()` (0 8 * * *) + `checkResourceLimits()` (0 */6 * * *)
- Frontend: `PlanBadge`, `UsageBar` (semantic color), `SubscriptionPage`
- `ExpiryBanner` w AppLayout — polling co 5min, dismiss localStorage
- OwnerPage: zakładki `[🏢 Firmy] [💳 Subskrypcje]`, MRR KPI, `SubPlanModal` z historią

### Naprawa migracji Prisma (`a78fa0d`, `b047d02`, `d97b4ad`)

**Problemy zdiagnozowane:**
- Duplikat folderu `20260417000004` (dwa foldery z tym samym numerem — P3009)
- `COMMIT; ALTER TYPE; BEGIN;` trick — zostawia migrację w stanie failed przy retry
- `DO $$ BEGIN ALTER TYPE ... END $$` — nie działa w transakcji PostgreSQL
- `CREATE TYPE/TABLE` bez `IF NOT EXISTS` — fail przy idempotentnym retry

**Rozwiązanie:**
- 6 osobnych migracji sprintów zastąpiono jedną: `20260417000001_sprints_schema`
- `-- This migration requires no transaction.` jako pierwsza linia przy ALTER TYPE
- Wszystkie `CREATE TYPE` w `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`
- Wszystkie `CREATE TABLE` z `IF NOT EXISTS`
- `ON CONFLICT DO NOTHING` dla lookup table inserts
- `entrypoint.sh` z auto-resolve failed migrations (UPDATE SET rolled_back_at)

---

## [0.11.0] — 2026-04-15 — i18n + PWA + Testy + OTA + Notyfikacje

- i18n PL/EN — 427 kluczy, 100% pokrycie, 0 `alert()` w kodzie produkcyjnym
- PWA: manifest, service worker (Workbox), ikony SVG, skróty, offline cache
- Testy: 178 (P1 64 unit + P2 63 gateway + P3 51 integration)
- OTA firmware: 4 fazy — GitHub Actions CI, status tracking, org isolation, panel trigger
- Powiadomienia email: 8 typów, SMTP per org AES-256-GCM, deduplikacja
- Powiadomienia in-app: dzwoneczek, reguły per rola, ogłoszenia OWNER

---

## [0.10.1] — 2026-04-07 — Code Review Fixes + Security

- 10+ security fixes: multi-tenant isolation, org guards, MQTT ACL
- LED event bus: LedEventsService (rxjs Subject, zero circular dep)
- Auto-assign NFC: 60s listening session dla UNAUTHORIZED_SCAN
- Limity rezerwacji: maxDaysAhead, maxHoursPerDay per lokalizacja
- Rotacja kluczy gateway: 15-minutowe okno nakładki (stary + nowy klucz)
- `prisma migrate deploy` zamiast `db push` (baseline migration `20260407000000_init`)

---

## [0.10.0] — 2026-04-07 — LED Flow + Mobile

- LED event bus: circular dependency fix przez SharedModule @Global
- QR check-in: timezone fix, walkin + checkin z rezerwacji
- Mobile: hamburger sidebar drawer, session warning (5min timeout)
- Date utils: `localDateStr()`, `localDateTimeISO()` (lokalna strefa, nie UTC)

---

## [0.9.0] — 2026-04-01 — Unified Panel

- `apps/unified/` — scalenie admin/staff/owner ról w jednej aplikacji
- MyReservationsPage, ChangePasswordPage, DeskMapPage z location picker
- Owner Panel: impersonacja, stats per org, health

---

## [0.8.0] — 2026-03-31 — Gateway Python + Provisioning

- `desk-gateway-python`: Cache, SyncService, MqttBridge, DeviceMonitor, MqttAdmin
- Gateway provisioning: tokeny jednorazowe (24h) + InstallController + bash script

---

## [0.7.0] — 2026-03-15 — Entra ID SSO

- Azure JWKS validation, JIT provisioning, `AzureConfigModal`

---

## [0.6.0] — 2026-03-01 — Owner Panel

- `OwnerModule`: CRUD org, impersonacja (JWT 30min), stats, health

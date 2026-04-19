# Changelog — Reserti Desk Management

## [0.17.0] — 2026-04-19 — Teams Bot + Graph Sync + Integracje + AI Insights

### Added

**Teams App (`apps/teams/`)**
- Samodzielna aplikacja React jako personal tab w Microsoft Teams
- `BookPage`, `HomePage`, `MyBookingsPage` — pełny flow rezerwacji biurka w Teams
- `teamsAuth.ts` — SSO przez Teams SDK (tokeny Entra ID bez ponownego logowania)
- `manifest.json` v1.1.0 — personal tabs + bot commands + messaging extensions

**Teams Bot Framework**
- `TeamsBotService` (extends `TeamsActivityHandler`) — komendy DM: `book`, `reservations`, `cancel <id>`, `help`
- `TeamsBotController` — `POST /bot/messages` (endpoint Azure Bot Service, `@SkipThrottle`)
- Adaptive Cards: formularz rezerwacji, lista rezerwacji, confirmacja, błąd
- Messaging Extensions: `/book` i `/reservations` przez `composeExtension/fetchTask`
- Dodano pakiet `botbuilder ^4.23.3` do backendu

**Microsoft Graph Calendar Sync (dwukierunkowa)**
- `GraphSyncModule` — przechowywanie tokenów OAuth2, sync kalendarza Outlook ↔ Reserti
- Webhook notifications dla zmian czasowych rezerwacji (Outlook → Reserti)
- Retry 1× po 1s przy przejściowych błędach Graph API
- Sprawdzanie konfliktów przed nadpisaniem czasu rezerwacji ze zmiany Outlook

**Integrations module** (per-org)
- `IntegrationsModule` z dostawcami: Slack, Teams, Webhook, Azure AD, Google Workspace
- `IntegrationsPage.tsx` — włącz/wyłącz/konfiguruj każdą integrację
- Szyfrowanie konfiguracji OAuth AES-256-GCM (`integration-crypto.service.ts`)
- Formularze: `SlackConfigForm`, `TeamsConfigForm`, `WebhookConfigForm`, `AzureConfigForm`, `GoogleConfigForm`

**AI Recommendations (Sprint K1)**
- `RecommendationBanner.tsx` — podpowiedzi optymalnego biurka na podstawie historii
- `RecommendationsService` + `GET /recommendations` (ranking według scoring)

**Utilization Insights (Sprint K2)**
- `InsightsWidget.tsx` — wyświetla insighty zajętości (`PEAK_DAY`, `UNDERUTILIZED_ZONE`, `GHOST_DESKS`)
- `InsightsService` z cron job (codzienne obliczanie)
- `GET /insights` — lista insightów dla org/lokalizacji

**Web Push Notifications (VAPID)**
- `PushService` — inicjalizacja `web-push` z kluczami VAPID z env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `generate-vapid-keys.js` — skrypt pomocniczy do jednorazowego wygenerowania kluczy
- Automatyczne usuwanie wygasłych endpointów push

**Auth — `GET /auth/me`**
- Nowy endpoint zwracający świeże dane użytkownika + `enabledModules` bez ponownego logowania
- Frontend (`App.tsx`) odświeża stan po każdym zamontowaniu aplikacji

**Monitoring**
- `monitoring/` — Docker Compose z Prometheus + Grafana
- 4 dashboardy Grafana: `desk-analytics`, `fleet-overview`, `iot-health`, `system-health`

**Owner Panel — Plan Templates**
- Tabela `PlanTemplate` w bazie (starter/trial/pro/enterprise) z edytowalnymi limitami
- Zakładka „Szablony planów" w OwnerPage — edycja limitów biurek, użytkowników, bramek, lokalizacji, flagi OTA/SSO/SMTP/API
- Picker planu przy tworzeniu nowej organizacji

**UI**
- `KioskLinkButton.tsx` — przycisk generowania linku do kiosku na stronie organizacji
- `EntraIdSection.tsx` — sekcja konfiguracji Entra ID w IntegrationsPage
- `ChangePasswordModal.tsx` — zmiana hasła dostępna z sidebara (dla użytkowników bez SSO)
- `CalendarSyncSection.tsx` + `GraphConnectButton.tsx` — UI połączenia kalendarza Microsoft Graph
- `NotificationRulesPage.tsx` — konfiguracja reguł powiadomień in-app

---

### Changed

- **AppLayout.tsx** — dodano właściwość `module` do nav items (DESKS, ROOMS, WEEKLY_VIEW), dzięki czemu filtr `hasModule()` faktycznie działa; poprawiono layout sidebara w trybie collapsed desktop
- **Graph Sync** — `_syncEventToReservation()` sprawdza konflikty na tym samym biurku przed zaktualizowaniem czasu; dodano retry 1× na błędy przejściowe
- **OwnerPage.tsx** — dialog tworzenia org z pickerem planu; nowa zakładka PlanTemplatesTab
- **Azure + Google auth services** — uproszczona logika JIT provisioning
- **NotificationsPage.tsx** — używa `appApi.notifications.getSettings/getLog/saveSettings/testSmtp` (poprzednio brak wsparcia dla org-level settings)
- **Subscriptions service** — wymuszanie limitów planu przy przydzielaniu planu do org

---

### Fixed

- **NotificationBell** — wywoływał `appApi.inapp.*` (nieistniejąca przestrzeń nazw) zamiast `appApi.notifications.*`; powodowało to ciche błędy i brak powiadomień
- **Widoczność modułów** — nav items nie miały ustawionej właściwości `module`, więc pozycje jak `/map` czy `/resources` były zawsze widoczne, nawet gdy moduł był wyłączony przez OWNER
- **Stale enabledModules** — po wyłączeniu modułu przez OWNER zalogowani użytkownicy dalej widzieli moduł do czasu ponownego logowania (naprawione przez `GET /auth/me` przy każdym mount)
- **DevicesPage** — crash gdy `api.devices.list()` zwracało nie-tablicę
- **Floor plan toolbar** — błędy CORS i limitu rozmiaru body przy wgrywaniu planu piętra
- **InAppNotifType migration** — enum tworzony bez `IF NOT EXISTS`, powodujący błąd przy retry migracji (`20260419000001_fix_notiftype_to_text`)
- **botbuilder npm package** — zła nazwa pakietu `@microsoft/botbuilder` (nie istnieje w npm registry) → poprawiono na `botbuilder ^4.23.3`; Docker build kończył się błędem E404

---

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

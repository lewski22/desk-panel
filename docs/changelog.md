# Changelog — Reserti Desk Management

> Ostatnia aktualizacja: 2026-05-07

---

## [0.17.8] — 2026-05-07 — Custom Amenities per Organization

### Added
- **`customAmenities` field on Organization model** — `String[] @default([])` przechowuje słownik tagów wyposażenia per tenant; idempotentna migracja (`schema.prisma`, `migration.sql`)
- **`GET /organizations/me/amenities`** — zwraca listę własnych tagów (OFFICE_ADMIN + własna org); **`PUT /organizations/me/amenities`** — zastępuje listę, walidacja: max 50 tagów, max 40 znaków, dedup + trim + lowercase (`organizations.service.ts`, `organizations.controller.ts`)
- **Dynamiczne amenities w `ResourceModal`** — zamiast hardkodowanej listy `PRESET_AMENITIES` + custom tagi org; pole tekstowe + "Enter" pozwala dodać nowy tag (fire-and-forget persist do org dictionary) (`ResourcesPage.tsx`)
- **Sekcja zarządzania słownikiem wyposażenia** w `OrganizationsPage` — widoczna dla OFFICE_ADMIN; lista tagów z możliwością usunięcia, input do dodawania (`OrganizationsPage.tsx`)
- **Rozszerzone `AMENITY_ICONS`** w `ResourceCard` — nowe ikony: coffee ☕, espresso ☕, piano 🎹, xbox 🎮, standing 🧍, sofa 🛋️, outdoor 🌿, printer 🖨️, scanner 🖷, ethernet 🔌 (`ResourceCard.tsx`)
- **API client** — `organizations.getAmenities()` i `organizations.updateAmenities()` (`client.ts`)
- **i18n klucze** `resource.form.amenity_placeholder/add/custom` i `org.amenities.title/description/empty/placeholder` w `pl` i `en` (`translation.json`)

---

## [0.17.7] — 2026-05-06 — ROOM Module: Security & UX Improvements

### Security
- **`assertResourceInOrg` guard** — wszystkie endpointy zasobów (`getAvailability`, `createBooking`, `cancelBooking`, `findOne`) weryfikują teraz przynależność zasobu do organizacji aktora; eliminuje cross-tenant access (`resources.service.ts`)
- **`findAll` z filtrem org** — zapytanie list zasobów ograniczone do zasobów org aktora (`resources.service.ts`)

### Fixed
- **UTC bug w `BookingModal`** — czas rezerwacji sali budowany przez `localDateTimeISO()` zamiast ręcznego stringa `${date}T${h}:${m}:00.000Z`; rezerwacje w strefach CET/CEST nie były przesunięte (`BookingModal.tsx`)

### Added
- **"Moje rezerwacje sal" w `MyReservationsPage`** — nowa sekcja z listą `Booking[]`, możliwość anulowania; `GET /users/me/bookings` już istniał, brakowało UI (`MyReservationsPage.tsx`, `client.ts`)
- **`nextAvailableSlot`** w odpowiedzi `findAll` — dla sal ACTIVE oblicza pierwszy wolny 30-min slot od teraz; widoczny na `ResourceCard` (`resources.service.ts`, `ResourceCard.tsx`)
- **Filtry sal** w `DeskMapPage` — filtr pojemności (≥4/8/12/20 os.) i amenities (TV, videoconf, whiteboard, projector) + sortowanie alfabetyczne (`DeskMapPage.tsx`)
- **Wizualny label zakresu** podczas wyboru slotów w `BookingModal` — "⏱ Wybierz koniec: od 09:00…" / "📅 09:00 → 10:30" (`BookingModal.tsx`)
- **Informacja o godzinach pracy** lokalizacji w `BookingModal` (`BookingModal.tsx`, `resources.service.ts`)
- **"Rezerwuj dla kogoś"** w `BookingModal` — OFFICE_ADMIN/SUPER_ADMIN mogą wskazać `targetUserId` (`BookingModal.tsx`, `resources.service.ts`, `CreateBookingDto`)
- **Quick Book "⚡ Teraz"** na `ResourceCard` — pre-wypełnia czas start = teraz (zaokrąglony do 30 min) (`ResourceCard.tsx`, `DeskMapPage.tsx`, `BookingModal.tsx`)
- **i18n klucze** dla nowych funkcji w `pl` i `en` (`translation.json`)

---

## [0.17.6] — 2026-04-27 — Walidacje check-in przez web + logika LED RESERVED

### Changed

- **Web check-in zablokowany wcześniej niż 2h przed `startTime`** rezerwacji — `ForbiddenException` z komunikatem (`checkins.service.ts`)
- **LED RESERVED emitowany przy tworzeniu rezerwacji** tylko gdy: dziś jest dzień rezerwacji, godzina >= `openTime` lokalizacji, biurko nie jest aktualnie OCCUPIED (`reservations.service.ts`)
- **`restoreDeskLed` (reconnect beacona)** stosuje tę samą logikę dnia + godziny otwarcia — poprzednio używał lookahead `startTime <= now+1h` (`gateways.service.ts`)
- **Cron co godzinę `autoReservedLed`** — aktywuje RESERVED dla biurek, których rezerwacja "dojrzała" (przyszła rezerwacja osiągnęła swój dzień i godzinę otwarcia); pomija biurka z aktywnym check-in (`gateways.service.ts`)
- **Po checkout i auto-checkout**: zamiast zawsze emitować FREE, sprawdza czy na tym samym biurku jest kolejna widoczna dziś rezerwacja i emituje RESERVED/GUEST_RESERVED jeśli tak (`checkins.service.ts`)

### Added

- Helper `_isReservationVisibleNow(startTime, openTime, timezone)` — logika widoczności rezerwacji w strefie czasowej biura (`reservations.service.ts`)
- Helper `_deskLedAfterFree(deskId)` — zwraca właściwy stan LED po zwolnieniu biurka (`RESERVED` / `GUEST_RESERVED` / `FREE`) (`checkins.service.ts`)

---

## [0.17.5] — 2026-04-26 — Floor Plan Portal + Notifications List + Reservations Redesign

### Added

- **`DeskInfoCard` w portalu (`createPortal`)** — rozwiązuje clipping w scrollującym kontenerze (`FloorPlanView.tsx`)
- **Mobile bottom sheet vs desktop popover** — pozycjonowanie względem viewport (DOMRect) (`FloorPlanView.tsx`, `DeskPin.tsx`)
- **Nowa zakładka "Moje powiadomienia"** jako domyślna w `NotificationsPage` (`NotificationsPage.tsx`)
- **Redesign karty rezerwacji** — kolorowy pasek statusu, pigułka czasu, usunięcie swipe gesture (`MyReservationsPage.tsx`)
- **Historia rezerwacji zwijana** (toggle "Pokaż wszystkie / Zwiń") (`MyReservationsPage.tsx`)

### Fixed

- **Pinch-to-zoom** — natywne listenery `{ passive: false }` zamiast React props (React rejestruje passive domyślnie, `preventDefault` był ignorowany) (`FloorPlanView.tsx`)
- **`isMobile` odświeżany przy resize okna** — poprzednio liczony raz przy renderze (`FloorPlanView.tsx`)
- **`my-reservations` dostępne dla SUPER_ADMIN i OFFICE_ADMIN** (`AppLayout.tsx`, `BottomNav.tsx`)
- **`unreadCount` badge** nie aktualizował się po oznaczeniu jako przeczytane — `onUnreadChange` callback do `NotificationsList` (`NotificationsPage.tsx`)
- **Przycisk usuń powiadomienie (`×`) niewidoczny na mobile** — `sm:opacity-0 sm:group-hover:opacity-100` (`NotificationsPage.tsx`)
- **`NotificationsList` brak stanu błędu** — silently renderował empty state przy błędzie API (`NotificationsPage.tsx`)
- **`NotificationBell` polling** 30s → 15s + `visibilitychange` refresh przy powrocie z tła (`NotificationBell.tsx`)
- **`isPinching` ref** — martwy kod usunięty (`FloorPlanView.tsx`)
- **Hardcoded polskie stringi** w toggle historii → i18n keys (`MyReservationsPage.tsx`, `locales/*/translation.json`)

---

## [0.17.4] — 2026-04-25 — Bugfix Sprint + UX Mapy + Date Picker

### Fixed (krytyczne K1–K6)

| # | Opis | Plik(i) |
|---|------|---------|
| K1 | QR bez PWA → pętla odświeżania | `QrCheckinPage.tsx`, `LoginPage.tsx` — `sessionStorage` returnTo |
| K2 | Web check-in niemożliwy dla rezerwacji przez web | `checkins.service.ts` — akceptuje CONFIRMED, method=WEB, dedup |
| K3 | Walidacja godzin błędna na kolejny dzień | `reservations.service.ts` — `Intl.DateTimeFormat` + timezone |
| K4 | Przyszłe rezerwacje widoczne jako zajęte dziś | `desks.service.ts` — filtr `date` + `startTime: { lte: now }` |
| K5 | PWA modal pod mapą | `ReservationModal.tsx` — `createPortal(modal, document.body)` |
| K6 | Zaproszony user nie pojawia się na liście | `UsersPage.tsx` — `load()` po invite |

### Fixed (regresje)

- R1 — STAFF dostęp do raportów (routing + nawigacja + `reports.controller.ts`)
- R2 — STAFF miał brak mapy biurek (naprawione przy R1)

### Added (nowe UX)

- Wybór daty na mapie: `GET /locations/:id/desks/status?date=YYYY-MM-DD`, date picker w `DeskMapPage.tsx`, amber banner dla nie-dzisiejszej daty
- N-F1: Domyślne biuro z localStorage (`user_default_location_{userId}`) + przycisk "Domyślne"
- N-F2: Własne rezerwacje w kolorze violet (`'mine'` status) na mapie (`DeskPin.tsx`)
- N-F3: `DeskStats` wydzielony nad mapę (niezależny od viewMode)
- N-F4: Floor + zone w tooltipie `DeskPin`
- N-F5: `/weekly` ukryte z nawigacji END_USER
- N-F7: Zoom controls (−/+/Reset) + Ctrl+scroll w `FloorPlanView`
- N-F8: `TimePicker` — dropdown godziny/minuty co 10 min (`components/ui/TimePicker.tsx`)
- N-F9: `useDirtyGuard` hook + `DirtyGuardDialog` (infrastruktura)

### Changed (zmiany wymagań)

- W1: STAFF widzi raporty (backend guard + routing + nav)
- W2: END_USER nie widzi nazw przy rezerwacjach cudzych (`desks.service.ts` `actorRole` masking)
- W3: END_USER nie widzi statystyk (`DeskMap.tsx`)

### Added (i18n)

`reservations.desks`, `deskmap.set_default`, `dirty_guard.*`, `dashboard.legend.mine` (pl + en)

---

## [0.17.3] — 2026-04-23 — UX Fixes + Rejestracja + Demo Mode + Code Review

### Fixed

| # | Obszar | Opis | Plik |
|---|--------|------|------|
| #1 | MAP | Przycisk "Rezerwuj" nie działał | `DeskMap.tsx` — dodano `onQuickBook` |
| #2 | MAP | Popup biurka — zła pozycja | `FloorPlanView.tsx` — `popupStyle()` w pikselach |
| #3 | REZERWACJE | Check-in widoczny po check-inie | `MyReservationsPage.tsx` — optimistic update |
| #4 | DASHBOARD | Brak danych mimo check-inów | `client.ts` — fix URL `/analytics/extended` |
| #5 | SUPER ADMIN | Błąd wyboru firmy przy dodawaniu biura | `OrganizationsPage.tsx` — pre-fill własna org |
| #6 | MOBILE | Mapa nie znika przy zmianie zakładki | `AppLayout.tsx` — scroll reset |
| #7 | USER | Mapa jako widok domyślny | `DeskMapPage.tsx` — END_USER → `'plan'` |
| #8 | DASHBOARD | Czytelność na telefonie | `DashboardPage.tsx` — mobile breakpoints |
| #9 | UI | Kolory statusów pod mapą | `FloorPlanView.tsx` Legend, `DeskInfoCard` |
| #10 | I18N | Brak klucza `layout.nav.integrations` | dodano do pl/en |
| #11 | BIURO | Obsługa biur wielopiętrowych (frontend) | `FloorPlanEditorPage.tsx` — zakładki + "Dodaj piętro" |
| #12 | RBAC | OFFICE_ADMIN nie mógł wejść w powiadomienia | `App.tsx` guard + backend settings endpoint |
| #13 | PROVISIONING | Biały ekran w zakładce Provisioning | `GatewaySection` — brak `useTranslation()` |

### Fixed (Code Review)

| # | Problem | Plik | Zmiana |
|---|---------|------|--------|
| 1 | Race condition refresh tokena | `client.ts` | Singleton `_refreshPromise` |
| 2 | `getMe()` spam na visibilitychange | `App.tsx` | Debounce 2000ms |
| 3 | Timezone-unsafe date parsing | `MyReservationsPage.tsx` | `parseISO` z date-fns |
| 4 | QR kody przez zewnętrzny serwis | `DesksPage.tsx` | Lokalna biblioteka `qrcode` |
| 5 | Brakujące indeksy DB | `schema.prisma` + migracja | `@@index([deskId, date, status])`, `@@index([deskId, checkedOutAt])` |
| 6 | Silent catch handlers (10x) | Wiele stron | `.catch((e) => console.error(...))` |
| 7 | `scrollTo 'instant'` | `AppLayout.tsx` | → `'auto'` |

Migracja: `20260423000001_add_perf_indexes`

### Added

- Flow rejestracji przez zaproszenie: `POST /auth/invite` + `POST /auth/register` + `RegisterPage.tsx`
- Demo mode: `VITE_DEMO_MODE=true`, `demoData.ts`, `demoHandlers.ts`, `DemoModeBanner.tsx`
- KioskPage: zegar 1s, kolor "zajęte" → `text-red-400`, grid `md:grid-cols-5 2xl:grid-cols-10`

---

## [0.17.2] — 2026-04-22 — Lucide Icons + i18n Audit + Floor Plan Multi-floor + PWA Kiosk

### Added

**Multi-floor plan support (backend)**
- Nowy model `LocationFloorPlan` — każde piętro ma osobny plan (url, wymiary, gridSize)
- Migracja `20260421000001_location_floor_plans` (CREATE TABLE IF NOT EXISTS + unikalne `locationId+floor`)
- `GET /locations/:id/floors` → lista nazw pięter z wgranymy planami
- `GET/POST /locations/:id/floor-plan?floor=` — obsługa per-piętro; bez `?floor` backward-compat z `Location`
- `POST /locations/:id/floor-plan/delete?floor=` — usuwanie planu per-piętro
- Backward compatibility: stary `Location.floorPlanUrl` działa bez zmian gdy `?floor` nie jest podany

**PWA KioskPage — install button (Option A)**
- Przechwytywanie `beforeinstallprompt` (zachowane `preventDefault()`) → `installEvt` state
- Przycisk „Install PWA" / „Zainstaluj PWA" w nagłówku kiosku — widoczny tylko gdy przeglądarka udostępnia event
- Klucze i18n: `kiosk.install_btn` (pl + en)

**Ikony — Lucide React**
- `SidebarIcons.tsx` przepisany: re-eksportuje z `lucide-react` pod identycznymi nazwami (`IconFloorPlan`, `IconCalendar`, `IconDesk` itd.) — zero zmian w konsumentach
- `lucide-react ^0.468.0` dodany do `package.json`

### Fixed / Improved

**FloorPlanEditor — position sync**
- Biurka przestały wracać do poprzedniego układu po zapisie planu (`to_fix_2.md #16`)
- Dodany `useEffect` w `FloorPlanEditor`: gdy `!state.isDirty` wywołuje `reset(freshPositions)` przy zmianie props `desks` / `floor`
- Rozwiązanie: `useReducer` initial state nie reagował na zmianę props — `useEffect` + `reset()` to naprawia

**i18n audit — 100% pokrycie**
- `ChangePasswordModal.tsx` — przepisany z 0% na 100% (używał hardkodowanych stringów PL)
- `AppLayout.tsx` — `ROLE_LABEL` constant usunięty → `t(\`roles.${user.role}\`, user.role)` (dynamic key + raw fallback); banery subskrypcji przetłumaczone (`layout.subscription_*`)
- `OrganizationsPage.tsx` — wszystkie etykiety formularza biura przetłumaczone (`organizations.form.*`)
- `DevicesPage.tsx` — nagłówki tabel beaconów i gatewayów: `t('devices.table.*')`
- Nowe klucze dodane do obu plików (pl + en): `devices.table.{status, hardware_id, firmware, rssi, ip}`, `layout.{subscription_expired_msg, subscription_renew, subscription_expiring_msg, subscription_details}`, `changePassword.errors.generic`, `organizations.form.*` (14 kluczy), `kiosk.install_btn`

---

## [0.17.1] — 2026-04-21 — Security Fixes + Status Colors + Brand Token

### Security (NAPRAWIONE)

- **Privilege escalation** (`to_fix_2.md #13a`) — każdy użytkownik mógł wysłać `targetUserId` w POST `/reservations` i rezerwować biurko dla dowolnej osoby. Naprawka: `reservations.service.ts` sprawdza rolę aktora przed użyciem `targetUserId`
- **IDOR** (`to_fix_2.md #13b`) — OFFICE_ADMIN mógł tworzyć lokalizacje w obcej organizacji. Naprawka: `locations.controller.ts` nadpisuje `organizationId` z JWT dla ról < SUPER_ADMIN/OWNER

### Changed

- **Status colors** — spójne we wszystkich komponentach (DeskPin, DeskToken, DeskCard, KioskPage, DashboardPage): `#10b981` wolne / `#f59e0b` zarezerwowane / `#ef4444` zajęte / `#a1a1aa` offline
- **Brand token** — jeden token (`--brand: #9C2264`) w `index.css` i `tailwind.config.js`; klasy `bg-brand` / `text-brand` / `hover:bg-brand-hover` używane wszędzie

---

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

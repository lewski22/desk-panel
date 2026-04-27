# Dev Log — Reserti Desk Panel

Historia prac, naprawionych błędów i otwartych zadań.

---

## Zrealizowane (chronologicznie)

### 2026-04-27 — Walidacje check-in przez web + logika LED RESERVED

#### Zmiany

| # | Opis | Plik(i) |
|---|------|---------|
| 1 | Web check-in zablokowany wcześniej niż 2h przed `startTime` rezerwacji — `ForbiddenException` z komunikatem po polsku | `checkins.service.ts` |
| 2 | LED RESERVED emitowany przy tworzeniu rezerwacji tylko gdy: dziś jest dzień rezerwacji, godzina >= `openTime` lokalizacji, biurko nie jest aktualnie OCCUPIED | `reservations.service.ts` |
| 3 | `restoreDeskLed` (reconnect beacona) stosuje tę samą logikę dnia + godziny otwarcia — poprzednio używał lookahead `startTime <= now+1h` | `gateways.service.ts` |
| 4 | Cron co godzinę (`autoReservedLed`) — aktywuje RESERVED dla biurek, których rezerwacja "dojrzała" (przyszła rezerwacja osiągnęła swój dzień i godzinę otwarcia); pomija biurka z aktywnym check-in | `gateways.service.ts` |
| 5 | Po checkout i auto-checkout: zamiast zawsze emitować FREE, sprawdza czy na tym samym biurku jest kolejna widoczna dziś rezerwacja i emituje RESERVED/GUEST_RESERVED jeśli tak | `checkins.service.ts` |
| 6 | Helper `_isReservationVisibleNow(startTime, openTime, timezone)` — logika widoczności rezerwacji w strefie czasowej biura | `reservations.service.ts` |
| 7 | Helper `_deskLedAfterFree(deskId)` — zwraca właściwy stan LED po zwolnieniu biurka (`RESERVED` / `GUEST_RESERVED` / `FREE`) | `checkins.service.ts` |

---

### 2026-04-26 — Floor Plan Portal + Notifications List + Reservations Redesign

#### Zmiany

| # | Opis | Plik(i) |
|---|------|---------|
| 1 | `DeskInfoCard` przeniesiona do portalu (`createPortal`) — rozwiązuje clipping w scrollującym kontenerze | `FloorPlanView.tsx` |
| 2 | Mobile bottom sheet vs desktop popover — pozycjonowanie względem viewport (DOMRect) | `FloorPlanView.tsx`, `DeskPin.tsx` |
| 3 | Pinch-to-zoom — natywne listenery `{ passive: false }` zamiast React props (React rejestruje passive domyślnie, `preventDefault` był ignorowany) | `FloorPlanView.tsx` |
| 4 | `isMobile` odświeżany przy resize okna — poprzednio liczony raz przy renderze | `FloorPlanView.tsx` |
| 5 | `my-reservations` dostępne dla SUPER_ADMIN i OFFICE_ADMIN | `AppLayout.tsx`, `BottomNav.tsx` |
| 6 | Redesign karty rezerwacji — kolorowy pasek statusu, pigułka czasu, usunięcie swipe gesture | `MyReservationsPage.tsx` |
| 7 | Historia rezerwacji zwijana (toggle "Pokaż wszystkie / Zwiń") | `MyReservationsPage.tsx` |
| 8 | Nowa zakładka "Moje powiadomienia" jako domyślna w `NotificationsPage` | `NotificationsPage.tsx` |
| 9 | Push opt-in refaktor — early-return guards zamiast zagnieżdżonych ternary | `NotificationsPage.tsx` |
| 10 | `NotificationBell` polling 30s → 15s + `visibilitychange` refresh przy powrocie z tła | `NotificationBell.tsx` |

#### Naprawione błędy (code review 2026-04-26)

| # | Opis | Plik(i) |
|---|------|---------|
| B1 | Hardcoded polskie stringi w toggle historii (`'Zwiń ↑'`, `'Pokaż wszystkie...'`) → i18n keys | `MyReservationsPage.tsx`, `locales/*/translation.json` |
| B2 | `unreadCount` badge w zakładce "Moje powiadomienia" nie aktualizował się po oznaczeniu jako przeczytane — `onUnreadChange` callback do `NotificationsList` | `NotificationsPage.tsx` |
| B3 | Przycisk usuń powiadomienie (`×`) niewidoczny na mobile (`opacity-0 group-hover`) → `sm:opacity-0 sm:group-hover:opacity-100` | `NotificationsPage.tsx` |
| B4 | `NotificationsList` brak stanu błędu — silently renderował empty state przy błędzie API | `NotificationsPage.tsx` |
| B5 | `isPinching` ref — martwy kod (ustawiany ale nigdy czytany) | `FloorPlanView.tsx` |

---

### 2026-04-25 — Bugfix Sprint + UX Mapy + Date Picker + Nowe funkcje

#### Krytyczne (K1–K6)

| # | Opis | Plik(i) |
|---|------|---------|
| K1 | QR bez PWA → pętla odświeżania | `QrCheckinPage.tsx`, `LoginPage.tsx` — `sessionStorage` returnTo |
| K2 | Web check-in niemożliwy dla rezerwacji przez web | `checkins.service.ts` — akceptuje CONFIRMED, method=WEB, dedup |
| K3 | Walidacja godzin błędna na kolejny dzień (`slice` → `Intl.DateTimeFormat` + timezone) | `reservations.service.ts` |
| K4 | Przyszłe rezerwacje widoczne jako zajęte dziś | `desks.service.ts` — filtr `date` + `startTime: { lte: now }` |
| K5 | PWA modal pod mapą | `ReservationModal.tsx` — `createPortal(modal, document.body)` |
| K6 | Zaproszony user nie pojawia się na liście | `UsersPage.tsx` — `load()` po invite |

#### Regresje

| # | Opis | Plik(i) |
|---|------|---------|
| R1 | STAFF dostęp do raportów (routing + nawigacja) | `App.tsx`, `AppLayout.tsx`, `BottomNav.tsx`, `reports.controller.ts` |
| R2 | STAFF miał brak mapy biurek | naprawione przy R1 |

#### Zaległości

| # | Opis | Plik(i) |
|---|------|---------|
| Z1 | Brakujące klucze i18n (`dashboard.beacons_offline`, `push.*`) | `pl/translation.json`, `en/translation.json` |
| Z2 | AI Insights `POST /insights/refresh-all` | `insights.controller.ts` |
| Z3 | Provisioning empty state zamiast spinnera | `ProvisioningPage.tsx` — `devLoaded` flag |

#### Zmiany wymagań

| # | Opis | Plik(i) |
|---|------|---------|
| W1 | STAFF widzi raporty | backend guard + routing + nav |
| W2 | END_USER nie widzi nazw przy rezerwacjach | `desks.service.ts` `actorRole` masking, `DeskCard.tsx` |
| W3 | END_USER nie widzi statystyk | `DeskMap.tsx` — `{!isEndUser && <Stats>}` |

#### Wybór daty na mapie

- Backend: `GET /locations/:id/desks/status?date=YYYY-MM-DD` — filtruje rezerwacje po `date` field, check-iny tylko dla dzisiaj
- Frontend: date picker w `DeskMapPage.tsx`, `useDesks(locationId, date)`, amber banner dla nie-dzisiejszej daty, `initialDate` w `ReservationModal`

#### Nowe UX (N-F1 – N-F10)

| # | Opis | Plik(i) |
|---|------|---------|
| N-F1 | Domyślne biuro z localStorage (`user_default_location_{userId}`) + przycisk "Domyślne" | `DeskMapPage.tsx` |
| N-F2 | Własne rezerwacje w kolorze violet (`'mine'` status) na mapie | `DeskPin.tsx`, `FloorPlanView.tsx` |
| N-F3 | `DeskStats` wydzielony nad mapę (niezależny od viewMode) | `DeskMap.tsx` → export `DeskStats`, `DeskMapPage.tsx` |
| N-F4 | Floor + zone w tooltipie DeskPin | `DeskPin.tsx` |
| N-F5 | `/weekly` ukryte z nawigacji END_USER | `AppLayout.tsx`, `BottomNav.tsx` |
| N-F6 | "Aktywne" → "Biurka" w Moich rezerwacjach | `MyReservationsPage.tsx` |
| N-F7 | Zoom controls (−/+/Reset) + Ctrl+scroll w FloorPlanView | `FloorPlanView.tsx` |
| N-F8 | `TimePicker` — dropdown godziny/minuty co 10 min | `components/ui/TimePicker.tsx`, `ReservationModal.tsx` |
| N-F9 | `useDirtyGuard` hook + `DirtyGuardDialog` (infrastruktura) | `hooks/useDirtyGuard.ts`, `components/ui/DirtyGuardDialog.tsx` |
| N-F10 | Spójny styl przycisku Anuluj | `MyReservationsPage.tsx` |

**i18n:** `reservations.desks`, `deskmap.set_default`, `dirty_guard.*`, `dashboard.legend.mine` (pl + en)

#### Otwarte po tej sesji

- **R1 pełny** — `DashboardPage.tsx`: `isAtLeastStaff = isAdmin || isStaff`, zmiana `{isAdmin && ...}` dla KPI/wykresów widocznych przez STAFF
- **R3** — Beacon LED desync — analiza `beacons.service.ts` + retransmit stanu LED po heartbeat
- **N-F9 wdrożenie** — dirty guard podpiąć w EditLocationModal, EditUserModal, EditOrgModal

---

### 2026-04-21 — Security Fixes + Status Colors

**Security:**
- **Privilege escalation** — każdy użytkownik mógł wysłać `targetUserId` w POST `/reservations` i rezerwować biurko dla dowolnej osoby. Naprawka: `reservations.service.ts` sprawdza rolę aktora przed użyciem `targetUserId`.
- **IDOR** — OFFICE_ADMIN mógł tworzyć lokalizacje w obcej organizacji. Naprawka: `locations.controller.ts` nadpisuje `organizationId` z JWT dla ról < SUPER_ADMIN/OWNER.

**UX:**
- Spójne kolory statusów: `#10b981` wolne / `#f59e0b` zarezerwowane / `#ef4444` zajęte / `#a1a1aa` offline — we wszystkich komponentach (DeskPin, DeskToken, DeskCard, KioskPage, DashboardPage).
- Brand token `#9C2264` w jednym miejscu (`index.css` + `tailwind.config.js`).

---

### 2026-04-22 — Lucide Icons + i18n Audit + Floor Plan Multi-floor + PWA Kiosk

**Dodane:**
- Multi-floor plan support (backend): model `LocationFloorPlan`, migracja `20260421000001`, endpointy `GET/POST /locations/:id/floor-plan?floor=`, `GET /locations/:id/floors`.
- PWA KioskPage install button — przechwytywanie `beforeinstallprompt`.
- Ikony ujednolicone na Lucide React (`lucide-react ^0.468.0`).

**Naprawione:**
- FloorPlanEditor position sync — biurka przestały wracać do poprzedniego układu po zapisie (`useEffect + reset()` w `FloorPlanEditor`).
- i18n audit — 100% pokrycie, naprawione: `ChangePasswordModal`, `AppLayout`, `OrganizationsPage`, `DevicesPage`.

---

### 2026-04-23 — UX Fixes + Rejestracja + Demo Mode

**Naprawione błędy:**

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

**Nowe funkcjonalności:**
- Flow rejestracji przez zaproszenie: `POST /auth/invite` + `POST /auth/register` + `RegisterPage.tsx`.
- Demo mode: `VITE_DEMO_MODE=true`, `demoData.ts`, `demoHandlers.ts`, `DemoModeBanner.tsx`.
- KioskPage poprawki: zegar 1s, kolor "zajęte" → `text-red-400`, grid `md:grid-cols-5 2xl:grid-cols-10`.

---

### 2026-04-23 — Code & Security Review Fixes

Poprawki po przeglądzie kodu (`sec_review.md`):

| # | Problem | Plik | Zmiana |
|---|---------|------|--------|
| 1 | Race condition refresh tokena | `client.ts` | Singleton `_refreshPromise` |
| 2 | getMe() spam na visibilitychange | `App.tsx` | Debounce 2000ms |
| 3 | Timezone-unsafe date parsing | `MyReservationsPage.tsx` | `parseISO` z date-fns |
| 4 | QR kody przez zewnętrzny serwis | `DesksPage.tsx` | Lokalna biblioteka `qrcode` |
| 5 | Brakujące indeksy DB | `schema.prisma` + migracja | `@@index([deskId, date, status])`, `@@index([deskId, checkedOutAt])` |
| 6 | Silent catch handlers (10x) | Wiele stron | `.catch((e) => console.error(...))` |
| 7 | `scrollTo 'instant'` | `AppLayout.tsx` | → `'auto'` |

Migracja: `20260423000001_add_perf_indexes`.

---

## Otwarte / Do zrobienia

### Wymagają decyzji

| # | Obszar | Opis |
|---|--------|------|
| M365 | Integracja | Dwustronna synchronizacja kalendarza sal konferencyjnych (rozszerzenie GraphSyncModule). Patrz `docs/architecture.md`. |
| PROVISIONING | Hardware | Provisioning Gateway i Beacon przez USB (WebSerial API). Wymaga ustalenia platformy. Patrz `docs/provisioning.md`. |
| DEMO | Demo | Pełna instancja demo bez backendu — `VITE_DEMO_MODE=true` już istnieje, brak kompletnych fixtures dla wszystkich stron. |

### Dalszy rozwój

- Sprint L — Publiczny booking + Stripe Checkout
- Playwright E2E testy
- Visitor email invite (TODO w `visitors.service.ts`)
- Tokeny w localStorage → migracja na httpOnly cookies (duży zakres)
- `as any` cleanup (136x) — wymaga generowania typów z OpenAPI

# Plan wdrożenia — batching zmian per plik

> Cel: każdy plik edytowany **raz** — wszystkie potrzebne zmiany z różnych sprintów
> trafiają w jednej sesji dev. Zero powrotów do tego samego pliku.
>
> Ostatnia aktualizacja: 2026-04-15

---

## Dlaczego batching ma znaczenie

Każdy powrót do pliku to:
- Ponowne czytanie kontekstu (~5–10 min)
- Ryzyko konfliktu z wcześniejszą zmianą
- Dodatkowy commit / PR
- Potencjalna regresja (merge conflict, niezgodna sygnatura)

Reguła: jeśli dwa sprinty dotykają tego samego pliku → **wdrożyć razem**.

---

## Mapa: plik → sprinty dotykające go

### `backend/prisma/schema.prisma`

Dotyczy: **B + D + E + G + H + J + K + L**

| Sprint | Co dodaje |
|--------|-----------|
| B | `SubscriptionEvent` model, `Organization.limitDesks/Users/Gateways/Locations`, `Organization.mrr/billingEmail/billingNotes/nextInvoiceAt` |
| D | `Desk.posX`, `Desk.posY`, `Desk.rotation`, `Desk.width`, `Desk.height`, `Location.floorPlanUrl`, `Location.floorPlanW`, `Location.floorPlanH`, `Location.gridSize` |
| E1 | `UserSchedule` model (opcjonalny plan tygodnia usera) |
| E2 | `Resource` model, `ResourceType` enum, relacja `Location.resources[]` |
| G1 | `Reservation.recurrenceRule String?`, `Reservation.recurrenceGroupId String?` |
| H3 | `Location.kioskPin String?`, `Location.isKioskEnabled Boolean` |
| J | `Visitor` model |
| K1 | `UserPreferences` model (preferowane biurko, strefa, dismissed recommendations) |
| L1 | `Location.isPublic Boolean`, `Location.publicSlug String?`, `Location.pricingEnabled Boolean`, `Location.pricePerHour Float?` |
| L2 | `Reservation.paymentStatus String?`, `Reservation.stripeSessionId String?` |
| G2 | `PushSubscription` model |

**👉 ZRÓB RAZ:** Przygotuj całą migrację `schema.prisma` zanim zaczniesz jakikolwiek sprint B–L.
Jedna migracja Prisma obejmująca wszystkie nowe modele/pola. Nieużywane pola są nullable — zero ryzyka.

```bash
# Jedna migracja: 20260420000001_full_schema.sql
npx prisma migrate dev --name full_schema
```

---

### `backend/src/modules/desks/desks.service.ts`

Dotyczy: **A3 + D1 + E2 + K1**

| Sprint | Co zmienia |
|--------|-----------|
| A3 | `sortBy` param w `findAll()` — obsługa `?sort=name&dir=asc` |
| D1 | `updatePosition(id, posX, posY, rotation)` — batch update pozycji na floor plan |
| E2 | `findByType(locationId, ResourceType)` — gdy `Desk` staje się `Resource` |
| K1 | `getRecommended(userId, date, start, end)` — algorytm rekomendacji |

**👉 ZRÓB RAZ:** Wszystkie 4 zmiany w jednej sesji. Plik ma ~200 linii — łatwy do ogarnięcia.

---

### `backend/src/modules/desks/desks.controller.ts`

Dotyczy: **A3 + D1 + C2 + E2 + K1**

| Sprint | Co zmienia |
|--------|-----------|
| A3 | Query param `sort` + `dir` w `findAll()` |
| D1 | `PATCH /desks/positions` — bulk update pozycji (body: `[{id, posX, posY}]`) |
| D1 | `POST /locations/:id/floor-plan` — upload obrazu |
| C2 | `GET /reports/export` przenosi się częściowo przez desks service |
| K1 | `GET /desks/recommended` — nowy endpoint |

---

### `backend/src/modules/desks/dto/update-desk.dto.ts`

Dotyczy: **D1 + E2**

| Sprint | Co dodaje |
|--------|-----------|
| D1 | `posX?: number`, `posY?: number`, `rotation?: number` |
| E2 | `type?: ResourceType` |

**👉 ZRÓB RAZ:** 3 nowe pola optional — 5 minut pracy.

---

### `backend/src/modules/reservations/reservations.service.ts`

Dotyczy: **A3 + G1 + E2**

| Sprint | Co zmienia |
|--------|-----------|
| A3 | Nowy endpoint `bulkCancel(ids: string[])` |
| G1 | `createRecurring(dto, rule)` — generowanie serii z RRULE, batch conflict check |
| E2 | `create()` — walidacja konfliktu dla `resourceId` (nie tylko `deskId`) |

---

### `backend/src/modules/reservations/reservations.controller.ts`

Dotyczy: **A3 + G1 + E2**

| Sprint | Co dodaje |
|--------|-----------|
| A3 | `DELETE /reservations/bulk` — przyjmuje `{ ids: string[] }` |
| G1 | `POST /reservations/recurring` — tworzy serię |
| E2 | `POST /reservations` — obsługa `resourceId` zamiast/obok `deskId` |

---

### `backend/src/modules/locations/locations.service.ts`

Dotyczy: **D1 + E1 + E2 + H3**

| Sprint | Co dodaje |
|--------|-----------|
| D1 | `updateFloorPlan(id, url, w, h)` |
| E1 | `getAttendance(id, week)` — zwraca kto kiedy ma rezerwację/check-in |
| E2 | `getResources(id, type)` |
| H3 | `validateKioskPin(id, pin)` |

---

### `backend/src/modules/locations/locations.controller.ts`

Dotyczy: **D1 + E1 + H3 + L1**

| Sprint | Co dodaje |
|--------|-----------|
| D1 | `POST /locations/:id/floor-plan` (upload), `GET /locations/:id/floor-plan` |
| E1 | `GET /locations/:id/attendance?week=` |
| H3 | `POST /locations/:id/kiosk/verify-pin` |
| L1 | `GET /locations/:slug/public` — publiczna strona booking |

---

### `backend/src/modules/owner/owner.service.ts`

Dotyczy: **B + K2**

| Sprint | Co dodaje |
|--------|-----------|
| B | `getSubscriptionDashboard()` — MRR aggregate, expiring orgs |
| K2 | `getUtilizationInsights(orgId)` — AI utilization insights per org |

---

### `backend/src/modules/owner/owner.controller.ts`

Dotyczy: **B**

| Sprint | Co dodaje |
|--------|-----------|
| B | `GET /owner/subscription/dashboard`, `GET/POST /owner/organizations/:id/subscription` |

---

### `backend/src/app.module.ts`

Dotyczy: **B + D + E + F + G + H + J + K + L**

| Sprint | Co dodaje (import nowego modułu) |
|--------|-----------|
| B | `SubscriptionsModule` |
| D | `FloorPlanModule` (lub rozszerzenie DesksModule) |
| E1 | `AttendanceModule` |
| E2 | `ResourcesModule` |
| F1 | `TeamsModule` |
| F2 | `SlackModule` |
| F3 | `GraphSyncModule` |
| G2 | `PushNotificationsModule` |
| H3 | `KioskModule` |
| J | `VisitorsModule` |
| K | `RecommendationsModule` |
| L | `PublicBookingModule`, `PaymentsModule` |

**👉 ZRÓB RAZ:** Rejestracja modułów to 1 linijka per sprint — wpisz je wszystkie naraz kiedy tworzysz moduł. Nie wracaj do `app.module.ts` przy każdym sprincie.

Strategia: przy każdym nowym module → od razu wpisz do `app.module.ts` + `imports: []` + zakomentuj jeśli moduł nie gotowy.

---

### `apps/unified/src/App.tsx`

Dotyczy: **A4 + B + D + E + H + J + L**

| Sprint | Co dodaje |
|--------|-----------|
| A4 | Nowe importy komponentów (QuickActions, TodayIssues, etc.) |
| B | `import { SubscriptionPage }` + Route `/subscription` |
| D | `import { FloorPlanEditorPage }` + Route `/floor-plan/:locationId` |
| E1 | `import { WeeklyViewPage }` + Route `/weekly` |
| E2 | `import { ResourcesPage }` + Route `/rooms`, `/parking` |
| H1 | `import { BottomNav }` + conditional render na mobile |
| H3 | `import { KioskPage }` + Route `/kiosk` (publiczny, bez Auth) |
| J | `import { VisitorsPage }` + Route `/visitors` |
| L1 | Route `/book/:slug` (publiczny) |

**👉 ZRÓB RAZ:** App.tsx to TYLKO routing + importy. Przygotuj cały routing na początku. Strony można tworzyć potem — ruta może wyświetlać placeholder do czasu wdrożenia danego sprintu.

```tsx
// Strategia: stub pages → replace with real pages later
const FloorPlanEditorPage = lazy(() => import('./pages/FloorPlanEditorPage'));
// Wrapper który obsługuje loading gracefully
```

---

### `apps/unified/src/components/layout/AppLayout.tsx`

Dotyczy: **A4 + B + D + E1 + H1 + H3**

| Sprint | Co zmienia |
|--------|-----------|
| A4 | Grupowanie nav z separatorami WORKSPACE/ZARZĄDZANIE/ANALITYKA/KONFIGURACJA |
| A4 | Breadcrumbs komponent |
| B | Nowy link `subscription` w sekcji KONFIGURACJA (dla SUPER_ADMIN) + `ExpiryBanner` |
| D | Nowy link `floor-plan` w sekcji ZARZĄDZANIE (dla OFFICE_ADMIN) |
| E1 | Nowy link `weekly` / `Kalendarz` w sekcji WORKSPACE |
| H1 | `BottomNav` komponent — conditional `md:hidden` |
| H3 | Link `kiosk` w OrganizationsPage (nie w sidebar, ale przycisk) |

**👉 ZRÓB RAZ:** AppLayout.tsx to `NAV_ITEMS` array + render logic. Dodaj WSZYSTKIE nowe linki do tablicy od razu. Widoczność kontrolowana przez `roles: []` — niewidoczna dla nieuprawnionych ról.

```tsx
// Rozszerzona struktura z grupowaniem
const NAV_GROUPS = [
  {
    label: 'WORKSPACE',
    items: [
      { to: '/map',             label: 'Mapa biurek',     roles: ALL_ROLES },
      { to: '/weekly',          label: 'Kalendarz',       roles: ALL_ROLES },      // E1
      { to: '/my-reservations', label: 'Moje rezerwacje', roles: ALL_ROLES },
    ]
  },
  {
    label: 'ZARZĄDZANIE',
    items: [
      { to: '/desks',           label: 'Biurka',          roles: ADMIN_ROLES },
      { to: '/rooms',           label: 'Sale/Parking',    roles: ADMIN_ROLES },    // E2
      { to: '/users',           label: 'Użytkownicy',     roles: ADMIN_ROLES },
      { to: '/visitors',        label: 'Goście',          roles: ADMIN_ROLES },    // J
      { to: '/provisioning',    label: 'Provisioning',    roles: ADMIN_ROLES },
    ]
  },
  {
    label: 'ANALITYKA',
    items: [
      { to: '/dashboard',       label: 'Dashboard',       roles: ADMIN_ROLES },
      { to: '/reports',         label: 'Raporty',         roles: ADMIN_ROLES },
    ]
  },
  {
    label: 'KONFIGURACJA',
    items: [
      { to: '/organizations',   label: 'Biura',           roles: ['SUPER_ADMIN'] },
      { to: '/subscription',    label: 'Subskrypcja',     roles: ['SUPER_ADMIN'] }, // B
      { to: '/notifications',   label: 'Powiadomienia',   roles: ['SUPER_ADMIN'] },
    ]
  },
];
```

---

### `apps/unified/src/api/client.ts`

Dotyczy: **B + C2 + D + E1 + E2 + F + G + H3 + J + K + L**

| Sprint | Co dodaje |
|--------|-----------|
| B | `appApi.subscription.getStatus()`, `appApi.owner.updateSubscription()` |
| C2 | `appApi.reports.export(params)` |
| D | `appApi.desks.updatePositions()`, `appApi.locations.uploadFloorPlan()` |
| E1 | `appApi.locations.getAttendance(id, week)` |
| E2 | `appApi.resources.list()`, `appApi.resources.create()`, `appApi.resources.getAvailability()` |
| F2 | `appApi.integrations.slackConnect()` |
| G1 | `appApi.reservations.createRecurring()` |
| G2 | `appApi.users.registerPush()` |
| H3 | `appApi.locations.verifyKioskPin()` |
| J | `appApi.visitors.invite()`, `appApi.visitors.list()`, `appApi.visitors.checkin()` |
| K1 | `appApi.desks.getRecommended()` |
| L1 | `appApi.public.getLocation()`, `appApi.public.createBooking()` |
| L2 | `appApi.payments.createSession()` |

**👉 ZRÓB RAZ:** `api/client.ts` to jeden obiekt `appApi`. Dodaj WSZYSTKIE nowe metody w jednej sesji. Metody mogą zwracać `Promise.reject('not implemented')` dopóki backend nie gotowy — frontend i tak nie woła ich do czasu implementacji strony.

---

### `apps/unified/src/pages/DeskMapPage.tsx`

Dotyczy: **A2 + D4**

| Sprint | Co zmienia |
|--------|-----------|
| A2 | Location tabs z occupancy (zamiana dropdown → tabs) |
| A2 | Inline quick-book popover |
| D4 | Toggle `[🗺 Plan] [⊞ Karty]` + import `FloorPlanView` |

**👉 ZRÓB RAZ:** DeskMapPage doświadcza fundamentalnej przebudowy w Sprint A + D. Lepiej zacząć od szkieletu z togglem (D4) i od razu wbudować tabs (A2). Jeden PR.

---

### `apps/unified/src/pages/DashboardPage.tsx`

Dotyczy: **A1 + K2**

| Sprint | Co zmienia |
|--------|-----------|
| A1 | KPI z trendem, Today's Issues widget, quick actions strip, hourly heatmap fix |
| K2 | Nowa sekcja "AI Insights" z wygenerowanymi obserwacjami |

**👉 ZRÓB RAZ:** Dodaj placeholder `{ext?.insights && <InsightsWidget insights={ext.insights} />}` w A1 — K2 wypełni dane.

---

### `apps/unified/src/pages/ReservationsAdminPage.tsx`

Dotyczy: **A3 + G1**

| Sprint | Co zmienia |
|--------|-----------|
| A3 | Sortowanie kolumn, bulk checkboxes + "Anuluj zaznaczone" |
| G1 | Widok serii rezerwacji (grupowanie po `recurrenceGroupId`) |

---

### `apps/unified/src/pages/OrganizationsPage.tsx`

Dotyczy: **A4 + B + D + E2 + H3 + L1**

| Sprint | Co zmienia |
|--------|-----------|
| A4 | Breadcrumb na szczegóły org |
| B | Link/badge do subskrypcji per org |
| D | Przycisk `Edytuj plan piętra` → `/floor-plan/:locationId` |
| E2 | Zakładka `Sale i parking` przy każdej lokalizacji |
| H3 | Link `Otwórz kiosk` → URL `/kiosk?location=xxx` + konfiguracja PIN |
| L1 | Toggle `Publiczne rezerwacje` + link do strony bookingowej |

**👉 ZRÓB RAZ:** OrganizationsPage to główna strona konfiguracji lokalizacji — wszystkie nowe elementy per lokalizacja trafiają tutaj. Zaplanuj layout tabeli/kart z miejscami na nowe akcje od razu.

---

### `apps/unified/src/pages/ProvisioningPage.tsx`

Dotyczy: **A3**

| Sprint | Co zmienia |
|--------|-----------|
| A3 | Hover-reveal icons zamiast dropdowna, OTA progress bar |

---

### `apps/unified/src/pages/OwnerPage.tsx`

Dotyczy: **B + K2**

| Sprint | Co zmienia |
|--------|-----------|
| B | Zakładka "Subskrypcje" — tabela org z planem/MRR/wygasającymi |
| K2 | Sekcja "Platform Insights" w stats |

---

### `apps/unified/src/pages/ReportsPage.tsx`

Dotyczy: **C2 + K2**

| Sprint | Co zmienia |
|--------|-----------|
| C2 | Date range picker, eksport CSV/XLSX, porównanie biur |
| K2 | Sekcja AI utilization insights |

---

### `apps/unified/src/components/desks/DeskMap.tsx`

Dotyczy: **A2 + D3**

| Sprint | Co zmienia |
|--------|-----------|
| A2 | `onQuickBook(deskId)` callback dla popover |
| D3 | Nowy prop `viewMode: 'grid' | 'plan'` — renderuje `FloorPlanView` albo karty |

---

### `apps/unified/src/locales/pl/translation.json` + `en/translation.json`

Dotyczy: **A + B + D + E + G + H + J + K + L** (każdy sprint dodaje klucze)

| Sprint | Klucze (namespace) |
|--------|-------------------|
| A1 | `dashboard.quickActions.*`, `dashboard.issues.*`, `dashboard.trend.*` |
| A2 | `deskmap.tabs.*`, `deskmap.quickbook.*`, `deskmap.avatar.*` |
| A3 | `table.sort.*`, `table.bulk.*`, `provisioning.ota.progress` |
| A4 | `nav.groups.*`, `breadcrumb.*`, `empty.*`, `notifications.tabs.*` |
| B | `subscription.*` (~30 kluczy) |
| D | `floorplan.*` |
| E1 | `weekly.*` |
| E2 | `resources.*` |
| G1 | `reservations.recurring.*` |
| H | `mobile.bottomnav.*`, `kiosk.*` |
| J | `visitors.*` |
| K | `recommendations.*` |
| L | `public.*`, `payments.*` |

**👉 ZRÓB RAZ:** Przygotuj strukturę kluczy (z placeholderami) dla wszystkich sprintów od razu. Dodanie pustego namespace `"floorplan": {}` nic nie psuje. Tłumaczenia EN możesz wygenerować z PL przez Claude przy każdym sprincie.

---

## Plan sesji dev — optymalny porządek

### Sesja 0 — Infrastruktura bazy (½ dnia) ← ZAWSZE PIERWSZA

**Cel:** Jedna migracja Prisma obejmująca WSZYSTKIE nowe pola z B–L.

```
schema.prisma ← JEDEN RAZ PEŁNY
  + SubscriptionEvent
  + Desk.posX/posY/rotation/width/height
  + Location.floorPlanUrl/W/H/gridSize
  + Location.kioskPin/isKioskEnabled
  + Location.isPublic/publicSlug/pricingEnabled/pricePerHour
  + Organization.limitDesks/Users/Gateways/Locations/mrr/billingEmail
  + Resource model (ResourceType enum)
  + UserSchedule model
  + UserPreferences model
  + Visitor model
  + PushSubscription model
  + Reservation.recurrenceRule/recurrenceGroupId
  + Reservation.paymentStatus/stripeSessionId

npx prisma migrate dev --name v012_full_schema
```

**Dlaczego:** Prisma generuje typy TypeScript. Robiąc migrację raz, masz typy dla wszystkich sprintów od razu. Nie wracasz do schema.prisma i nie robisz kolejnych migracji.

---

### Sesja 1 — Routing + Nawigacja (1 dzień) ← DRUGA

**Cel:** App.tsx i AppLayout.tsx w pełnej konfiguracji docelowej. Reszta sprintów nie wraca do tych plików.

```
App.tsx
  + WSZYSTKIE importy stron (lazy loaded)
  + WSZYSTKIE route'y (nawet do stron placeholder)
  + Grupowanie: WORKSPACE/ZARZĄDZANIE/ANALITYKA/KONFIGURACJA

AppLayout.tsx
  + NAV_GROUPS struktura z WSZYSTKIMI linkami
  + ExpiryBanner slot (sprint B wypełni)
  + BottomNav slot (sprint H wypełni)
  + Breadcrumbs komponent szkielet
```

**Po tej sesji:** Żaden sprint nie edytuje App.tsx ani AppLayout.tsx — tylko tworzy strony/komponenty.

---

### Sesja 2 — API Client (½ dnia) ← TRZECIA

**Cel:** `api/client.ts` z WSZYSTKIMI metodami (nawet jako stubs).

```
api/client.ts
  + appApi.subscription.*
  + appApi.reports.export()
  + appApi.desks.updatePositions()
  + appApi.locations.uploadFloorPlan() / getAttendance() / verifyKioskPin()
  + appApi.resources.*
  + appApi.reservations.createRecurring() / bulkCancel()
  + appApi.visitors.*
  + appApi.desks.getRecommended()
  + appApi.public.*
  + appApi.payments.*
  + appApi.users.registerPush()
```

---

### Sesja 3 — i18n klucze (½ dnia) ← CZWARTA

**Cel:** Kompletna struktura `translation.json` dla obu języków.

```
pl/translation.json ← dodaj namespace'y dla B–L (z placeholderami)
en/translation.json ← identyczna struktura
```

**Po tej sesji:** Każdy sprint tylko wypełnia wartości kluczy — nie edytuje struktury JSON.

---

### Sesja 4 — Dashboard refactor (Sprint A1) — 2 dni

Teraz właściwe implementacje:

```
DashboardPage.tsx
  + KPI trend badges
  + TodayIssuesWidget komponent
  + QuickActionsStrip komponent
  + Hourly heatmap mobile fix
  + Placeholder <InsightsWidget /> (sprint K wypełni)
```

---

### Sesja 5 — Mapa biurek refactor (Sprint A2 + D4 razem) — 4 dni

```
DeskMapPage.tsx
  + Location tabs z occupancy (A2)
  + Quick-book popover (A2)
  + Toggle [Plan | Karty] (D4)
  + Import FloorPlanView z guard (if !floorPlanUrl → karty fallback)

DeskMap.tsx
  + prop viewMode
  + onQuickBook callback
```

**Dlaczego A2 + D4 razem:** Oba dotyczą DeskMapPage. D4 refaktoruje strukturę strony (toggle widoku) — łatwiej od razu wbudować A2 (tabs, popover) w nową strukturę niż robić to osobno i mergować.

---

### Sesja 6 — Tabele + Prowizja (Sprint A3) — 2 dni

```
ReservationsAdminPage.tsx   + sorting, checkboxes, bulk cancel
ProvisioningPage.tsx        + hover icons, OTA progress bar
```

---

### Sesja 7 — Nawigacja UX (Sprint A4) — 2 dni

```
AppLayout.tsx               (już ma strukturę) → wypełnij groupy WORKSPACE etc.
DashboardPage.tsx           (już ma placeholdery) → breadcrumbs
OrganizationsPage.tsx       (zaplanuj sloty) → kiosk button, subscription badge
NotificationsPage.tsx       + tabs (IoT / Rezerwacje / System)
QrCheckinPage.tsx           + checkmark animation
```

---

### Sesja 8 — Backend A3 (bulkCancel) + B backend — 2 dni

```
reservations.controller.ts  + DELETE /reservations/bulk
reservations.service.ts     + bulkCancel(ids)
subscriptions.service.ts    (NOWY) — getStatus, updatePlan
subscriptions.controller.ts (NOWY)
owner.service.ts             + getSubscriptionDashboard
owner.controller.ts          + /owner/subscription/* routes
```

---

### Sesja 9 — Frontend B (Subskrypcje) — 2 dni

```
SubscriptionPage.tsx        (NOWY)
OwnerPage.tsx               + zakładka Subskrypcje
AppLayout.tsx               + ExpiryBanner (warunkowo)
```

---

### Sesja 10 — C (Grafana + CSV Export) — 3 dni

```
prometheus.yml              (NOWY)
docker-compose.monitoring.yml (NOWY)
reports.controller.ts       + GET /reports/export
ReportsPage.tsx             + date range picker, eksport button
```

---

### Sesja 11 — D backend + D2 FloorPlanEditor — 6 dni

```
desks.service.ts            + updatePositions, getByFloorPlan
desks.controller.ts         + PATCH /desks/positions, POST /locations/:id/floor-plan
update-desk.dto.ts          + posX, posY, rotation
locations.service.ts        + updateFloorPlan
FloorPlanEditor/            (NOWY katalog — 4 komponenty)
```

---

### Sesja 12 — D3 FloorPlanView — 3 dni

```
FloorPlanView/              (NOWY katalog — 3 komponenty)
DeskMapPage.tsx             (już ma toggle) → FloorPlanView gotowy → podłącz
```

---

### Sesja 13 — E1 Weekly View — 4 dni

```
locations.controller.ts     + GET /locations/:id/attendance
locations.service.ts        + getAttendance
WeeklyViewPage.tsx          (NOWY) — siatka 5 dni
```

---

### Sesja 14 — E2 Sale + Parking — 5 dni

```
schema.prisma               (już zmieniony) — Resource model
resources.module.ts         (NOWY)
resources.controller.ts     (NOWY)
resources.service.ts        (NOWY)
ResourcesPage.tsx           (NOWY) + zakładki w DeskMapPage
OrganizationsPage.tsx       + zakładka Sale/Parking (slot już istnieje)
```

---

### Sesja 15 — F1/F2 Integracje (Teams + Slack) — 5 dni

```
teams.module.ts             (NOWY)
slack.module.ts             (NOWY)
IntegrationsPage.tsx        (NOWY) — połącz Teams/Slack/Outlook
```

---

### Sesja 16 — G1 Recurring — 3 dni

```
reservations.service.ts     + createRecurring
reservations.controller.ts  + POST /reservations/recurring
ReservationsAdminPage.tsx   (slot już istnieje) + widok serii
ReservationModal w DeskMap  + RecurringToggle
```

---

### Sesja 17 — H Mobile UX — 4 dni

```
AppLayout.tsx               (slot) → BottomNav komponent
MyReservationsPage.tsx      + swipe gestures
KioskPage.tsx               (NOWY)
OrganizationsPage.tsx       (slot) → kiosk link + PIN config
```

---

### Sesja 18 — I Testy P4/P5 — 5 dni

```
vitest.config.ts            (NOWY)
FloorPlanEditor.test.tsx    (NOWY)
WeeklyView.test.tsx         (NOWY)
playwright.config.ts        (NOWY)
e2e/*.spec.ts               (NOWE)
```

---

### Sesja 19 — J Visitor Management — 5 dni

```
visitors.module.ts          (NOWY)
visitors.controller.ts      (NOWY)
visitors.service.ts         (NOWY)
VisitorsPage.tsx            (NOWY)
DashboardPage.tsx           (slot) → visitors widget
```

---

### Sesja 20 — K AI Insights — 4 dni

```
recommendations.service.ts  (NOWY)
ReportsPage.tsx             (slot) → InsightsWidget
DashboardPage.tsx           (slot) → InsightsWidget (mały)
OwnerPage.tsx               (slot) → Platform Insights
```

---

### Sesja 21 — L Public Booking + Stripe — 6 dni

```
public-booking.module.ts    (NOWY)
payments.module.ts          (NOWY)
PublicBookingPage.tsx       (NOWY — bez AppLayout)
OrganizationsPage.tsx       (slot) → public toggle
```

---

## Reguły plików do zastosowania przez każdy sprint

### Pliki ZAMROŻONE po sesji infrastruktury (0–3)

Po sesji 0–3 te pliki NIE mogą być edytowane przez kolejne sprinty (tylko nowe pliki):

| Plik | Po jakiej sesji |
|------|----------------|
| `schema.prisma` | Sesja 0 |
| `App.tsx` | Sesja 1 |
| `AppLayout.tsx` | Sesja 1 (wyjątek: slot-filling) |
| `api/client.ts` | Sesja 2 |
| `translation.json` (PL + EN) | Sesja 3 (wyjątek: wartości) |

### Pliki SLOT-BASED (wypełniane stopniowo)

Te pliki mają placeholdery od początku, sprinty je **wypełniają** (nie dodają nowych bloków):

| Plik | Sprint który wypełnia |
|------|----------------------|
| `AppLayout.tsx` → `ExpiryBanner` | B |
| `AppLayout.tsx` → `BottomNav` | H |
| `AppLayout.tsx` → `Breadcrumbs` | A4 |
| `DashboardPage.tsx` → `<InsightsWidget />` | K |
| `DashboardPage.tsx` → `<VisitorsWidget />` | J |
| `OrganizationsPage.tsx` → kiosk button | H3 |
| `OrganizationsPage.tsx` → subscription badge | B |
| `OrganizationsPage.tsx` → public toggle | L |
| `ReportsPage.tsx` → `<InsightsWidget />` | K |
| `OwnerPage.tsx` → Subskrypcje tab | B |

### Pliki które dotyczy MAX 1 sprint (proste, nie wracamy)

| Plik | Sprint |
|------|--------|
| `ChangePasswordPage.tsx` | — (gotowe) |
| `LoginPage.tsx` | — (gotowe) |
| `SmtpConfigSection.tsx` | — (gotowe) |
| `DevicesPage.tsx` | A3 (tylko hover icons) |
| `QrCheckinPage.tsx` | A4 (animacja) |
| `MyReservationsPage.tsx` | H2 (swipe) |
| `NotificationsPage.tsx` | A4 (tabs) |
| `KioskPage.tsx` | H3 (NOWY) |
| `WeeklyViewPage.tsx` | E1 (NOWY) |
| `VisitorsPage.tsx` | J (NOWY) |
| `PublicBookingPage.tsx` | L1 (NOWY) |
| `SubscriptionPage.tsx` | B (NOWY) |
| `FloorPlanEditorPage.tsx` | D2 (NOWY) |

---

## Podsumowanie: kolejność sesji

```
Sesja 0 — schema.prisma (½d)         ← Fundament. Zawsze pierwsza.
Sesja 1 — App.tsx + AppLayout (1d)   ← Routing + nawigacja finalna
Sesja 2 — api/client.ts (½d)         ← Wszystkie metody API
Sesja 3 — translation.json (½d)      ← Struktura i18n dla wszystkich sprintów
──────────────────────────────────────── IMPLEMENTACJE ────────────────────
Sesja 4 — Sprint A1: Dashboard (2d)
Sesja 5 — Sprint A2+D4: DeskMap (4d) ← Razem bo te same pliki
Sesja 6 — Sprint A3: Tabele (2d)
Sesja 7 — Sprint A4: Nawigacja (2d)
Sesja 8 — Sprint B backend (2d)
Sesja 9 — Sprint B frontend (2d)
Sesja 10 — Sprint C: Grafana+CSV (3d)
Sesja 11 — Sprint D2: FloorPlanEditor (6d)
Sesja 12 — Sprint D3: FloorPlanView (3d)
Sesja 13 — Sprint E1: Weekly View (4d)
Sesja 14 — Sprint E2: Resources (5d)
Sesja 15 — Sprint F: Teams+Slack (5d)
Sesja 16 — Sprint G1: Recurring (3d)
Sesja 17 — Sprint H: Mobile UX (4d)
Sesja 18 — Sprint I: Testy (5d)
Sesja 19 — Sprint J: Visitors (5d)
Sesja 20 — Sprint K: AI Insights (4d)
Sesja 21 — Sprint L: Public+Stripe (6d)
```

**Łącznie: ~21 sesji dev, 0 powrotów do tych samych plików.**

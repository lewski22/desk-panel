# Roadmap — Reserti Desk Management System

> Ostatnia aktualizacja: 2026-04-15 — po analizie rynku i benchmarkingu UI

---

## Stan aktualny (v0.11.0 — 2026-04-15)

### ✅ Zrealizowane (produkcja)

**Infrastruktura**
- Deploy: Coolify na Proxmox LXC + Cloudflare Tunnel
- PostgreSQL 15 + Mosquitto MQTT + Docker
- Metryki: Prometheus (backend /metrics + gateway :9100)

**Backend (NestJS + Prisma)**
- JWT auth (15min access / 7d refresh) + rotacja tokenów
- Multi-tenant: Organization → Location → Desk
- Role: OWNER, SUPER_ADMIN, OFFICE_ADMIN, STAFF, END_USER
- Rate limiting + Entra ID SSO + MQTT bridge + LED Event Bus
- Gateway provisioning (tokeny 24h) + Device provisioning (MQTT credentials)
- Rezerwacje: konflikty, QR, cancel + LED FREE
- Check-in: NFC / QR walkin / ręczny; Checkout; Cron expireOld + autoCheckout
- OTA firmware (4 fazy): GitHub Actions CI, status tracking, org isolation
- Powiadomienia email (8 typów, SMTP per org AES-256-GCM)
- Powiadomienia in-app (dzwoneczek, reguły, ogłoszenia OWNER)
- Testy: 178 (P1 64 + P2 63 + P3 51)

**Unified Panel (React)**
- PWA (manifest, service worker, ikony, offline cache)
- i18n PL/EN — 427 kluczy, 100% pokrycie, 0 alert()
- Mapa biurek: DeskCard grid, ReservationModal per rola
- Provisioning: tokeny, OTA badges, auto-refresh

**Gateway Python + Firmware ESP32**
- Cache offline, SyncService, DeviceMonitor, Prometheus exporter
- NFC + LED + OTA_UPDATE + offline NVS queue (TTL 1h)

---

## Strategia rozwoju — wnioski z analizy rynku

Na podstawie benchmarkingu 6 konkurentów (Robin, Deskbird, Envoy, Archie, Skedda, TableAir):

**Unikalna pozycja Reserti:** jedyna platforma łącząca hot-desk SaaS z własnym hardware IoT
(NFC + LED beacon). Żaden główny competitor tego nie oferuje.

**Główne luki vs. rynek:**
1. Brak wizualnego planu biura (floor plan) — feature #1 we wszystkich recenzjach
2. Brak widoku „kto kiedy w biurze" (hybrid team scheduling)
3. Brak sali konferencyjnej i parkingu jako zasobów do rezerwacji
4. UI dashboard — 30+ konkretnych usprawnień vs. best practices 2025–2026
5. Brak eksportu danych (CSV/XLSX) z raportów
6. Brak Slack integracji (obok planowanego Teams M2)

Szczegółowa analiza: `docs/market-analysis.md`
Plan wdrożenia bez powrotów do plików: `docs/sprint-batching.md`

---

## SPRINT A — UI Quick Wins (v0.12.0-ui) — **22 dni łącznie**

> Cel: zamknąć najważniejsze luki UX bez nowych endpointów API.
> Wszystkie zmiany frontendowe, możliwe do wdrożenia równolegle z backendem.

### A1 — Dashboard (7 dni)

**KPI cards z trendem i kontekstem** — 2 dni
- Dodaj strzałkę ↑↓ z % zmiany vs poprzedni tydzień do każdego KPI
- Tooltip po hover: wartość poprzedniego okresu
- Animowana cyfra przy zmianie (CSS count-up)
- Kolor strzałki: zielony ↑ dla dobrych metryk (zajętość, check-iny), czerwony ↓

**Quick Actions strip na dashboardzie** — 2 dni
- Poziomy pasek pod KPI: `[+ Zarezerwuj biurko] [✋ Check-in ręczny] [📊 Eksportuj dziś] [📢 Wyślij ogłoszenie]`
- Każda akcja otwiera modal bezpośrednio — bez nawigacji do innej strony
- Widoczny tylko dla OFFICE_ADMIN+ (END_USER nie potrzebuje)
- Skraca typowy workflow z 3 kliknięć do 1

**"Today's Issues" widget** — 2 dni
- Zastąp obecny `Desk Grid` (kolorowe kwadraty bez sensu przy 20+ biurkach)
- Nowy widget: lista problemów wymagających uwagi dziś
  - Beacony offline > 30 min
  - Biurka OCCUPIED > 3h bez check-out
  - Urządzenia z błędem OTA (`otaStatus: failed`)
  - Rezerwacje bez check-in po 30 min od startTime
- Kliknięcie w pozycję → nawigacja do właściwej strony

**Hourly heatmap — naprawa osi X na mobile** — 1 dzień
- Pokaż etykiety co 2h zamiast co godzinę
- Na mobile (`< 640px`): uproszczony widok — 3 bary (Rano 8-12 / Południe 12-16 / Wieczór 16-20)
- Dodaj tooltip z dokładną wartością przy hover/tap

---

### A2 — Mapa biurek (5 dni)

**Location tabs z live occupancy** — 1 dzień
- Zastąp dropdown `Biuro:` paskiem zakładek
- Każda zakładka: nazwa biura + `(23/30 biurek)` — zajętość w czasie rzeczywistym
- Na mobile: horizontal scroll tabs
- Kolor zakładki: zielony < 70%, żółty 70–89%, czerwony ≥ 90%

**Avatar użytkownika na zajętym biurku** — 2 dni
- Na zajętym biurku wyświetl inicjały osoby (dla STAFF+, nie END_USER — privacy)
- Tooltip: `Jan Kowalski · check-in od 09:15 · Strefa B`
- Przy hover: mini-karta z avatarem, imieniem, czasem check-in
- Backend: `checkin.user` już jest w getCurrentStatus — tylko UI

**Inline quick-book popover** — 2 dni
- Hover/tap wolnego biurka → mini-popover zamiast pełnego modala
- Default: dziś, 9:00–17:00 (godziny biura z Location.openTime/closeTime)
- Przyciski: `[Zarezerwuj na cały dzień]` i `[Wybierz godziny...]`
- Kliknięcie `Wybierz godziny` → otwiera pełny ReservationModal
- Redukuje flow z 4+ kliknięć do 1 dla typowego use case

---

### A3 — Tabele i listy (5 dni)

**Sortowanie kolumn** — 1 dzień
- Tabele: Rezerwacje, Użytkownicy, Biurka, Urządzenia
- Klikalne nagłówki z ikoną ↑↓ / neutralną
- Stan w URL: `?sort=status&dir=asc` — bookmarkowalny
- Server-side sort dla tabel z paginacją (API już obsługuje ordery)

**Bulk actions w rezerwacjach** — 2 dni
- Checkbox per row w tabeli ReservationsAdminPage
- "Zaznacz wszystkie" w headerze
- Action bar gdy wybrane > 0: `Anuluj zaznaczone (5)` + potwierdzenie
- `DELETE /reservations/bulk` endpoint (nowy) — przyjmuje `ids: string[]`
- Przydatne: ewakuacja biura, anulowanie dnia

**Hover-reveal icons w provisioningu** — 1 dzień
- Przy hover nad wierszem beacona — ujawnij ikony akcji bez dropdowna
- Ikony: `[🔄 Restart] [💡 Identify] [🆙 OTA] [⚙️ Więcej]`
- Szybsze dla administratora technicznego
- Zachowaj dropdown "Więcej" dla rzadkich akcji (unpair, delete)

**OTA progress bar z estymacją czasu** — 1 dzień
- Zastąp badge `in_progress` animowanym paskiem
- Estymacja: OTA typowo 30–60s → przelicz na % po elapsed time
- Jeśli znamy rozmiar binary (z GitHub Releases response) → dokładny progress
- Po 10 min timeout → `failed` z komunikatem

---

### A4 — Nawigacja i UX (5 dni)

**Grupowanie sidebar z separatorami** — 0.5 dnia
- Podziel flat listę na grupy z nagłówkami:
  - `WORKSPACE` — Mapa biurek, Rezerwacje, Moje rezerwacje
  - `ZARZĄDZANIE` — Biurka, Użytkownicy, Urządzenia, Provisioning
  - `ANALITYKA` — Dashboard, Raporty
  - `KONFIGURACJA` — Organizacje, Powiadomienia, Subskrypcja
- Separatory z mini-nagłówkami (10px uppercase zinc-400)
- Nie zmienia szerokości — tylko wizualna hierarchia

**Breadcrumbs + org context** — 1 dzień
- Pod headerem każdej strony: `Demo Corp › Warszawa HQ › Biurka`
- Przy impersonacji: `[Sesja jako: admin@demo-corp.pl] Demo Corp › ...`
- Klikalne — nawigacja do rodzica
- Org name w headerze sidebara (widoczne zawsze)

**Kontekstowe empty states** — 2 dni
- Każda strona/tabela z własnym empty state (zamiast globalnego "Brak danych")
  - Biurka: ikona + `Nie dodano jeszcze żadnych biurek` + `[+ Dodaj pierwsze biurko →]`
  - Rezerwacje: `Brak rezerwacji na ten dzień` + przycisk filtra "Dzisiaj"
  - Urządzenia: `Żaden beacon nie jest jeszcze podłączony` + link do provisioningu
  - Raporty (brak danych): `Zacznij rejestrować check-iny aby zobaczyć statystyki`
- Ilustracja SVG (prosta, brandowa)

**Notyfikacje — tabs i kategorie** — 1 dzień
- Dzwoneczek dropdown: dodaj tabs `Wszystkie | IoT | Rezerwacje | System`
- Badge per tab (np. IoT: 3)
- `Wyczyść wszystkie` per kategoria (nie tylko globalnie)
- Grupy czasowe w flat list: `Dziś`, `Wczoraj`, `Starsze`

**Animacja sukcesu QR check-in** — 0.5 dnia
- Checkmark CSS animation (SVG stroke-dashoffset) zamiast tekstu "Check-in udany!"
- `navigator.vibrate(200)` — haptic feedback na mobile
- Kolor tła zmienia się na zielony (0.3s transition) → wraca do neutral
- Confetti opcjonalne 🎉 (biblioteka `canvas-confetti`, 2kB)

---

### Szacunek Sprint A

| Obszar | Dni |
|--------|-----|
| A1 Dashboard | 7 |
| A2 Mapa biurek | 5 |
| A3 Tabele | 5 |
| A4 Nawigacja | 5 |
| **RAZEM** | **22** |

Priorytety wewnętrzne (zacząć od): A2 Location tabs → A1 Today's Issues → A2 Quick-book → A1 Quick Actions → A4 Sidebar.

---

## SPRINT B — Moduł subskrypcji (v0.12.0) — **6 dni**

> Szczegółowa specyfikacja: `docs/subscription.md`

SUPER_ADMIN widzi stan subskrypcji, limity zasobów, ostrzeżenia o wygasaniu.
OWNER zarządza planami klientów — MRR, wygasające, historia zmian.

**B1 — Schema + API (2 dni)**
- `SubscriptionEvent` model Prisma
- `SubscriptionsService` — `getStatus()`, `updatePlan()`, `getEvents()`
- `GET /subscription/status` (SUPER_ADMIN), `POST /owner/.../subscription` (OWNER)
- `GET /owner/subscription/dashboard` — MRR aggregate + expiring orgs

**B2 — Frontend SUPER_ADMIN (2 dni)**
- `SubscriptionPage.tsx` — PlanBadge, UsageBar (% limit), FeatureList
- `ExpiryBanner` w AppLayout (< 14 dni)
- i18n: `subscription.*` (~30 kluczy PL + EN)

**B3 — Owner Panel (1 dzień)**
- Zakładka "Subskrypcje" w OwnerPage — tabela + modal edycji planu
- MRR KPI + wygasające KPI w Owner Dashboard

**B4 — Notyfikacje (1 dzień)**
- Cron `checkExpiringSubscriptions()` co 24h
- Email + in-app: 30/14/7/1 dni przed wygaśnięciem, limit_exceeded (> 80%, > 95%)

---

## SPRINT C — Grafana + Eksport danych (v0.12.1) — **5 dni**

**C1 — Grafana dashboards (3 dni)**
- `prometheus.yml` + docker-compose stack (Grafana + Prometheus w Coolify)
- Dashboard 1: Owner — System Health (latencja API, DB, MQTT, error rate)
- Dashboard 2: Owner — Fleet Overview (org → gateway → beacon health tree)
- Dashboard 3: Client — Desk Analytics (zajętość, top biurka, check-in metody)
- Dashboard 4: Client — IoT Health (RSSI trend, uptime, sync lag)

**C2 — CSV/XLSX export raportów (2 dni)**
- `GET /reports/export?from=&to=&format=csv|xlsx` (nowy endpoint)
- ReportsPage: date range picker (7d / 30d / custom)
- Eksport zawiera: rezerwacje, check-iny, zajętość per biurko, użytkownik aktywności
- Porównanie biur: Location A vs B w jednym widoku
- Heatmapa: dzień tygodnia × godzina (tabela kolorów w raporcie)

---

## SPRINT D — Floor Plan Editor (v0.13.0) — **18 dni**

> Priorytet #1 spośród wszystkich nowych funkcji. Feature #1 we wszystkich recenzjach SaaS.
> Robin, Deskbird, Archie — wszyscy mają. Brak to największa luka UI Reserti.

### D1 — Backend + Schema (3 dni)

```prisma
model Desk {
  // Nowe pola pozycji na mapie
  posX    Float?   // 0–100 (procent szerokości canvas)
  posY    Float?   // 0–100 (procent wysokości canvas)
  rotation Int?    @default(0)  // 0/90/180/270
  width   Float?   @default(2)  // jednostki siatki
  height  Float?   @default(1)
}

model Location {
  // Plan biura
  floorPlanUrl  String?   // URL do SVG/PNG tła (upload)
  floorPlanW    Int?      // szerokość canvas w pikselach
  floorPlanH    Int?      // wysokość
  gridSize      Int?      @default(40) // px na jednostkę siatki
}
```

- `PATCH /desks/:id` — obsługa `posX`, `posY`, `rotation`
- `POST /locations/:id/floor-plan` — upload obrazu tła (multipart, S3/Cloudflare R2)
- `GET /locations/:id/floor-plan` — URL + metadata
- `GET /locations/:id/desks/status` — już zwraca desk data, dodaj pos*

### D2 — FloorPlanEditor komponent (8 dni)

Komponent dla OFFICE_ADMIN (edycja układu):

```
FloorPlanEditor/
├── FloorPlanCanvas.tsx     SVG canvas z tłem + siatką
├── DeskToken.tsx           Przeciągalny element biurka
├── FloorPlanToolbar.tsx    Upload tła, snapping, zoom
└── FloorPlanEditor.tsx     Główny wrapper z save/discard
```

Zachowanie:
- Upload PNG/SVG planu biura → staje się tłem canvas
- Drag & drop tokenów biurek na pozycje
- Snapping do siatki (grid 40px, wyłączalne)
- Rotate token: prawy klik → menu / `R` key
- Zoom: scroll kółkiem, pinch-to-zoom mobile
- `Ctrl+Z` undo / redo (prosty stos operacji)
- Save: `PATCH /desks/:id` dla każdego przesuniętego biurka (batch)
- Dostępne w: Organizacje → biuro → `Edytuj plan piętra`

### D3 — FloorPlanView komponent (5 dni)

Komponent dla wszystkich ról (widok):

```
FloorPlanView/
├── FloorPlanCanvas.tsx     SVG z tłem
├── DeskPin.tsx             Pin na mapie (kolor LED status)
└── DeskInfoCard.tsx        Popup po kliknięciu
```

Zachowanie:
- Każde biurko jako pin z kolorem statusu (zielony/niebieski/czerwony/szary)
- Kliknięcie pinu → DeskInfoCard (kto siedzi, od kiedy, status, ReservationModal)
- Legenda kolorów na dole
- Dla END_USER: ukryj avatary (tylko kolor statusu)
- Filtr: `Pokaż tylko wolne`
- Toggle: `Widok kart ↔ Widok planu` w DeskMapPage

### D4 — Migracja DeskMapPage (2 dni)

- Dodaj toggle `[🗺 Plan] [⊞ Karty]` w DeskMapPage
- Domyślnie: Plan (jeśli lokalizacja ma floorPlanUrl) / Karty (fallback)
- Preferencja zapisana w localStorage per user
- ReservationModal działa identycznie w obu widokach

---

## SPRINT E — Widok hybrydowy + Sala/Parking (v0.13.0) — **15 dni**

### E1 — Weekly View „Kto kiedy w biurze" (7 dni)

Widok tygodniowy pokazujący obecność zespołu — jeden z najbardziej pożądanych features w recenzjach (Deskbird, Robin).

**Backend (2 dni):**
- `GET /locations/:id/attendance?week=2026-W20` — nowy endpoint
- Zwraca: per dzień × per user — `{ date, userId, status: 'office'|'remote'|'unknown' }`
- Status 'office' = ma check-in lub rezerwację na dany dzień
- Opcjonalnie: user ustawia plan tygodnia manualnie (`POST /users/me/schedule`)

**Frontend (5 dni):**
- Nowa strona `WeeklyViewPage.tsx` — dostępna dla wszystkich ról
- Siatka: 5 kolumn (Pon–Pt) × lista userów (avatary + imię)
- Zielona kropka = biuro, domek = remote, szary = brak info
- Filtr po strefie/dziale (jeśli mamy grupy)
- Mobile: swipe między dniami tygodnia
- Link w nawigacji: `Kalendarz` (między Mapa a Rezerwacje)

### E2 — Sale konferencyjne i parking (8 dni)

Rozszerza adresowany rynek — większość biur potrzebuje nie tylko biurek.

**Schema (1 dzień):**
```prisma
enum ResourceType { DESK | ROOM | PARKING | EQUIPMENT }

model Resource {
  id           String       @id @default(cuid())
  locationId   String
  type         ResourceType @default(DESK)
  name         String
  code         String
  // Dla ROOM:
  capacity     Int?
  amenities    String[]     // ["TV", "whiteboard", "videoconf"]
  // Dla PARKING:
  vehicleType  String?      // "car" | "moto" | "bike"
  // Dla DESK: istniejące pola
  floor        String?
  zone         String?
  // Pozycja na floor plan
  posX Float? posY Float? rotation Int?
  status  String @default("ACTIVE")
  // relacje
  location Location @relation(...)
  bookings Booking[]
}

model Booking {
  // Zastępuje/rozszerza Reservation w przyszłości
  // Albo: Reservation.resourceId nullable (łatwiejsza migracja)
}
```

**Backend (3 dni):**
- `GET /locations/:id/resources?type=ROOM` — lista zasobów per typ
- `POST /locations/:id/resources` — tworzenie (OFFICE_ADMIN+)
- `GET /resources/:id/availability?date=` — wolne sloty
- Walidacja konfliktów w `reservations.service` — sprawdza zasób, nie tylko biurko
- `Reservation.deskId` → `resourceId` (lub polymorphic)

**Frontend (4 dni):**
- Zakładki w DeskMapPage: `Biurka | Sale | Parking`
- ResourceCard (analogicznie do DeskCard) z pojemnością i wyposażeniem
- RoomReservationModal: wybór godzin + opcjonalnie catering/sprzęt
- Ikony zasobów w floor plan (sala = prostokąt, parking = P)

---

## SPRINT F — Integracje zewnętrzne (v0.13.1) — **12 dni**

### F1 — Microsoft Teams App (M2) — 5 dni

Aplikacja Teams do rezerwacji biurek bezpośrednio w Teams.

- Teams tab: mapa biurek w iframe Teams (React komponent jako tab app)
- Personal app: `My Desk Today` — moje rezerwacje w Teams sidebar
- Bot command: `/reserve desk A-01 tomorrow 9-11`
- Bot command: `/desk status` — moja rezerwacja dziś
- Autentykacja: Teams SSO → Entra ID token → Reserti JWT (seamless)
- Azure Bot Framework + Teams Manifest JSON

### F2 — Slack Bot — 3 dni

Uzupełnienie dla firm niebędących w ekosystemie M365. Szczególnie ważne bo Slack jest #2 platformą komunikacyjną po Teams.

- Slash commands: `/desk reserve`, `/desk status`, `/desk map`
- `/desk reserve A-01 jutro 9:00-17:00` → modal potwierdzenia w Slack
- `/desk map` → link do mapy + aktualna zajętość (attachment z kolorami)
- Incoming Webhooks: powiadomienia o check-in/checkout do kanału #office
- Slack App Directory submission (publiczne)
- OAuth2 flow: workspace install → Reserti API JWT per Slack user

### F3 — Microsoft Graph Sync (M4) — 4 dni

Dwustronna synchronizacja z kalendarzem Outlook.

- Webhook Microsoft Graph: `calendarView` events dla użytkownika
- Nowa rezerwacja w Outlook (z "Biurko" w tytule) → pojawia się w Reserti
- Nowa rezerwacja w Reserti → creates Outlook event automatycznie
- Anulowanie: synchronizowane w obu kierunkach
- Konflikty: Reserti jest source of truth dla biurek
- `POST /integrations/graph/webhook` — endpoint Reserti dla MS Graph

---

## SPRINT G — Recurring + PWA Push (v0.14.0) — **7 dni**

### G1 — Recurring reservations — 5 dni

Cykliczne rezerwacje — np. „każdy poniedziałek przez miesiąc".

- Schema: `Reservation.recurrenceRule String?` (iCal RRULE: `RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4`)
- `recurrenceGroupId String?` — łączy powiązane rezerwacje
- `createRecurring(dto, rule)` — generuje serie, sprawdza każdą instancję pod kątem konfliktów
- Jeśli któraś instancja ma konflikt → lista propozycji do zaakceptowania/pominięcia
- UI: `RecurringToggle` w ReservationModal
  - Opcje: Nie powtarza / Codziennie / Co tydzień / Własna reguła
  - Podgląd: lista dat które zostaną zarezerwowane
- Anulowanie: jednej instancji / tej i następnych / wszystkich w grupie

### G2 — PWA Push notifications — 2 dni

Rozszerzenie istniejącego PWA o natywne notyfikacje push.

- `PushSubscription` model w DB per user (endpoint, auth, p256dh)
- `POST /users/me/push-subscription` — rejestracja subskrypcji
- Service worker: `push` event handler → `showNotification()`
- Backend: `web-push` library — wysyłka przy każdym in-app notification
- Użytkownik widzi powiadomienie nawet gdy przeglądarka zamknięta
- Opt-in dialog w NotificationsPage (nie browser default popup)

---

## SPRINT H — Mobile UX (v0.14.1) — **8 dni**

### H1 — Bottom navigation bar — 3 dni

Na podstawie badań UX: hamburger menu na mobile jest trudniejszy od bottom nav.

- Na `< 640px`: bottom navigation bar z 4 stałymi pozycjami
  - `🗺 Mapa` / `📅 Rezerwacje` / `📋 Moje` / `👤 Profil`
  - Badge na `Moje` gdy aktywna rezerwacja
- AppLayout: `md:hidden` bottom bar, `hidden md:block` sidebar
- Sidebar nadal dostępny przez ikonę `≡` w headerze (pełne menu)
- Active state: ikona + label zabarwiony (#B53578)

### H2 — Swipe gestures — 2 dni

Natywne gesty mobile które użytkownicy oczekują.

- Moje rezerwacje: swipe left → reveal "Anuluj" button (iOS Mail pattern)
- Powiadomienia: swipe right → mark as read, swipe left → delete
- DeskCard: swipe → expand/collapse szczegóły (opcjonalnie)
- Biblioteka `@use-gesture/react` (10kB, zero deps)

### H3 — Kiosk/Tablet mode — 3 dni

Dedykowany widok na tablet przy wejściu do biura lub recepcji.

- Route `/kiosk?location=xxx&pin=1234` — fullscreen, auto-refresh 30s
- Duże karty biurek: status + kod + strefa (touch-friendly 80px min)
- Navbar ukryty — czysty widok zajętości
- Wychodzi z kiosk mode: PIN (4 cyfry, konfigurowalny per org w ustawieniach)
- Link do kiosk mode w OrganizationsPage przy każdej lokalizacji
- `Location.kioskPin String?` w schema

---

## SPRINT I — Testy i jakość (v0.14.2) — **8 dni**

### I1 — Testy P4 Frontend (Vitest) — 5 dni

- Konfiguracja: Vitest + `@testing-library/react` + jsdom + `@testing-library/user-event`
- `NotificationBell.test.tsx` — render, odznaka, dropdown, markAllRead, tab switching
- `ProvisioningPage.test.tsx` — OtaBadge states, ota-all button, progress bar
- `UsageBar.test.tsx` — kolory przy 0/70/90/100%
- `FloorPlanEditor.test.tsx` — drag, drop, save, undo
- `WeeklyView.test.tsx` — render, filtrowanie, puste stany
- CI: `vitest run --coverage` w GitHub Actions (target: > 70% branch coverage)

### I2 — Testy P5 E2E (Playwright) — 3 dni

- Login flow → dashboard → KPI visible
- Tworzenie rezerwacji → pojawia się w My Reservations
- Anulowanie → status CANCELLED → LED FREE request sent
- OTA trigger → `otaStatus: in_progress` w tabeli
- Floor plan: drag biurka → save → refresh → pozycja zachowana
- QR check-in flow (mock skanowania tokenu)

---

## SPRINT J — Visitor Management (v0.15.0) — **8 dni**

> Ważny feature dla enterprise i biur coworkingowych.
> Robin i Envoy mają — Reserti może to oferować jako IoT advantage (NFC badge dla gości).

### J1 — Schema + API (3 dni)

```prisma
model Visitor {
  id           String    @id @default(cuid())
  locationId   String
  hostUserId   String    // kto zaprosił
  firstName    String
  lastName     String
  email        String
  company      String?
  visitDate    DateTime
  purpose      String?
  status       String    @default("INVITED")  // INVITED|CHECKED_IN|CHECKED_OUT|CANCELLED
  qrToken      String    @unique @default(cuid())
  checkedInAt  DateTime?
  checkedOutAt DateTime?
  badgePrinted Boolean   @default(false)
  createdAt    DateTime  @default(now())
  location     Location  @relation(...)
  host         User      @relation(...)
}
```

- `POST /visitors` — zaproś gościa (email z QR kodem)
- `GET /visitors/:locationId?date=` — lista gości na dzień
- `POST /visitors/:id/checkin` — check-in (QR scan lub ręczny)
- `POST /visitors/:id/checkout` — check-out
- Email invite template z QR kodem

### J2 — Frontend (5 dni)

- `VisitorsPage.tsx` — lista gości z filtrem daty (OFFICE_ADMIN+)
- `InviteVisitorModal` — imię, email, data, cel wizyty, host (auto = zalogowany)
- Email invite z QR kodem → gość skanuje przy wejściu (QrCheckinPage obsługuje VISITOR typ)
- Badge print: `window.print()` z szablonu HTML (logo, imię, firma, data, QR)
- Widget "Dzisiejsi goście" na dashboardzie (count badge)

---

## SPRINT K — AI + Rekomendacje (v0.15.1) — **8 dni**

> Wyróżnik rynkowy — żaden competitor nie ma AI desk recommendation (Robin zapowiedział, nie wdrożył).

### K1 — Smart desk recommendations (5 dni)

Proste rule-based AI (nie ML) na start — można rozbudować.

**Algorytm:**
1. Sprawdź ostatnie 20 rezerwacji usera → najczęstsze biurko X
2. Sprawdź czy X jest wolne w żądanym terminie → jeśli tak: `sugeruję A-01`
3. Jeśli nie: znajdź biurko w tej samej strefie co historyczne
4. Sprawdź kto będzie w biurze (WeeklyView data) → sugeruj pobliskie biurko współpracownicy
5. Fallback: biurko z najdłuższym uptime (stabilny beacon)

**Implementacja:**
- `RecommendationsService.getSuggested(userId, date, startTime, endTime)`
- `GET /desks/recommended?date=&start=&end=` — dla END_USER
- UI: banner nad mapą: `💡 Sugerowane biurko: A-01 (Twoje ulubione)` + `[Zarezerwuj]`
- Dismissable na sesję, zapamiętane preferencje w `UserPreferences` modelu

### K2 — Utilization AI insights (3 dni)

Proste insights w ReportsPage dla OFFICE_ADMIN:

- `🔴 Biurka A-01..A-03 nigdy nie używane w piątki → rozważ zmianę układu`
- `📈 Strefę B odwiedza się 3x częściej niż A → priorytetyzuj tam biurka`
- `⚠️ 6 użytkowników nie robiło check-in przez ostatnie 30 dni → dezaktywować?`
- Generowane raz dziennie przez cron, cachowane w Redis/DB
- Prosty template engine — nie LLM (kosztowne, wolne)

---

## SPRINT L — Publiczny booking + Coworking (v0.16.0) — **10 dni**

> Otwiera nowy segment rynku — coworking spaces, hotelarstwo, shared offices.

### L1 — Public booking mode (6 dni)

**Schema:**
```prisma
model Location {
  isPublic      Boolean  @default(false)
  publicSlug    String?  @unique
  requiresEmail Boolean  @default(true)
  maxAheadDays  Int      @default(7)  // publiczni mogą rezerwować max N dni do przodu
  pricingEnabled Boolean @default(false)
}
```

- Route: `https://app.reserti.pl/book/{slug}` — publiczna strona
- Formularz: email (wymagany, weryfikacja), imię, data, godziny
- Email potwierdzenia z QR kodem → QR check-in jak normalnie
- Rate limiting per email: max 3 rezerwacje/tydzień (konfigurowalny)
- OFFICE_ADMIN włącza per lokalizacja w OrganizationsPage

### L2 — Online payments (4 dni)

Dla coworking spaces — opcjonalne płatności.

- Stripe integration (`stripe` SDK) — Checkout Session
- `Location.pricePerHour Float?` — cena za godzinę
- `Reservation.paymentStatus String?` — PENDING/PAID/CANCELLED
- Po rezerwacji → Stripe Checkout → callback → aktywacja rezerwacji
- `GET /webhooks/stripe` — obsługa payment.succeeded
- Faktura automatyczna przez Stripe Billing
- Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

---

## P3 — Roadmapa długoterminowa (Q4 2026–Q1 2027)

### Self-hosted deployment — 3 dni

- `docker-compose.prod.yml` z wszystkimi serwisami
- `install-selfhosted.sh` — jeden skrypt na Ubuntu 22.04
- Backup/restore: `pg_dump` + cron
- Dokumentacja: `docs/self-hosted.md`
- Licencjonowanie: Community (open-source core) + Enterprise (subscription features)

### Outlook Add-in (M3) — already scaffolded

- Aktualizacja do Office JS API v1.7
- `taskpane.html` — lista biurek wolnych w godzinach eventu
- One-click reserve przy tworzeniu meetingu

### Dark mode — 7 dni

- CSS custom properties dla każdego koloru (już częściowo przez Tailwind)
- `prefers-color-scheme` media query + ręczny toggle
- Przełącznik w user profile/sidebar footer
- Wszystkie komponenty: DeskCard, Modal, Charts (recharts theming)
- Testy visual regression (Playwright screenshot diff)

### Globalny Cmd+K search — 8 dni

- `Command Palette` komponent (jak Linear, Vercel, Notion)
- `Ctrl+K` / `Cmd+K` otwiera modal
- Wyszukiwanie: biurko po kodzie/nazwie, user po emailu/imieniu, rezerwacja po dacie
- Recent items (localStorage)
- Keyboard navigation (arrows + Enter)
- Backend: `GET /search?q=` — unified search across entities

### Certyfikacja ISO 27001 — wymagania techniczne

- Audit log UI dla SUPER_ADMIN (przeglądanie Event log)
- Data retention policy UI — SUPER_ADMIN konfiguruje czas przechowywania
- Export danych (GDPR Art. 20) — `GET /users/me/export` → ZIP z JSON
- Szyfrowanie w spoczynku (PostgreSQL TDE lub kolumnowe)
- 2FA dla SUPER_ADMIN i OWNER (TOTP — `otpauth://`)

---

## Znane bugs / tech debt

| # | Bug | Priorytet | Opis |
|---|-----|-----------|------|
| 1 | Beacon timestamp bez RTC | niski | `millis()/1000` reset przy restarcie — TTL queue niedokładne |
| 2 | Entra ID SSO — STAFF/END_USER | niski | Aktualnie tylko OFFICE_ADMIN może logować przez SSO |
| 3 | `prisma migrate deploy` | niski | Seed idempotentny działa, ale lepiej przejść na migracje |
| 4 | i18n ProvisioningPage — instrukcje PL | niski | Hardcoded PL tekst w `InstallTokenModal` |
| 5 | DeskMap `getDeskConfig(desk, t)` | niski | t jako argument — przenieść do React context |
| 6 | `date @db.Date` — brak indeksu | niski | Range filter działa, ale indeks przyspieszyłby |
| 7 | Reservation.deskId tight coupling | średni | Przed SPRINT E — refactor na `resourceId` (polymorphic) |
| 8 | FloorPlan — brak CDN dla obrazów | średni | Upload do local storage → trzeba S3/R2 przed SPRINT D |

---

## Matryca priorytetów

Wszystkie sprinty ocenione według wartości biznesowej (1–5) i nakładu (1–5, wyżej = więcej pracy).

| Sprint | Feature | Wartość | Nakład | ROI | Kiedy |
|--------|---------|---------|--------|-----|-------|
| **A** | UI Quick Wins (22 dni) | 5 | 2 | ⭐⭐⭐⭐⭐ | Q2 2026 |
| **B** | Subskrypcje | 5 | 2 | ⭐⭐⭐⭐⭐ | Q2 2026 |
| **C** | Grafana + CSV Export | 4 | 2 | ⭐⭐⭐⭐ | Q2 2026 |
| **D** | Floor Plan Editor | 5 | 5 | ⭐⭐⭐⭐ | Q2–Q3 2026 |
| **E** | Weekly View + Sala/Parking | 4 | 4 | ⭐⭐⭐⭐ | Q3 2026 |
| **F** | Teams + Slack + Graph | 4 | 3 | ⭐⭐⭐⭐ | Q3 2026 |
| **G** | Recurring + PWA Push | 3 | 2 | ⭐⭐⭐ | Q3 2026 |
| **H** | Mobile UX + Kiosk | 3 | 3 | ⭐⭐⭐ | Q3 2026 |
| **I** | Testy P4/P5 | 3 | 2 | ⭐⭐⭐ | Q3 2026 |
| **J** | Visitor Management | 3 | 3 | ⭐⭐⭐ | Q4 2026 |
| **K** | AI Rekomendacje | 3 | 3 | ⭐⭐⭐ | Q4 2026 |
| **L** | Public Booking + Stripe | 4 | 4 | ⭐⭐⭐⭐ | Q4 2026 |

---

## Harmonogram wydań

| Wersja | Planowana data | Co zawiera |
|--------|----------------|-----------|
| 0.11.0 | ✅ 2026-04-15 | i18n + PWA + testy 178 + OTA + powiadomienia |
| **0.12.0** | Q2 2026 maj | Sprint A (UI Quick Wins) + Sprint B (Subskrypcje) |
| **0.12.1** | Q2 2026 czerwiec | Sprint C (Grafana + CSV Export) |
| **0.13.0** | Q2–Q3 2026 | Sprint D (Floor Plan) + Sprint E (Weekly + Sala/Parking) |
| **0.13.1** | Q3 2026 | Sprint F (Teams + Slack + Graph) |
| **0.14.0** | Q3 2026 | Sprint G (Recurring + PWA Push) + Sprint H (Mobile UX) |
| **0.14.1** | Q3 2026 | Sprint I (Testy P4/P5) |
| **0.15.0** | Q4 2026 | Sprint J (Visitor Management) + Sprint K (AI Insights) |
| **0.15.1** | Q4 2026 | Dark mode + Cmd+K Search |
| **0.16.0** | Q4 2026–Q1 2027 | Sprint L (Public Booking + Stripe) |
| **1.0.0** | Q1 2027 | Self-hosted + ISO 27001 + Outlook Add-in |

---

## Szacunek łączny

| Sprint | Dni |
|--------|-----|
| A — UI Quick Wins | 22 |
| B — Subskrypcje | 6 |
| C — Grafana + Eksport | 5 |
| D — Floor Plan | 18 |
| E — Weekly + Sala | 15 |
| F — Integracje zewnętrzne | 12 |
| G — Recurring + Push | 7 |
| H — Mobile UX | 8 |
| I — Testy P4/P5 | 8 |
| J — Visitor Management | 8 |
| K — AI Rekomendacje | 8 |
| L — Public Booking | 10 |
| P3 — Self-hosted, Dark, Search | ~20 |
| **ŁĄCZNIE** | **~147 dni (~7 mcy dev)** |

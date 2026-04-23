# Dev Log — Reserti Desk Panel

Historia prac, naprawionych błędów i otwartych zadań.

---

## Zrealizowane (chronologicznie)

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

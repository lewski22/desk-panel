# Wykonane zmiany — desk-panel

> Data sesji: 2026-04-22
> Gałąź: `main`

---

## Faza 5 — Nowe funkcjonalności

### #15 — Flow rejestracji przez zaproszenie
**Backend:**
- `backend/prisma/schema.prisma` — nowy model `InvitationToken` (token, email, organizationId, role, expiresAt, usedAt) + relacja w `Organization`
- `backend/prisma/migrations/20260422000001_invitation_tokens/migration.sql` — migracja CREATE TABLE z FK → Organization ON DELETE CASCADE
- `backend/src/modules/auth/dto/invite-user.dto.ts` — walidacja email + opcjonalna rola + expiresInDays
- `backend/src/modules/auth/dto/register.dto.ts` — token + firstName + lastName + password (min 8 znaków)
- `backend/src/modules/auth/auth.service.ts` — trzy nowe metody:
  - `createInvitation()` — tworzy token, wysyła email z linkiem `/register/:token`
  - `getInvitationInfo(token)` — zwraca info o zaproszeniu (orgName, role, expired, used)
  - `completeRegistration()` — waliduje token, tworzy użytkownika (bcrypt), markuje token jako użyty
- `backend/src/modules/auth/auth.controller.ts` — trzy endpointy: `POST /auth/invite` (Admin), `GET /auth/invite/:token` (publiczny), `POST /auth/register` (publiczny, throttle 5/min)
- `backend/src/modules/auth/auth.module.ts` — import `NotificationsModule`

**Frontend:**
- `apps/unified/src/pages/RegisterPage.tsx` — strona `/register/:token`: stany loading → form/error → success; pobiera info o zaproszeniu, formularz z walidacją hasła
- `apps/unified/src/pages/UsersPage.tsx` — przycisk "Zaproś" + modal z formularzem email+rola + widok sukcesu
- `apps/unified/src/api/client.ts` — nowe metody: `auth.inviteUser()`, `auth.getInviteInfo()`, `auth.register()`
- `apps/unified/src/App.tsx` — trasa publiczna `/register/:token`
- Tłumaczenia: klucze `register.*` i `users.invite.*` w pl/en

### #17 — Kiosk — poprawki
- `apps/unified/src/pages/KioskPage.tsx`:
  - Zegar 1s w nagłówku (`HH:MM:SS + data`)
  - Kolor "zajęte" zmieniony z `text-indigo-400` na `text-red-400`
  - Grid biurek rozszerzony: `md:grid-cols-5 2xl:grid-cols-10`

### #18 — Demo mode z hardkodowanymi danymi
- `apps/unified/.env.demo` — `VITE_DEMO_MODE=true` + URL API
- `apps/unified/src/mocks/demoData.ts` — fixtures: DEMO_USER, DEMO_LOCATIONS (2), DEMO_DESKS (15), DEMO_RESERVATIONS, DEMO_STATS, DEMO_ORG
- `apps/unified/src/mocks/demoHandlers.ts` — interceptor `getDemoResponse(path, method)` dla ~15 tras (auth, locations, desks, reservations, reports, orgs, notifications…)
- `apps/unified/src/api/client.ts` — interceptor w `req()`: jeśli DEMO_MODE → sprawdź mock → zwróć z 80ms opóźnieniem (fake latency)
- `apps/unified/src/components/DemoModeBanner.tsx` — żółty sticky banner "Tryb demonstracyjny"
- `apps/unified/src/App.tsx` — auto-login DEMO_USER w useState initializer; `{DEMO_MODE && <DemoModeBanner />}`

---

## Faza 1+2 — Naprawione błędy

### #1 — MAP: Przycisk "Rezerwuj" nie działał
**Plik:** `apps/unified/src/components/desks/DeskMap.tsx`
- Dodano `onQuickBook={handleQuickBook}` do `DeskCard` w gałęzi Staff/Admin
- `DeskCard` renderuje zielony przycisk "Rezerwuj" tylko gdy `onQuickBook` jest przekazany — wcześniej nigdy nie był
- Dodano też `limits={locationLimits}` do `ReservationModal` w DeskMap

### #2 — MAP: Popup biurka — zła pozycja
**Plik:** `apps/unified/src/components/floor-plan/FloorPlanView.tsx`
- Dodano `containerRef` na kontenerze SVG
- Nowa funkcja `popupStyle()` oblicza pozycję w pikselach na podstawie `containerRef.current.clientWidth`:
  - `svgW = min(canvasW, containerWidth)` → `svgH = svgW * canvasH / canvasW`
  - Popup ustawiany w px (nie %) — eliminuje błąd z różnicą między wysokością kontenera (65vh) a renderowaną wysokością SVG
- `DeskInfoCard` przyjmuje teraz gotowy `style` jako prop zamiast obliczać go wewnętrznie

### #3 — REZERWACJE: Check-in widoczny po wykonaniu check-inu
**Plik:** `apps/unified/src/pages/MyReservationsPage.tsx`
- Po sukcesie `appApi.checkins.web()` natychmiastowy optimistic update:  
  `setReservations(rs => rs.map(r => r.id === id ? { ...r, checkedInAt: new Date().toISOString() } : r))`
- `canCheckin(r)` sprawdza `r.checkedInAt` → `return false` → przycisk znika bez czekania na reload

### #4 — DASHBOARD: Brak danych mimo check-inów
**Plik:** `apps/unified/src/api/client.ts`
- URL poprawiony: `/locations/${id}/extended` → `/locations/${id}/analytics/extended`
- Backend serwuje endpointy pod `/analytics/extended`, frontend odpytywał złą ścieżkę

### #5 — SUPER ADMIN: Wybór innej firmy przy dodawaniu biura
**Plik:** `apps/unified/src/pages/OrganizationsPage.tsx`
- Dla SUPER_ADMIN formularz tworz. biura teraz zawiera dropdown organizacji (z listy `orgs`)
- `openCreate()` dla SUPER_ADMIN ustawia `organizationId: ''` (wymaga wyboru)
- Przycisk "Utwórz" jest zablokowany dopóki SUPER_ADMIN nie wybierze org
- OFFICE_ADMIN: bez zmian — org auto-wypełniana z profilu

### #6 — MOBILE: Mapa nie znika przy zmianie zakładki
**Plik:** `apps/unified/src/components/layout/AppLayout.tsx`
- Dodano `mainRef` na elemencie `<main>`
- `useEffect` na `location.pathname` → `mainRef.current?.scrollTo({ top: 0 })` 
- Element `<main>` persystuje między routami — scroll position nie był resetowany, przez co stara treść (mapa) "wystawała" po nawigacji na mobile

### #7 — USER: Mapa jako widok domyślny
**Plik:** `apps/unified/src/pages/DeskMapPage.tsx`
- `viewMode` useState initializer: jeśli rola z localStorage to `END_USER` → zwróć `'plan'` niezależnie od zapisanej preferencji
- `useEffect` detekcji planu: dla END_USER (`isEndUser`) ignoruje zapisany klucz `desk_view_mode` i zawsze ustawia `'plan'` gdy plan istnieje

### #8 — DASHBOARD: Czytelność na telefonie
**Plik:** `apps/unified/src/pages/DashboardPage.tsx`
- Nagłówek: data w formacie długim ukryta na mobile (`hidden sm:block`); krótki format `sm:hidden` (`Śr, 22 kwi`)
- Karta KPI: padding `p-2.5` na mobile, `sm:p-4` na większych
- Strefa / Zone chart: wykres słupkowy zastąpiony na mobile prostą listą z kolorowym paskiem postępu (`hidden sm:block` / `sm:hidden`) — eliminuje problem uciętych etykiet osi Y na wąskich ekranach

### #11 — BIURO: Obsługa biur wielopiętrowych
**Plik:** `apps/unified/src/pages/FloorPlanEditorPage.tsx`
- Zakładki pięter zawsze widoczne (usunięto warunek `floors.length > 1`)
- Gdy brak pięter: wyświetlany badge "Parter/Ground floor" jako aktywna zakładka
- Dodany przycisk `+ Dodaj piętro` (border-dashed) → `window.prompt` → dodaje nowe piętro do listy (sortowanej); jeśli już istnieje → przełącza na nie
- Nowe klucze tłumaczeń: `floorplan.editor.floor_default`, `floorplan.editor.floor_prompt`, `floorplan.editor.add_floor` (pl + en)

---

## Odłożone / Zadania przyszłości

### #16 — Integracja Microsoft 365 / Outlook Calendar
Dodane do `README.md` w sekcji "Planowane". Opis zakresu technicznego:
- Graph API `POST /me/events` (tworzenie/usuwanie wydarzeń przy rezerwacji)
- Azure App Registration z delegowanymi uprawnieniami `Calendars.ReadWrite`
- Token flow: PKCE lub OBO (On-Behalf-Of)
- Pole `graphEventId` na modelu `Reservation` już istnieje w schemacie Prisma
- Wyzwania: odświeżanie tokenów per-użytkownik, obsługa TZ, edge-casy (modyfikacja po stronie Outlooka)
- Kontekst: `docs/AI_M365_CONTEXT.md`

---

## Pliki zmienione (podsumowanie)

| Plik | Zmiana |
|------|--------|
| `backend/prisma/schema.prisma` | Model InvitationToken |
| `backend/prisma/migrations/20260422000001_invitation_tokens/` | Migracja SQL |
| `backend/src/modules/auth/dto/invite-user.dto.ts` | Nowy plik |
| `backend/src/modules/auth/dto/register.dto.ts` | Nowy plik |
| `backend/src/modules/auth/auth.service.ts` | +3 metody |
| `backend/src/modules/auth/auth.controller.ts` | +3 endpointy |
| `backend/src/modules/auth/auth.module.ts` | Import NotificationsModule |
| `apps/unified/src/api/client.ts` | Demo interceptor, nowe metody auth, fix URL /extended |
| `apps/unified/src/App.tsx` | DEMO_MODE, DemoModeBanner, trasa /register/:token |
| `apps/unified/src/pages/RegisterPage.tsx` | Nowy plik |
| `apps/unified/src/pages/UsersPage.tsx` | Modal "Zaproś" |
| `apps/unified/src/pages/KioskPage.tsx` | Zegar, kolor, grid |
| `apps/unified/src/pages/DeskMapPage.tsx` | END_USER plan default, fix #1 |
| `apps/unified/src/pages/MyReservationsPage.tsx` | Optimistic check-in (#3) |
| `apps/unified/src/pages/DashboardPage.tsx` | Mobile readability (#8) |
| `apps/unified/src/pages/OrganizationsPage.tsx` | Org selector SUPER_ADMIN (#5) |
| `apps/unified/src/pages/FloorPlanEditorPage.tsx` | Add floor (#11) |
| `apps/unified/src/components/desks/DeskMap.tsx` | onQuickBook + limits (#1) |
| `apps/unified/src/components/floor-plan/FloorPlanView.tsx` | Pixel popup pos (#2) |
| `apps/unified/src/components/layout/AppLayout.tsx` | Scroll reset (#6) |
| `apps/unified/src/components/DemoModeBanner.tsx` | Nowy plik |
| `apps/unified/src/mocks/demoData.ts` | Nowy plik |
| `apps/unified/src/mocks/demoHandlers.ts` | Nowy plik |
| `apps/unified/.env.demo` | Nowy plik |
| `apps/unified/src/locales/pl/translation.json` | +register.*, +users.invite.*, +floorplan.editor.floor_* |
| `apps/unified/src/locales/en/translation.json` | j.w. EN |
| `README.md` | Sekcja #16 M365 w roadmapie |

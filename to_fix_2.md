# To Fix — Lista błędów #2

## UX / Nawigacja

1. **[USER] Mapa przed rezerwacjami** ✅ NAPRAWIONE (2026-04-23) — `App.tsx`: dla roli `END_USER` domyślna ścieżka to `/map`; dla STAFF bottom nav zaczyna się od zakładki Mapa.

2. **[MOBILE] Mapa nie znika przy zmianie zakładki** ✅ NAPRAWIONE (2026-04-23) — `ResourceFloorPlanView.tsx` (nowy komponent): renderuje zasoby (sale/parking) na planie piętra z pinami SVG + popup „Zarezerwuj". `DeskMapPage.tsx`: toggle plan/karty dla tabów rooms/parking (gdy zasoby mają pozycje); każda zakładka ma osobny widok mapy, poprzednia unmountuje się przy zmianie taba.

3. **[MAP] Popup biurka — pozycja** ✅ NAPRAWIONE (2026-04-23) — `FloorPlanView.tsx`: funkcja `popupStyle()` oblicza pozycję popup względem współrzędnych pinu na canvasie (left/right w zależności od `posX > 55`).

4. **[MAP] Przycisk "Rezerwuj" na mapie nie działa** ✅ NAPRAWIONE (2026-04-23) — `DeskMapPage.tsx`: `FloorPlanView` otrzymuje `onReserve={desk => setReservationTarget(desk)}`, co otwiera `ReservationModal`.

5. **[REZERWACJE] Check-in nadal widoczny po check-inie** ✅ NAPRAWIONE (2026-04-23) — `MyReservationsPage.tsx`: `canCheckin()` sprawdza `r.checkedInAt`; po check-in lista jest odświeżana przez `load()`.

---

## Dashboard / Raporty

6. **[DASHBOARD] Nie pokazuje informacji mimo wykonanych check-inów** ✅ NAPRAWIONE (2026-04-23) — `desks.service.ts`: `isOccupied = d.checkins.length > 0` (aktywne check-iny z DB, `checkedOutAt: null`) — obejmuje web, QR, NFC, beacon. `locations.service.ts::getAnalyticsExtended()` liczy check-iny z 30 dni → `weekData` dla wykresu. Dashboard odświeża się co 60 s.

7. **[DASHBOARD] Czytelność na telefonie (Super Admin)** ✅ NAPRAWIONE (2026-04-23) — `DashboardPage.tsx`: KpiCard — label `truncate` + `text-[10px] sm:text-xs`, sub `truncate`; wykres 7-dniowy — wrapper `min-w-[280px]` wewnątrz `overflow-x-auto`; środkowa siatka `sm:grid-cols-2` zamiast `md:grid-cols-2` (karty 2-kolumnowe już od 640 px).

8. **[RAPORTY] Kolejność — pierwszy ma być Snapshot** ✅ NAPRAWIONE — W sekcji raportów pierwszym widokiem powinien być Snapshot.

---

## Wygląd / Spójność

9. **[UI] Kolor statusu urządzeń — nieczytelny** ✅ NAPRAWIONE (2026-04-21) — Spójna paleta: `#10b981` wolne / `#f59e0b` zarezerwowane / `#ef4444` zajęte / `#a1a1aa` offline — we wszystkich komponentach (DeskPin, DeskToken, DeskCard, KioskPage, DashboardPage).

10. **[UI] Mieszanie języków PL/EN** ✅ NAPRAWIONE (2026-04-22) — 100% pokrycie i18n; zero hardkodowanych stringów PL/EN w kodzie produkcyjnym. Wszystkie klucze w `locales/pl/translation.json` i `locales/en/translation.json`.

11. **[UI] Poprawa wyglądu ogólnego** ✅ NAPRAWIONE (2026-04-22) — Ikony ujednolicone na Lucide React (`lucide-react ^0.468.0`); brand token `#B53578` w jednym miejscu.

---

## Biura / Piętra

12. **[BIURO] Obsługa biur wielopiętrowych** ✅ NAPRAWIONE (2026-04-23) — `FloorPlanEditorPage`: zakładki per piętro + przycisk „Dodaj piętro" (`window.prompt`). `FloorPlanView`: `FloorTabs` + filtrowanie biurek po `d.floor === activeFloor`. `DesksPage.tsx:244`: pole `floor` przy tworzeniu / edycji biurka. Backend: `LocationFloorPlan` (migracja `20260421000001`) + endpointy `?floor=` w `locations.controller.ts`.

---

## Błędy logiki / Uprawnienia

13. **[SUPER ADMIN] Błąd — wybór innej firmy przy dodawaniu biura** ✅ NAPRAWIONE (2026-04-23) — `OrganizationsPage.tsx`: `organizationId` pre-wypełniane własną org SA (zamiast `''`); select zastąpiony read-only etykietą z nazwą org; usunięty zbędny warunek `disabled` wymagający wyboru org.

### Bezpieczeństwo — naprawione (2026-04-21)

13a. **[SECURITY] Privilege escalation — rezerwacja dla innego użytkownika** ✅ NAPRAWIONE
- Każdy zalogowany użytkownik (w tym END_USER) mógł wysłać `targetUserId` w POST `/reservations` i zarezerwować biurko dla dowolnej osoby.
- Naprawka: `reservations.service.ts` — dodano sprawdzenie roli aktora przed użyciem `targetUserId`; `reservations.controller.ts` — przekazuje `req.user.role` do serwisu.

13b. **[SECURITY] IDOR — tworzenie lokalizacji w obcej organizacji** ✅ NAPRAWIONE
- OFFICE_ADMIN mógł wysłać `organizationId` innej firmy w POST `/locations` i tworzyć lokalizacje poza swoją organizacją.
- Naprawka: `locations.controller.ts` — dla ról niższych niż SUPER_ADMIN/OWNER `organizationId` jest nadpisywane wartością z JWT.

---

## Integracje

14. **[M365] Dwustronna synchronizacja kalendarza sal** — Przy tworzeniu sali i połączeniu konta z Microsoft 365 kalendarz powinien integrować się dwustronnie między systemem a Microsoft. Jeśli zostanie użyty system rezerwacji sal — synchronizacja powinna być trójstronna.

---

## Rejestracja / Onboarding

15. **[REJESTRACJA] Zaplanowanie flow rejestracji** ✅ NAPRAWIONE (2026-04-23) — Flow invitation-based: Admin wysyła zaproszenie z `UsersPage` → email z linkiem `/register/:token` → `RegisterPage.tsx` (firstName, lastName, hasło) → konto tworzone → redirect do logowania. Backend: `POST /auth/register` + `GET /auth/invite/:token`. Usunięto hardcoded polskie etykiety ról → `t('roles.ROLE')`.

---

## PWA / Dedykowana aplikacja

16. **[PWA] Biurka wracają do poprzedniego układu** ✅ NAPRAWIONE (2026-04-22) — `FloorPlanEditor` synchronizuje pozycje z propsów `desks`/`floor` gdy `!state.isDirty` (`useEffect` + `reset(freshPositions)`). Pierwotna przyczyna: `useReducer` initial state nie reagował na zmianę propsów.

17. **[PWA] Dedykowany link / panel dla tabletów** ✅ NAPRAWIONE (2026-04-22) — `KioskPage` (`/kiosk?location=<id>`) + przycisk „Install PWA" (`beforeinstallprompt`) w nagłówku kiosku. Opcja A (install button in-app).

---

## Demo

18. **[DEMO] Instancja demo z hardkodowanymi danymi** — Przygotować instancję demo z samym UI i hardkodowanymi danymi (bez backendu).

# To Fix — Lista błędów #2

## UX / Nawigacja

1. **[USER] Mapa przed rezerwacjami** — Na widoku użytkownika w pierwszej kolejności powinna być widoczna mapa, a nie lista już wykonanych rezerwacji.

2. **[MOBILE] Mapa nie znika przy zmianie zakładki** — Na mobile przy przechodzeniu między salami / parkingami / biurkami mapa powinna znikać. Powinny to być 3 oddzielne mapy.

3. **[MAP] Popup biurka — pozycja** — Po kliknięciu na mapie w wybrane biurko okienko wyskakuje z boku strony zamiast tuż obok wybranego biurka.

4. **[MAP] Przycisk "Rezerwuj" na mapie nie działa** — Po kliknięciu w "Rezerwuj" na mapie nie wykonuje się żadna akcja.

5. **[REZERWACJE] Check-in nadal widoczny po check-inie** — Po utworzeniu rezerwacji w web i wykonaniu check-inu, w "Moje rezerwacje" nadal jest wyświetlana opcja check-in.

---

## Dashboard / Raporty

6. **[DASHBOARD] Nie pokazuje informacji mimo wykonanych check-inów** — Dashboard nie wyświetla danych (np. zajętości), mimo że były wykonane check-iny przez użytkowników.

7. **[DASHBOARD] Czytelność na telefonie (Super Admin)** — Dashboard Super Admina wymaga poprawy czytelności na urządzeniach mobilnych.

8. **[RAPORTY] Kolejność — pierwszy ma być Snapshot** ✅ NAPRAWIONE — W sekcji raportów pierwszym widokiem powinien być Snapshot.

---

## Wygląd / Spójność

9. **[UI] Kolor statusu urządzeń — nieczytelny** ✅ NAPRAWIONE (2026-04-21) — Spójna paleta: `#10b981` wolne / `#f59e0b` zarezerwowane / `#ef4444` zajęte / `#a1a1aa` offline — we wszystkich komponentach (DeskPin, DeskToken, DeskCard, KioskPage, DashboardPage).

10. **[UI] Mieszanie języków PL/EN** ✅ NAPRAWIONE (2026-04-22) — 100% pokrycie i18n; zero hardkodowanych stringów PL/EN w kodzie produkcyjnym. Wszystkie klucze w `locales/pl/translation.json` i `locales/en/translation.json`.

11. **[UI] Poprawa wyglądu ogólnego** ✅ NAPRAWIONE (2026-04-22) — Ikony ujednolicone na Lucide React (`lucide-react ^0.468.0`); brand token `#B53578` w jednym miejscu.

---

## Biura / Piętra

12. **[BIURO] Obsługa biur wielopiętrowych** — Przy tworzeniu / edycji biura należy zaznaczyć liczbę pięter. Każde piętro powinno mieć możliwość wgrania osobnego planu piętra. Biurka z jednego piętra nie są widoczne na innym. Piętro jest definiowane na poziomie tworzenia biurka.

---

## Błędy logiki / Uprawnienia

13. **[SUPER ADMIN] Błąd — wybór innej firmy przy dodawaniu biura** — Super Admin przy dodawaniu biura ma opcję wybrania innej firmy — to błąd. Super Admin powinien móc dodawać biura tylko w ramach swojej firmy.

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

15. **[REJESTRACJA] Zaplanowanie flow rejestracji** — Formularz rejestracyjny wymaga zaprojektowania i wdrożenia pełnego flow rejestracji.

---

## PWA / Dedykowana aplikacja

16. **[PWA] Biurka wracają do poprzedniego układu** ✅ NAPRAWIONE (2026-04-22) — `FloorPlanEditor` synchronizuje pozycje z propsów `desks`/`floor` gdy `!state.isDirty` (`useEffect` + `reset(freshPositions)`). Pierwotna przyczyna: `useReducer` initial state nie reagował na zmianę propsów.

17. **[PWA] Dedykowany link / panel dla tabletów** ✅ NAPRAWIONE (2026-04-22) — `KioskPage` (`/kiosk?location=<id>`) + przycisk „Install PWA" (`beforeinstallprompt`) w nagłówku kiosku. Opcja A (install button in-app).

---

## Demo

18. **[DEMO] Instancja demo z hardkodowanymi danymi** — Przygotować instancję demo z samym UI i hardkodowanymi danymi (bez backendu).

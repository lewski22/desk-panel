# Plan poprawek — desk-panel

Stack: React 18 + Vite + TypeScript + Tailwind + React Router 6 + i18next (pl/en)

---

## Faza 1 — Błędy krytyczne / funkcjonalne (priorytet: natychmiastowy)

### 1. MAP: Przycisk "Rezerwuj" nie działa
- **Plik:** `apps/unified/src/pages/DeskMapPage.tsx` + komponenty w `components/desks/`
- **Działanie:** Zlokalizować handler onClick przycisku rezerwacji na mapie. Sprawdzić czy prop callback jest przekazywany, czy navigation/modal jest wyzwalany. Naprawić brakujące wywołanie akcji.

### 2. MAP: Popup biurka — pozycja (bок zamiast przy biurku)
- **Plik:** `apps/unified/src/components/desks/` lub `components/floor-plan/`
- **Działanie:** Zmienić pozycjonowanie popupu z `fixed`/`absolute` względem okna na `absolute` względem biurka na planie. Użyć koordynatów kliknięcia lub offsetu elementu SVG/canvas.

### 3. REZERWACJE: Check-in nadal widoczny po wykonaniu check-inu
- **Plik:** `apps/unified/src/pages/MyReservationsPage.tsx`
- **Działanie:** Sprawdzić logikę warunkowego renderowania przycisku check-in. Po wykonaniu check-inu status rezerwacji powinien zmienić się (np. `checked_in: true`) i ukryć przycisk. Sprawdzić czy API odpowiada poprawnym statusem i czy komponent odświeża stan.

### 4. DASHBOARD: Nie pokazuje danych mimo check-inów
- **Plik:** `apps/unified/src/pages/DashboardPage.tsx`
- **Działanie:** Sprawdzić wywołania API — czy endpointy zwracają dane, czy dane są mapowane na komponenty wykresu/statystyk. Sprawdzić czy problem to brak odświeżania (stale cache, brakujący useEffect dependency), czy błędne warunki renderowania (`if (!data) return null`).

### 5. SUPER ADMIN: Możliwość wybrania innej firmy przy dodawaniu biura
- **Plik:** `apps/unified/src/pages/OrganizationsPage.tsx` + formularze biura
- **Działanie:** W formularzu dodawania biura usunąć/ukryć selector firmy dla roli SUPER_ADMIN. Formularz powinien automatycznie przypisywać biuro do organizacji zalogowanego Super Admina (z tokenu/kontekstu auth).

---

## Faza 2 — Mobile / Nawigacja (priorytet: wysoki)

### 6. MOBILE: Mapa nie znika przy zmianie zakładki (sale / parkingi / biurka)
- **Plik:** `apps/unified/src/pages/DeskMapPage.tsx` + layout mobile
- **Działanie:** Przy zmianie zakładki (tabs) na mobile odmontować/ukryć komponent mapy i renderować osobną instancję mapy dla każdego typu zasobu. Trzy oddzielne mapy: biurka, sale, parkingi — nie współdzielony komponent z przełączanym stanem.

### 7. USER: Mapa jako widok domyślny (przed listą rezerwacji)
- **Plik:** `apps/unified/src/App.tsx` lub routing użytkownika
- **Działanie:** Zmienić domyślną trasę/tab dla roli END_USER tak, aby pierwszym widokiem była mapa (`DeskMapPage`), a nie `MyReservationsPage`.

### 8. DASHBOARD: Czytelność na mobile (Super Admin)
- **Pliki:** `apps/unified/src/pages/DashboardPage.tsx` + komponenty w `components/insights/`
- **Działanie:** Przegląd breakpointów Tailwind (`sm:`, `md:`). Karty statystyk — układ w kolumnie na mobile. Wykresy — zastąpić lub ukryć na małych ekranach na rzecz tabel/liczb. Dodać `overflow-x: auto` tam gdzie potrzeba.

---

## Faza 3 — Dane / Logika (priorytet: średni)

### 9. RAPORTY: Kolejność — pierwszy widok ma być Snapshot
- **Plik:** `apps/unified/src/pages/ReportsPage.tsx`
- **Działanie:** Zmienić kolejność zakładek/sekcji raportów tak, by Snapshot był pierwszy (domyślnie aktywny).

### 10. PWA: Biurka wracają do poprzedniego układu po wyjściu
- **Pliki:** `apps/unified/src/sw.ts`, `vite.config.ts` (PWA cache strategy), API zapisu pozycji biurek
- **Działanie:** Sprawdzić strategię cache Service Workera dla endpointów zapisu układu biurek. Sprawdzić czy zapis pozycji biurek trafia do API zanim PWA cache'uje stary stan. Ewentualnie: wyłączyć cache dla endpointów mutujących (`POST`/`PUT`/`PATCH` nigdy nie powinny być cache'owane).

### 11. BIURA: Obsługa wielopiętrowa
- **Pliki:** formularze biura w `components/` lub `pages/OrganizationsPage.tsx`
- **Działanie:**
  1. Dodać pole "liczba pięter" przy tworzeniu/edycji biura.
  2. Umożliwić wgranie osobnego planu dla każdego piętra.
  3. Przy tworzeniu biurka: dodać pole "piętro".
  4. Na mapie: filtrować widoczne biurka po aktualnie wybranym piętrze.
  5. Przełącznik pięter w UI mapy.

---

## Faza 4 — UX / Wygląd (priorytet: średni)

### 12. UI: Kolory statusów urządzeń — czytelność
- **Pliki:** komponenty statusów w `components/desks/` lub `components/`; globalne klasy Tailwind
- **Działanie:** Zamienić niebieski kolor statusu na bardziej kontrastowy system:
  - Dostępny → zielony (`green-500`)
  - Zajęty → czerwony (`red-500`)
  - Niedostępny → szary (`gray-400`)
  - Sprawdzić kontrast WCAG AA.

### 13. UI: Mieszanie języków PL/EN
- **Pliki:** `apps/unified/src/locales/pl/translation.json`, `apps/unified/src/locales/en/translation.json`
- **Działanie:** Audyt plików tłumaczeń — znaleźć miejsca gdzie stringi są hardkodowane w kodzie zamiast używać `t('klucz')`. Przenieść wszystkie stringi do plików i18n. Wybrać jeden język jako domyślny i uzupełnić brakujące klucze.

### 14. UI: Spójne ikony i kolory nawiązujące do logo
- **Pliki:** cała aplikacja — komponenty używające ikon
- **Działanie:** Audyt używanych zestawów ikon (sprawdzić czy to Heroicons, Lucide, FontAwesome — mieszane?). Ujednolicić jeden zestaw. Dobrać paletę kolorów z logo i zdefiniować w `tailwind.config.js` jako custom kolory (`brand-primary`, `brand-secondary` itp.).

---

## Faza 5 — Nowe funkcje / Analiza (priorytet: niższy)

### 15. REJESTRACJA: Zaprojektowanie flow rejestracji
- **Działanie:** Stworzyć diagram flow: zaproszenie → weryfikacja email → wypełnienie danych → wybór organizacji → onboarding. Określić czy rejestracja jest tylko przez zaproszenie czy otwarta. Wdrożyć kolejne kroki jako osobne strony/etapy w formularzu multi-step.

### 16. M365: Dwustronna synchronizacja kalendarza sal
- **Pliki:** `apps/teams/`, integracja MSAL
- **Działanie:** Analiza Microsoft Graph API (Calendar events). Implementacja:
  - System → M365: tworzenie eventu przy rezerwacji sali
  - M365 → System: webhook/polling dla zmian w kalendarzu
  - Trójstronna (opcjonalna): system rezerwacji jako source of truth z reconciliation

### 17. PWA: Dedykowany panel dla tabletów
- **Działanie:** Analiza opcji:
  - Opcja A: dedykowana trasa `/kiosk` z uproszczonym UI (tylko mapa + rezerwacja)
  - Opcja B: osobna PWA w `apps/kiosk/`
  - Opcja C: tryb kiosk w istniejącej PWA (query param `?mode=kiosk`)
  - Rekomendacja: Opcja A jako MVP, potem Opcja C dla elastyczności. Bez potrzeby osobnej apki.

### 18. DEMO: Instancja z hardkodowanymi danymi
- **Działanie:** Stworzyć `apps/demo/` lub tryb `VITE_DEMO_MODE=true` w istniejącej apce. Mock API przez MSW (Mock Service Worker) lub statyczne JSON fixtures. Hardkodowane dane: 1 organizacja, 2 biura, ~20 biurek, przykładowe rezerwacje i raporty.

---

## Podsumowanie priorytetów

| Faza | Błędy | Szacowany nakład |
|------|-------|-----------------|
| 1 — Krytyczne | #1 #2 #3 #4 #5 | ~3–5 dni |
| 2 — Mobile/Nav | #6 #7 #8 | ~2–3 dni |
| 3 — Dane/Logika | #9 #10 #11 | ~3–5 dni |
| 4 — UX/Wygląd | #12 #13 #14 | ~2–3 dni |
| 5 — Nowe funkcje | #15 #16 #17 #18 | ~5–10 dni |

**Łącznie: ~15–26 dni roboczych**

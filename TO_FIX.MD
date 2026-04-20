# TO_FIX — Backlog zgłoszeń pogrupowany według obszaru kodu

> Wygenerowano: 2026-04-20  
> Projekt: desk-panel (monorepo — `apps/unified` + `backend`)

---

## 1. Moduły / Organizacje

**Pliki:**
- [`apps/unified/src/components/layout/AppLayout.tsx`](apps/unified/src/components/layout/AppLayout.tsx) — logika `hasModule()`, `NAV_GROUPS`
- [`backend/src/modules/organizations/organizations.service.ts`](backend/src/modules/organizations/organizations.service.ts)

### Zgłoszenia

- [ ] **Wyłączony moduł Parking powinien zniknąć z panelu Super Admina.**  
  W `AppLayout.tsx` filtr `hasModule()` (~L134–136) filtruje elementy nav tylko gdy `item.module` jest ustawione. Pozycje bez `module` (np. `/organizations`) zawsze są widoczne. Sprawdzić, czy Parking ma poprawnie przypisany `module: 'PARKING'` i czy Super Admin nie jest wyłączony z filtrowania modułów.

- [ ] **Możliwość wyłączenia modułu Equipment.**  
  Typ `AppModule` (L25) nie zawiera `'EQUIPMENT'`. Dodać wartość do union type i obsłużyć w `organizations.service.ts` oraz `NAV_GROUPS`.

- [ ] **Ustawienie strefy czasowej dla każdego biura osobno.**  
  Model `Location` posiada pole `timezone` (użyte w `checkins.service.ts` L161). Brakuje UI do ustawiania strefy per biuro oraz propagacji do raportów.

- [ ] **Co się stanie, gdy wygaśnie konto (subskrypcja)?**  
  Zdefiniować i zaimplementować zachowanie systemu po wygaśnięciu — blokada panelu, komunikat, grace period. Sprawdzić `backend/src/modules/subscriptions/`.

---

## 2. UI / Sidebar i nawigacja

**Pliki:**
- [`apps/unified/src/components/layout/AppLayout.tsx`](apps/unified/src/components/layout/AppLayout.tsx)
- [`apps/unified/src/components/layout/BottomNav.tsx`](apps/unified/src/components/layout/BottomNav.tsx)

### Zgłoszenia

- [ ] **Poprawka UI sidebar — lepsze formatowanie i wygląd.**  
  Przeprojektować wizualnie sidebar (grupy, aktywne elementy, ikony, spacje, mobilne zwijanie).

- [ ] **STAFF — po co widzi ilość wolnych/zajętych biurek?**  
  Rozważyć usunięcie wskaźnika free/occupied z widoku STAFF lub przeniesienie do Dashboard.

- [ ] **W wersji mobile zweryfikować wszystkie odnośniki do podstron** (np. `/devices` nie prowadzi nigdzie).  
  Sprawdzić `BottomNav.tsx` oraz routing — brakujące lub niepodłączone linki na mobile.

---

## 3. Dashboard

**Pliki:**
- [`apps/unified/src/pages/DashboardPage.tsx`](apps/unified/src/pages/DashboardPage.tsx)

### Zgłoszenia

- [x] **Dashboard > przycisk „Checkin ręczny" (L129–131) przenosi do `/reservations` — zmienić nazwę.**  
  Label zmieniony na „Rezerwacje" (i18n `dashboard.qa.checkin`). *(2026-04-20)*

- [x] **Dashboard nie pokazuje danych na bieżąco.**  
  Dodano auto-refresh co 60 s (silent reload bez spinnera) + przycisk ręcznego odświeżenia z timestampem ostatniej aktualizacji. *(2026-04-20)*

- [ ] **Dane z Dashboard powinny znaleźć się w Raportach.**  
  Wyeksponować te same dane (KPI, top biurka, strefy) jako eksportowalny raport (patrz sekcja Raporty).

---

## 4. Raporty

**Pliki:**
- [`apps/unified/src/pages/ReportsPage.tsx`](apps/unified/src/pages/ReportsPage.tsx)
- [`backend/src/modules/reports/reports.service.ts`](backend/src/modules/reports/reports.service.ts)
- [`backend/src/modules/reports/reports.controller.ts`](backend/src/modules/reports/reports.controller.ts)

### Zgłoszenia

- [x] **Zakładka Raporty do przemodelowania** — dodać podzakładki z oddzielnymi raportami do pobrania (CSV/XLSX).  
  Przebudowano na 5 zakładek: Heatmapa, Rezerwacje/dzień, Metody, Per osoba, Per biurko. Eksport CSV z każdej zakładki. *(2026-04-20)*

- [x] **Nowe raporty do zaimplementowania:**  
  Dodano 4 endpointy w `reports.controller/service.ts` + odpowiadające zakładki w UI z wykresami (Recharts). *(2026-04-20)*
  - Ilość rezerwacji w dniu / tygodniu → zakładka „Rezerwacje"
  - Rezerwacje online vs rezerwacje QR → zakładka „Metody"
  - Ilość rezerwacji per osoba — tydzień / miesiąc → zakładka „Per osoba"
  - Ilość rezerwacji per biurko — tydzień / miesiąc → zakładka „Per biurko"

- [ ] **Czas w raporcie pokazuje się jako UTC zamiast UTC+2.**  
  W `reports.service.ts` brak konwersji do strefy czasowej biura przy formatowaniu dat. Użyć `timezone` z `Location` (tak jak w `checkins.service.ts` L161).

---

## 5. Rezerwacje i Check-in

**Pliki:**
- [`apps/unified/src/components/desks/DeskMap.tsx`](apps/unified/src/components/desks/DeskMap.tsx)
- [`apps/unified/src/pages/MyReservationsPage.tsx`](apps/unified/src/pages/MyReservationsPage.tsx)
- [`backend/src/modules/checkins/checkins.service.ts`](backend/src/modules/checkins/checkins.service.ts)
- [`backend/src/shared/led-events.service.ts`](backend/src/shared/led-events.service.ts)

### Zgłoszenia

- [x] **Po rezerwacji biurka nie zmienia się kolor LED na beaconie.**  
  Dodano `ledEvents.emit(deskId, 'RESERVED')` w `reservations.service.ts` po created reservation. *(2026-04-20)*

- [x] **W mapie biurek pojawia się napis „Check in" po rezerwacji, ale nic nie wykonuje.**  
  Naprawiono `handleCheckin` w `DeskMap.tsx` — przy biurku z aktywną rezerwacją wywołuje `api.checkins.manual(...)` zamiast otwierać modal rezerwacji. *(2026-04-20)*

- [x] **W „Moje rezerwacje" zweryfikować, czy można zrobić check-in przez WEB.**  
  Dodano endpoint `POST /checkins/web`, metodę `checkinWeb()` w serwisie (15 min grace window, `method: WEB`), przycisk Check-in w `MyReservationsPage.tsx`. *(2026-04-20)*

- [x] **Po poprawnym check-in nie powinno się anulować rezerwacji — tylko ją kończyć.**  
  `checkout()` i `autoCheckout()` ustawiają teraz `reservation.status = COMPLETED` w transakcji. Dodano migrację `CheckinMethod.WEB` do Prisma. *(2026-04-20)*

---

## 6. Urządzenia (Beacon / Gateway / MQTT)

**Pliki:**
- [`apps/unified/src/pages/DevicesPage.tsx`](apps/unified/src/pages/DevicesPage.tsx)
- [`backend/src/modules/devices/devices.service.ts`](backend/src/modules/devices/devices.service.ts)
- [`backend/src/modules/gateways/gateways.service.ts`](backend/src/modules/gateways/gateways.service.ts)
- [`backend/src/mqtt/`](backend/src/mqtt/)

### Zgłoszenia

- [ ] **Po chwilowym problemie z łącznością LED świeci na czerwono i nie wraca.**  
  Ustawić sensowny timeout / debounce dla zdarzeń offline — np. urządzenie musi być niedostępne przez X sekund zanim LED przejdzie na czerwony.

- [ ] **Po utracie połączenia urządzenie długo pozostaje „online" w systemie.**  
  W `devices.service.ts` (L121–122) `isOnline: true` jest ustawiane przy heartbeat, ale brak crona lub TTL który resetuje status po braku heartbeatu. Sprawdzić i uzupełnić logikę podobną do `timeoutStaleOta` (L273).

- [ ] **Do zakładki Urządzenia dodać Gateway.**  
  `DevicesPage.tsx` pokazuje tylko beacony. Zintegrować dane z `gateways.service.ts`.

- [ ] **Zakładkę Urządzenia usunąć dla Super Admina i Admina — mają Provisioning.**  
  Dostosować `roles` dla pozycji `/devices` w `NAV_GROUPS` (`AppLayout.tsx` L54).

- [ ] **Błąd w beaconie był, ale nie przyszło powiadomienie do panelu.**  
  Sprawdzić `backend/src/modules/inapp-notifications/` — czy błędy urządzeń generują powiadomienia in-app.

---

## 7. Użytkownicy i Role (RBAC)

**Pliki:**
- [`backend/src/modules/users/users.service.ts`](backend/src/modules/users/users.service.ts)
- [`backend/src/modules/users/users.controller.ts`](backend/src/modules/users/users.controller.ts)
- [`apps/unified/src/pages/UsersPage.tsx`](apps/unified/src/pages/UsersPage.tsx)

### Zgłoszenia

- [ ] **Admin (OFFICE_ADMIN) nie powinien móc wyłączyć Super Admina.**  
  W `users.service.ts` L73 jest już guard dla zmiany roli na `SUPER_ADMIN`, ale brakuje blokady dla `deactivate`/`disable` jeśli target to `SUPER_ADMIN`.

- [ ] **Admin nie może zmienić roli dla Super Admina.**  
  Uzupełnić guard w `users.service.ts` — sprawdzać rolę `target`, nie tylko `dto.role`.

- [ ] **Po dodaniu nowego użytkownika nie widać go na liście.**  
  Prawdopodobnie brak refetch / cache invalidation po `POST /users` w `UsersPage.tsx`.

---

## 8. Push Notifications

**Pliki:**
- [`apps/unified/src/components/push/PushOptIn.tsx`](apps/unified/src/components/push/PushOptIn.tsx)
- [`backend/src/modules/push/`](backend/src/modules/push/)

### Zgłoszenia

- [ ] **Włączenie PUSH — zweryfikować i uruchomić produkcyjnie.**  
  Komponent `PushOptIn` jest zaimplementowany, backend posiada moduł `push`. Sprawdzić klucze VAPID w konfiguracji środowiskowej i przetestować end-to-end (opt-in → dostarczona wiadomość push).

---

## 9. Kalendarz / „Kto jest w biurze"

**Pliki:**
- [`apps/unified/src/components/calendar/CalendarSyncSection.tsx`](apps/unified/src/components/calendar/CalendarSyncSection.tsx)
- [`apps/unified/src/pages/WeeklyViewPage.tsx`](apps/unified/src/pages/WeeklyViewPage.tsx)

### Zgłoszenia

- [ ] **„Kto jest w biurze" — zmienić nazwę zakładki / widoku.**  
  Rozważyć etykietę „Obecności", „Biuro dzisiaj" lub „Kalendarz zespołu". Zaktualizować klucze i18n.

- [ ] **Popracować nad działaniem widoku „kto jest w biurze".**  
  Zdefiniować dokładniejsze wymagania (filtrowanie po dniu, biurze, osobie) i zaimplementować.

---

## 10. Kiosk

**Pliki:**
- [`apps/unified/src/pages/KioskPage.tsx`](apps/unified/src/pages/KioskPage.tsx)

### Zgłoszenia

- [ ] **Co z wersją KIOSK?**  
  Określić status i roadmapę: czy kiosk ma być osobną aplikacją, trybem pełnoekranowym, czy PWA. Zweryfikować aktualny stan `KioskPage.tsx`.

---

## 11. Monitoring / Grafana

**Pliki:**
- [`monitoring/`](monitoring/)
- [`backend/src/metrics/`](backend/src/metrics/)

### Zgłoszenia

- [ ] **W Grafanie podgląd urządzeń bez potrzeby podawania lokalnego adresu Gateway/Beacon.**  
  Dane o urządzeniach powinny płynąć przez backend → metrics endpoint, nie przez bezpośrednie połączenie lokalne.

- [ ] **Grafana jako podgląd diagnostyczny, nie monitoring stały.**  
  Skonfigurować alerty tylko dla krytycznych zdarzeń (np. odłączenie wszystkich beaconów przy działającym Gateway). Nie alarmować przy chwilowych przerwach.

---

## 12. Testy (E2E / Integracyjne)

**Pliki:**
- [`backend/tests/`](backend/tests/)
- [`apps/unified/src/__tests__/`](apps/unified/src/__tests__/)

### Zgłoszenia

- [ ] **Testy działania panelu STAFF** — scenariusze: widok mapy, rezerwacja, check-in, brak dostępu do paneli admina.
- [ ] **Testy działania panelu User (END_USER)** — scenariusze: moje rezerwacje, check-in web, brak wrażliwych zakładek.
- [ ] **Testy funkcji Super Admin** — zarządzanie organizacjami, włączanie/wyłączanie modułów, widok provisioning.
- [ ] **Testy funkcji Admin (OFFICE_ADMIN)** — zarządzanie użytkownikami, rezerwacje, raporty, bez możliwości edycji Super Admina.

---

---

## 13. PWA / Mobile

**Pliki:**
- [`apps/unified/src/main.tsx`](apps/unified/src/main.tsx)
- [`apps/unified/src/App.tsx`](apps/unified/src/App.tsx)
- [`apps/unified/src/components/PwaBanners.tsx`](apps/unified/src/components/PwaBanners.tsx)
- [`apps/unified/vite.config.ts`](apps/unified/vite.config.ts)
- [`apps/unified/index.html`](apps/unified/index.html)
- [`apps/unified/src/index.css`](apps/unified/src/index.css)
- [`apps/unified/src/components/layout/AppLayout.tsx`](apps/unified/src/components/layout/AppLayout.tsx)
- [`apps/unified/src/components/layout/BottomNav.tsx`](apps/unified/src/components/layout/BottomNav.tsx)
- [`apps/unified/src/components/ui.tsx`](apps/unified/src/components/ui.tsx)

### Zgłoszenia

- [x] **Brak powiadomienia o dostępnej aktualizacji aplikacji.**  
  `registerSW` teraz emituje `CustomEvent('pwa:update-ready')` z `updateSW` w detail. `PwaBanners` wyświetla toast z przyciskiem „Odśwież". *(2026-04-20)*

- [x] **Brak powiadomienia o gotowości offline.**  
  `onOfflineReady` emituje `CustomEvent('pwa:offline-ready')`. `PwaBanners` wyświetla zielony toast (auto-dismiss po 4 s). *(2026-04-20)*

- [x] **Brak wskaźnika braku połączenia w UI.**  
  `PwaBanners` nasłuchuje `online`/`offline` — wyświetla amber pasek na górze ekranu. *(2026-04-20)*

- [x] **Brak przycisku „Zainstaluj aplikację" (BeforeInstallPromptEvent).**  
  `PwaBanners` przechwytuje `beforeinstallprompt`, wyświetla kartę instalacji. Odrzucenie zapisywane w `localStorage`. *(2026-04-20)*

- [x] **Brak skrótów w manifeście PWA.**  
  Dodano `shortcuts` do `vite.config.ts`: `/map` i `/my-reservations`. *(2026-04-20)*

- [x] **Spójność UI mobile/PWA z desktopem.**  
  Dodano `env(safe-area-inset-*)`, klasy `pb-nav`, `pt-safe`, `scroll-x-fade` w `index.css`. Modały jako bottom sheet na mobile. Minimum touch target 44 px (`min-h-touch`). *(2026-04-20)*

- [ ] **Brak PNG fallbacków dla ikon (starszy Android).**  
  Manifest zawiera tylko SVG. Wygenerować `icon-192.png` i `icon-512.png` i dodać do `includeAssets`.

- [ ] **Brak splash screens dla iOS.**  
  Dodać `<link rel="apple-touch-startup-image">` w `index.html` dla popularnych rozdzielczości iPhone/iPad.

- [ ] **`workbox-window` w `package.json` — nieużywane, usunąć.**  
  Paczka jest zainstalowana ale nigdy importowana — dead dependency.

---

*Plik wygenerowany na podstawie backlogu zgłoszeń — do aktualizacji po zamknięciu każdego punktu.*

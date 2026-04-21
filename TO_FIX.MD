# TO_FIX — Backlog zgłoszeń pogrupowany według obszaru kodu

> Wygenerowano: 2026-04-20  
> Projekt: desk-panel (monorepo — `apps/unified` + `backend`)

---

## 1. Moduły / Organizacje

**Pliki:**
- [`apps/unified/src/components/layout/AppLayout.tsx`](apps/unified/src/components/layout/AppLayout.tsx) — logika `hasModule()`, `NAV_GROUPS`
- [`backend/src/modules/organizations/organizations.service.ts`](backend/src/modules/organizations/organizations.service.ts)

### Zgłoszenia

- [x] **Wyłączony moduł Parking powinien zniknąć z panelu Super Admina.**  
  `useOrgModules.ts` — usunięto bypass dla SUPER_ADMIN (pozostał tylko OWNER). SA respektuje teraz `enabledModules` swojej org jak inne role. Moduł Parking znika z tab-baru mapy gdy wyłączony. *(2026-04-21)*

- [x] **Możliwość wyłączenia modułu Equipment.**  
  Dodano `'EQUIPMENT'` do `AppModule` w `useOrgModules.ts`. Dodano pozycję Equipment (`🔧 Wyposażenie`) do `MODULE_DEFS` w `OwnerPage.tsx` — Owner może teraz włączyć/wyłączyć moduł Equipment per organizacja. *(2026-04-21)*

- [x] **Ustawienie strefy czasowej dla każdego biura osobno.**  
  UI już istniało w `OrganizationsPage.tsx` — select `timezone` w modalu edycji lokalizacji (domyślnie `Europe/Warsaw`). Pole zapisywane przez `locations.service.ts::update()`. *(weryfikacja 2026-04-21)*

- [x] **Co się stanie, gdy wygaśnie konto (subskrypcja)?**  
  `App.tsx` — dodano `SubscriptionExpiredGate`: gdy `subscriptionStatus === 'expired'`, wszystkie chronione route przekierowują do `/subscription`. Dozwolone bez subskrypcji: `/subscription`, `/change-password`. Baner w `AppLayout` nadal informuje o wygaśnięciu. *(2026-04-21)*

---

## 2. UI / Sidebar i nawigacja

**Pliki:**
- [`apps/unified/src/components/layout/AppLayout.tsx`](apps/unified/src/components/layout/AppLayout.tsx)
- [`apps/unified/src/components/layout/BottomNav.tsx`](apps/unified/src/components/layout/BottomNav.tsx)

### Zgłoszenia

- [x] **Poprawka UI sidebar — lepsze formatowanie i wygląd.**  
  `AppLayout.tsx` — przeprojektowano NavItem: aktywny element używa `bg-zinc-800` (widoczny kontrast na ciemnym tle) zamiast `bg-[#B53578]/12`; `py-[7px]` → `py-2`; grupy mają `mt-3 pt-3` separator (więcej oddechu); nagłówki grup grubszą czcionką (`font-bold`); `space-y-0.5` → `space-y-px` (mniej ściśnięte); bottom sekcja — change password pokazuje ikonę nawet zwinięty; przycisk zamknięcia mobile drawer jako SVG zamiast `✕`. *(2026-04-21)*

- [x] **STAFF — po co widzi ilość wolnych/zajętych biurek?**  
  `DashboardPage.tsx` — dla ról innych niż ADMIN: usunięto `trend` prop z KPI kart (brak badge tygodniowego), ukryto sekcję "7-day trend chart", "Top biurka" i "Metody check-in". STAFF widzi: KPI bieżące (zajętość, check-iny), strefowy wykres zajętości, widget "Problemy dnia". *(2026-04-21)*

- [x] **W wersji mobile zweryfikować wszystkie odnośniki do podstron** (np. `/devices` nie prowadzi nigdzie).  
  `BottomNav.tsx` — STAFF tab zmieniony: zastąpiono `/devices` zakładką `/my-reservations` (z badge'em). Tabs STAFF: Mapa / Moje rez. / Dashboard / Rezerwacje. Urządzenia dostępne przez hamburger menu. Wszystkie linki zweryfikowane. *(2026-04-21)*

---

## 3. Dashboard

**Pliki:**
- [`apps/unified/src/pages/DashboardPage.tsx`](apps/unified/src/pages/DashboardPage.tsx)

### Zgłoszenia

- [x] **Dashboard > przycisk „Checkin ręczny" (L129–131) przenosi do `/reservations` — zmienić nazwę.**  
  Label zmieniony na „Rezerwacje" (i18n `dashboard.qa.checkin`). *(2026-04-20)*

- [x] **Dashboard nie pokazuje danych na bieżąco.**  
  Dodano auto-refresh co 60 s (silent reload bez spinnera) + przycisk ręcznego odświeżenia z timestampem ostatniej aktualizacji. *(2026-04-20)*

- [x] **Dane z Dashboard powinny znaleźć się w Raportach.**  
  Dodano zakładkę „Snapshot" (pierwsza zakładka) w `ReportsPage.tsx` — pokazuje bieżący stan na żywo (niezależny od zakresu dat): KPI per lokalizacja (biurka aktywne, zajęte teraz, zajętość %, check-iny dziś, rezerwacje dziś) + podział strefowy z progress barami + eksport CSV. Backend: `GET /reports/snapshot` w `reports.controller.ts`, `getDashboardSnapshot()` w `reports.service.ts`. i18n: `reports.tabs.snapshot` + `reports.snapshot.*`. *(2026-04-21)*

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

- [x] **Czas w raporcie pokazuje się jako UTC zamiast UTC+2.**  
  `reports.service.ts` — dodano helper `toLocalDayHour(d, tz)` używający `Intl.DateTimeFormat.formatToParts()`. `getHeatmap()` pobiera teraz timezone z Location (per wybraną lokalizację lub pierwszą w org) i przelicza godziny/dni check-inów na czas lokalny przed agregacją. *(2026-04-21)*

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

- [x] **Po chwilowym problemie z łącznością LED świeci na czerwono i nie wraca.**  
  `gateways.service.ts::deviceHeartbeat()` — przy offline→online transition metoda `_restoreDeskLed()` sprawdza aktualny stan biurka i emituje `OCCUPIED`/`RESERVED`/`FREE` via `LedEventsService`. *(2026-04-21)*

- [x] **Po utracie połączenia urządzenie długo pozostaje „online" w systemie.**  
  `scanInfrastructure()` w `inapp-notifications.service.ts` zmieniony z `*/15 min, cutoff 10 min` na `*/5 min, cutoff 5 min`. Worst case 10 min (było 25 min). *(2026-04-21)*

- [x] **Do zakładki Urządzenia dodać Gateway.**  
  `DevicesPage.tsx` przebudowana — dwie zakładki „Beacony" i „Gateways". Gateway tab pokazuje: status, nazwa, lokalizacja, IP, wersja, liczba beaconów, ostatni kontakt. *(2026-04-21)*

- [x] **Zakładkę Urządzenia usunąć dla Super Admina i Admina — mają Provisioning.**  
  `AppLayout.tsx` — pozycja `/devices` zmieniona z `['SUPER_ADMIN','OFFICE_ADMIN','STAFF']` na `['STAFF']`. *(2026-04-21)*

- [x] **Błąd w beaconie był, ale nie przyszło powiadomienie do panelu.**  
  `devices.service.ts::timeoutStaleOta()` — po timeout OTA tworzy `InAppNotifType.FIRMWARE_UPDATE` per urządzenie z deduplication 60 min. `triggerOtaAll()` — tworzy notification gdy komenda OTA nie dotarła do gateway. `DevicesModule` importuje `InAppNotificationsModule`. *(2026-04-21)*

---

## 7. Użytkownicy i Role (RBAC)

**Pliki:**
- [`backend/src/modules/users/users.service.ts`](backend/src/modules/users/users.service.ts)
- [`backend/src/modules/users/users.controller.ts`](backend/src/modules/users/users.controller.ts)
- [`apps/unified/src/pages/UsersPage.tsx`](apps/unified/src/pages/UsersPage.tsx)

### Zgłoszenia

- [x] **Admin (OFFICE_ADMIN) nie powinien móc wyłączyć Super Admina.**  
  `users.service.ts::softDelete()` — dodano parametr `actorRole`; jeśli target to SA i actor nie jest SA → `ForbiddenException`. Controller przekazuje `req.user.role`. UI ukrywa przycisk Deactivate dla SA gdy actor to OFFICE_ADMIN. *(2026-04-21)*

- [x] **Admin nie może zmienić roli dla Super Admina.**  
  `users.service.ts::update()` — sprawdza rolę targetu: jeśli target jest SA i actor nie jest SA → `ForbiddenException`. Dodatkowo select roli w modalu edycji jest `disabled` dla SA gdy actor to OFFICE_ADMIN. *(2026-04-21)*

- [x] **Po dodaniu nowego użytkownika nie widać go na liście.**  
  `UsersPage.tsx` — `load(silent = false)`: gdy `silent=true` nie ustawia stanu loading (brak pełnoekranowego spinnera). Po create/edit/deactivate/restore/hardDelete wywołuje `load(true)` — lista odświeża się w tle bez migania. *(2026-04-21)*

---

## 8. Push Notifications

**Pliki:**
- [`apps/unified/src/components/push/PushOptIn.tsx`](apps/unified/src/components/push/PushOptIn.tsx)
- [`backend/src/modules/push/`](backend/src/modules/push/)

### Zgłoszenia

- [x] **Włączenie PUSH — zweryfikować i uruchomić produkcyjnie.**  
  Audyt: SW nie miał push handlera; `notifyUser()` nigdy nie było wywoływane. Naprawiono: *(2026-04-21)*
  - `src/sw.ts` — nowy custom Service Worker z `push` + `notificationclick` handlerami (pure Cache API, bez workbox)
  - `vite.config.ts` — przełączono na `strategies: 'injectManifest'`
  - `push.controller.ts` — dodano `POST /push/test-send` do weryfikacji end-to-end
  - `reservations.service.ts` — `notifyUser()` wywoływane po create (booker) i cancel przez admina (booker)
  - `reservations.module.ts` — importuje `PushModule`
  - `backend/.env.example` — instrukcja generowania kluczy VAPID (`npx web-push generate-vapid-keys`)

---

## 9. Kalendarz / „Kto jest w biurze"

**Pliki:**
- [`apps/unified/src/components/calendar/CalendarSyncSection.tsx`](apps/unified/src/components/calendar/CalendarSyncSection.tsx)
- [`apps/unified/src/pages/WeeklyViewPage.tsx`](apps/unified/src/pages/WeeklyViewPage.tsx)

### Zgłoszenia

- [x] **„Kto jest w biurze" — zmienić nazwę zakładki / widoku.**  
  Zakładka przemianowana na „Obecności" (pl) / „Attendance" (en). Tytuł strony: „Obecności biurowe" / „Team Attendance". *(2026-04-21)*

- [x] **Popracować nad działaniem widoku „kto jest w biurze".**  
  `WeeklyViewPage.tsx` — dodano: *(2026-04-21)*
  - Kliknięcie w nagłówek dnia (tabela desktop) filtruje dane do wybranego dnia + podświetla kolumnę
  - Filtry statusu gdy dzień wybrany: Wszyscy / W biurze / Z rezerwacją
  - KPI pod nagłówkiem pokazuje dane wybranego dnia (nie tylko dziś)
  - Przycisk "Wyczyść filtr" resetuje wybór dnia i statusu
  - Mobile: widok automatycznie pokazuje wybrany dzień

---

## 10. Kiosk

**Pliki:**
- [`apps/unified/src/pages/KioskPage.tsx`](apps/unified/src/pages/KioskPage.tsx)

### Zgłoszenia

- [x] **Co z wersją KIOSK?**  
  Status: kiosk to dedykowany route `/kiosk?location=<id>` w głównej aplikacji PWA (fullscreen mode, nie osobna apka). *(2026-04-21)*  
  Naprawione w `KioskPage.tsx`:
  - PIN przeniesiony z URL (`?pin=`) → weryfikowany na backendzie przez `POST /locations/:id/kiosk/verify-pin` (publiczny endpoint bez JWT)
  - Dodano `kiosk.controller.ts` + `verifyKioskPin()` w `locations.service.ts`
  - Wszystkie hardcoded polskie stringi przeniesione do i18n (`kiosk.status.*`, `kiosk.total`, `kiosk.default_*`)
  - Dodano ekran błędu gdy `?location=` jest pusty (zamiast nieskończonego spinnera)

---

## 11. Monitoring / Grafana

**Pliki:**
- [`monitoring/`](monitoring/)
- [`backend/src/metrics/`](backend/src/metrics/)

### Zgłoszenia

- [x] **W Grafanie podgląd urządzeń bez potrzeby podawania lokalnego adresu Gateway/Beacon.**  
  `metrics.service.ts` — dodano `refreshDeviceMetrics()` (cron co 60s): wypełnia gaugi `clientBeaconLastSeen`, `clientBeaconRssi`, `clientGatewayLastSeen`, `clientGatewayVersionInfo` danymi z bazy. `refreshOwnerMetrics()` (cron co 30s) — globalne liczniki org/gateway/beacons. Prometheus scrape'uje tylko backend. Usunięto bezpośredni scrape gateway z `prometheus.yml`. *(2026-04-21)*

- [x] **Grafana jako podgląd diagnostyczny, nie monitoring stały.**  
  Dodano `monitoring/grafana/provisioning/alerting/alerts.yml` — 3 reguły krytyczne z `for: 5m`/`10m`: (1) wszystkie beacony offline przy żywym gateway, (2) gateway offline > 10 min, (3) backend API niedostępny > 3 min. Brak alertów dla pojedynczych, chwilowych przerw. *(2026-04-21)*

---

## 12. Testy (E2E / Integracyjne)

**Pliki:**
- [`backend/tests/`](backend/tests/)
- [`apps/unified/src/__tests__/`](apps/unified/src/__tests__/)

### Zgłoszenia

- [x] **Testy działania panelu STAFF** — scenariusze: widok mapy, rezerwacja, check-in, brak dostępu do paneli admina.  
  `staff-rbac.spec.ts` — STAFF nie ma dostępu do `/organizations`, `/provisioning`, `/users`; nie widzi sekcji Top biurka / Metody w dashboardzie; ma dostęp do mapy, moje-rezerwacje, dashboard. *(2026-04-21)*

- [x] **Testy działania panelu User (END_USER)** — scenariusze: moje rezerwacje, check-in web, brak wrażliwych zakładek.  
  `end-user.spec.ts` — END_USER ma dostęp do dashboard + moje-rezerwacje; nie ma dostępu do `/users`, `/organizations`, `/provisioning`, `/reports`; check-in web endpoint weryfikowany; nav bez linków admina. *(2026-04-21)*

- [x] **Testy funkcji Super Admin** — zarządzanie organizacjami, włączanie/wyłączanie modułów, widok provisioning.  
  `super-admin.spec.ts` — SA ma dostęp do `/organizations`, `/provisioning`, `/reports`; lista org widoczna; modal edycji org zawiera sekcję modułów; provisioning shows devices. *(2026-04-21)*

- [x] **Testy funkcji Admin (OFFICE_ADMIN)** — zarządzanie użytkownikami, rezerwacje, raporty, bez możliwości edycji Super Admina.  
  `office-admin.spec.ts` — OA ma dostęp do `/users`, `/reports`, `/reservations`; nie ma przycisku Deactivate przy SA; brak dostępu do `/organizations`, `/provisioning`. Auth setup dla 4 ról w `auth.setup.ts`. Playwright config z projektami per rola. *(2026-04-21)*

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

- [x] **Brak PNG fallbacków dla ikon (starszy Android).**  
  `vite.config.ts` — manifest dodaje `icon-192.png` i `icon-512.png` przed SVG jako primary ikony (Android Chrome wymaga PNG). `includeAssets` rozszerzony o PNG i `apple-touch-icon.png`. Skrypt `scripts/generate-icons.mjs` generuje PNG z SVG używając `sharp` (`npm run generate-icons`). *(2026-04-21)*

- [x] **Brak splash screens dla iOS.**  
  `index.html` — dodano 7 tagów `<link rel="apple-touch-startup-image">` dla najpopularniejszych rozmiarów iPhone/iPad (od SE po 15 Pro Max + iPad Pro). Splash screeny generowane skryptem `generate-icons.mjs` → `public/splash/`. `apple-touch-icon` zmieniony na PNG (iOS ignoruje SVG). *(2026-04-21)*

- [x] **`workbox-window` w `package.json` — nieużywane, usunąć.**  
  Usunięto `workbox-window` z `devDependencies`. Dodano `sharp` (do generowania PNG ikon). *(2026-04-21)*

---

*Plik wygenerowany na podstawie backlogu zgłoszeń — do aktualizacji po zamknięciu każdego punktu.*

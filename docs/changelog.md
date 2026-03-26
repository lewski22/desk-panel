# Changelog — Reserti Desk Management System

Format: `[wersja] — data — opis`

---

## [0.4.0] — 2026-03-26 — QR check-in, godziny biura, uprawnienia

### Nowe funkcje

**QR Check-in (mobilny)**
- Strona `/checkin/:token` w Staff Panelu — dostępna bez logowania (auto-redirect do login z returnTo)
- Scenariusz walk-in: wolne biurko → rezerwacja + check-in w jednej transakcji
- Scenariusz rezerwacja: moja rezerwacja → potwierdzenie check-inem
- Scenariusz zajęte: komunikat "zajęte przez kogoś innego" + link do mapy
- Po zalogowaniu: automatyczny powrót na stronę QR (fix `returnTo`)

**Godziny pracy biura**
- Nowe pola `Location.openTime` / `Location.closeTime` (domyślnie 08:00–17:00)
- Super Admin: Biura → ⏰ Godziny — edycja per lokalizacja
- Walk-in kończy się o `closeTime`, nie o 23:59
- Walk-in po godzinach pracy: zablokowany (HTTP 400)
- Walk-in gdy ktoś ma rezerwację → kończy się 5 min przed nią

**Generator QR kodów**
- Admin Panel → Biurka → przycisk "QR" przy każdym biurku
- Podgląd kodu QR (api.qrserver.com)
- Kopiuj URL / Drukuj QR (okno drukowania z layoutem do naklejki)

**Czas i metoda check-inu na rezerwacji**
- Nowe pola `Reservation.checkedInAt` + `Reservation.checkedInMethod`
- Zapisywane przy każdym check-inie: NFC, QR, MANUAL
- Widoczne w tabeli Admin Panel → Rezerwacje
- Widoczne w tabeli Staff Panel → Rezerwacje

**Rozbudowany Dashboard (Admin)**
- Wykres słupkowy: check-iny ostatnie 7 dni z trendem tygodniowym
- Heatmapa godzinowa: rozkład check-inów (godziny 6–20)
- Strefowy wykres poziomy: zajęte/zarezerwowane/wolne per strefa
- Top 5 biurek z progress barami (ostatnie 30 dni)
- Pie chart: podział NFC / QR / Ręczny
- Siatka biurek z kolorami statusów

### Poprawki

**Odparuj beacon**
- Admin Panel → Biurka: przycisk "Odparuj" zastąpił niewidoczny `✕`
- Admin Panel → Provisioning: przycisk "Odparuj" zastąpił emoji `⇄`
- Oba przyciski: potwierdzenie z nazwą urządzenia + obsługa błędów
- Backend fix: `devices.findAll` teraz zwraca `desk.id` (było tylko `name`, `code`)

**Uprawnienia END_USER w Staff Panelu**
- Zakładka "Urządzenia" ukryta (dostęp: STAFF i wyżej)
- Rezerwacje: END_USER widzi tylko własne (filtr `?userId=` w API)
- Mapa biurek: END_USER widzi tylko wolne biurka (tytuł "Wolne biurka")

**Akcje w tabeli Rezerwacji (Admin)**
- Przyciski "Check-in" i "Anuluj" — zawsze widoczne (usunięto `opacity-0 group-hover`)
- Kolumna Check-in: czas (HH:mm) + metoda (📡/📱/✋) + checkout

**QR flow po logowaniu**
- `LoginPage` ignorował `state.returnTo` — zawsze redirectował na `/`
- Naprawiono: `useLocation()` + `navigate(returnTo, {replace:true})`
- `api.auth.login` zwraca `{...user, accessToken}` — token dostępny poza hookami

### Optymalizacje wydajności (code review)

| Plik | Problem | Naprawiono |
|---|---|---|
| `locations.service` | 7 osobnych DB queries w `getAnalyticsExtended` | 1 query + agregacja JS |
| `locations.service` | `findMany` + filter w `getOccupancyAnalytics` | 4× `count()` równolegle |
| `devices.service` | 2 DB write'y na heartbeat | 1 write (merged) |
| `devices.service` | `Math.random()` do haseł | `crypto.randomBytes` |
| `gateways.service` | `Math.random()` do secretów | `crypto.randomBytes` |
| `users.service` | `findOne()` przed `update()` | usunięte (Prisma throws P2025) |
| `AdminLayout` | `mousemove` → `setTimeout` setki razy/s | debounce 500ms |
| `DashboardPage` | 3 API calls (occupancy redundant) | 2 API calls |
| `DashboardPage` | `useMemo` po `if (loading) return` | przeniesione przed return |
| `DashboardPage` | `totalDesks` undefined | usunięte, `desks.length` |
| `UsersPage` | `myRole()` w module-level function | `useMemo` w komponencie |
| `staff/hooks` | `const fetch` shadowing global `fetch` | przemianowane |

---

## [0.3.0] — 2026-03-25 — Admin Panel v2, Gateway deploy

### Nowe funkcje

**Admin Panel — zarządzanie użytkownikami**
- Zakładki: Aktywni / Dezaktywowani
- Edycja użytkowników (imię, email, rola)
- Dezaktywacja z wyborem okresu retencji (min. 30 dni)
- Przywracanie kont (zakładka Dezaktywowani → Przywróć)
- Anonimizacja po upływie retencji (zachowanie aktywności)
- Super Admin: tylko SUPER_ADMIN może nadać rolę SUPER_ADMIN

**Admin Panel — zarządzanie biurkami**
- Edycja biurek (nazwa, kod, piętro, strefa)
- Reaktywacja biurek INACTIVE
- Odpięcie beacona

**Admin Panel — Gateway**
- Widoczne ID (skrócone) i firmware version
- Regeneracja secretu (🔑) z podglądem pierwszych 8 znaków
- Usuwanie gateway i beaconów

**Provisioning**
- Odparowanie beacona od biurka
- Usuwanie beacona

**Session timeout**
- Automatyczne wylogowanie po 5 minutach braku aktywności
- Ostrzeżenie 60 sekund przed końcem z przyciskiem "Przedłuż"

**Gateway — Coolify deploy**
- `Dockerfile` w root repo dla Coolify
- Jednoetapowy setup: `scripts/setup.sh`

**Organizacje → Biura**
- Zmieniona nazwa w panelu i nawigacji
- Dodana edycja istniejących

### Dokumentacja

- `docs/roles.md` — pełna dokumentacja ról (END_USER, STAFF, OFFICE_ADMIN, SUPER_ADMIN)
- `docs/roadmap.md` — moduł M365 (SSO, Teams App, Outlook Add-in, Graph Sync)
- `docs/deployment.md` — pełna instrukcja Proxmox + Coolify + Cloudflare

---

## [0.2.0] — 2026-03-24 — Produkcyjny deploy

### Nowe funkcje

- Deploy na Proxmox LXC + Coolify + Cloudflare Tunnel
- `https://api.prohalw2026.ovh/api/docs` — Swagger UI
- `https://admin.prohalw2026.ovh` — Admin Panel
- `https://staff.prohalw2026.ovh` — Staff Panel
- Seed bazy danych (4 konta testowe, biurka, lokalizacja)

---

## [0.1.0] — 2026-03-23 — Initial commit

- Backend NestJS + Prisma + PostgreSQL
- MQTT bridge (Mosquitto)
- Admin Panel React (biurka, rezerwacje, użytkownicy, provisioning)
- Staff Panel React (mapa zajętości)
- Firmware ESP32 (NFC + LED + offline queue)
- Gateway Node.js (MQTT bridge + SQLite cache)

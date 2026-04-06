# Roadmap — Reserti Desk Management System

> Ostatnia aktualizacja: 2026-04-07

---

## Stan aktualny (v0.10.0 — 2026-04-07)

### ✅ Zrealizowane (produkcja)

**Infrastruktura**
- Deploy: Coolify na Proxmox LXC + Cloudflare Tunnel
- PostgreSQL 15 + Mosquitto MQTT + Docker

**Backend (NestJS + Prisma)**
- JWT auth (15min access / 7d refresh) + rotacja tokenów
- Multi-tenant: Organization → Location → Desk
- Role: OWNER, SUPER_ADMIN, OFFICE_ADMIN, STAFF, END_USER
- Rate limiting (`@nestjs/throttler`)
- Entra ID SSO (M1) — Azure JWKS validation
- MQTT bridge (MqttService + MqttHandlers)
- LED Event Bus (LedEventsService — rxjs Subject, zero circular dep)
- Gateway provisioning — jednorazowe tokeny instalacji (24h)
- Device provisioning — MQTT credentials generowane per beacon
- Rezerwacje — weryfikacja konfliktów, QR tokeny, cancel z LED FREE
- Check-in: NFC (przez gateway), QR (walkin + z rezerwacją), ręczny
- Checkout — zamyka checkin + LED FREE
- Cron: wygasanie starych rezerwacji co 15min
- Owner panel — impersonacja, stats, health per org

**Unified Panel (React)**
- Jedna aplikacja dla wszystkich ról (SUPER_ADMIN/OFFICE_ADMIN/STAFF/END_USER)
- Responsywność mobile — hamburger sidebar drawer, tabele zwijane
- Mapa biurek — WSZYSTKIE aktywne biurka widoczne (zajęte też rezerwowalne)
- ReservationModal — dla END_USER (bez ID) i Staff/Admin (dropdown pracownika)
- QrCheckinPage — walkin + checkin z rezerwacji + redirect po logowaniu
- Provisioning: tokeny gateway, beacony, reassign, REBOOT/IDENTIFY
- Trwałe usuwanie biurek (2-etap: dezaktywuj → usuń trwale)
- Session warning (timeout 5min, ostrzeżenie 1min)
- Date utils: `localDateStr()`, `localDateTimeISO()` — lokalna strefa, nie UTC

**Gateway Python (Raspberry Pi)**
- Cache offline (SQLite) — działa bez internetu
- SyncService — synchronizacja rezerwacji co 60s
- DeviceMonitor — wykrywa offline beacony (> 90s bez heartbeat)
- MqttAdmin — dynamiczne zarządzanie użytkownikami Mosquitto
- install.sh — automatyczna instalacja + systemd service
- Obsługa NFC (DENIED/OCCUPIED LED < 15ms) + QR scan

**Firmware ESP32**
- WiFi + MQTT (TLS ready) + NFC (PN532) + LED (WS2812B 12-ring)
- Offline queue (NVS) — buforuje eventy NFC gdy MQTT offline
- TTL 1h — stale eventy pominięte przy flush (nie powodują błędnych OCCUPIED)
- Komendy: SET_LED, REBOOT, IDENTIFY, FACTORY_RESET, SET_DESK_ID, LED_TEST
- Provisioning: Serial Monitor `PROVISION:{...}` z desk_id

---

## P1 — Pilne (< 2 tygodnie)

### 1. Location.timezone — strefa czasowa per biuro

**Problem:** Wszystko w UTC. Biuro w Nowym Jorku (UTC-4) widzi godziny przesunięte.

**Zmiany:**
- Prisma: `Location.timezone String @default("Europe/Warsaw")` (IANA)
- SUPER_ADMIN: edycja timezone (select z listą IANA zones)
- Backend: konwersja dat przez `date-fns-tz` lub `luxon`
- Frontend: `Intl.DateTimeFormat` z `timeZone: location.timezone`
- Gateway: `LOCATION_TZ` env var

**Szacunek:** 3-4 dni

---

### 2. QR LED backup przez gateway

**Problem:** Gdy backend MQTT nie może publishować (rozłączenie), LED nie reaguje na QR check-in.

**Rozwiązanie:** Po QR check-in przez HTTP, backend wysyła także REST call do gateway API `POST /led/{deskId}` → gateway publishuje lokalnie przez Mosquitto.

**Szacunek:** 1 dzień

---

## P2 — Ten miesiąc

### 3. OTA aktualizacje gateway

**Problem:** Aktualizacja gateway = SSH na Pi i ręczna zmiana pliku.

**Rozwiązanie:**
- Endpoint `PATCH /gateway/:id/update` w backendzie
- Gateway API `POST /update` — pobiera nową wersję z GitHub raw i restartuje service
- Przycisk "Aktualizuj" w Provisioning page

**Szacunek:** 1 dzień

---

### 4. OTA aktualizacje firmware beacon

**Problem:** Flash beacona = kabel USB + PlatformIO ręcznie.

**Rozwiązanie:**
- Backend endpoint `GET /firmware/latest` — zwraca URL binarki i wersję
- Beacon sprawdza `fw_version` przy heartbeat z backendem
- Jeśli jest nowsza wersja → pobiera binkę przez HTTP OTA
- Storage dla binarek (S3 lub GitHub Releases)

**Szacunek:** 3-4 dni

---

### 5. Auto-przypisywanie kart NFC

**Problem:** Admin musi ręcznie wpisać UID karty. Wolne i podatne na błędy.

**Planowany flow:**
1. Admin: Users → "Przypisz kartę NFC" przy userze
2. Panel: "Zbliż kartę do dowolnego beacona w biurze (60s)"
3. Backend: otwiera sesję 60s nasłuchiwania `UNAUTHORIZED_SCAN`
4. Beacon skanuje → `card_unknown` event → backend zapisuje UID do usera
5. Panel polling `GET /users/:id/nfc-assign-status` co 2s → sukces

**Szacunek:** 2-3 dni

---

### 6. Moduł maksymalnego okresu rezerwacji

**Problem:** User może zarezerwować biurko na miesiąc do przodu bez limitu.

**Planowane:**
- `Location.maxDaysAhead` (np. 7) — max N dni do przodu
- `Location.maxHoursPerDay` (np. 8) — max długość pojedynczej rezerwacji
- Walidacja w `reservations.service.create()`
- Info na mapie: "Wolne do 15:55 (następna rezerwacja od 16:00)"
- Blokada w ReservationModal przy przekroczeniu

**Szacunek:** 2 dni

---

### 7. Przełączanie Prisma migrate (zamiast db push)

**Problem:** `prisma db push --accept-data-loss` niszczy dane przy niezgodności schematu.

**Rozwiązanie:** Przejście na `prisma migrate deploy` w Dockerfile CMD.
Każda zmiana schematu musi mieć migrację (`prisma migrate dev`).

**Szacunek:** 0.5 dnia

---

## P3 — Roadmapa daleka

### 8. Rotacja kluczy gateway

**Opis:** Nowy endpoint `POST /gateway/:id/rotate-secret`. Przez 15min akceptuje stary i nowy klucz (okno migracji). Gateway pobiera nowy klucz przez swój `/rotate-secret` endpoint.

---

### 9. M2 — Microsoft Teams App

**Opis:** Aplikacja Teams do rezerwacji biurek bezpośrednio z Teams (zakładka, personal app).

---

### 10. M4 — Microsoft Graph Sync

**Opis:** Synchronizacja rezerwacji z kalendarzem Outlook (dwukierunkowa).

---

### 11. Metryki SRE

**Opis:** `provisioning_success_total`, `beacon_uptime`, `checkin_latency_ms`, dashboard SRE.

---

### 12. Minimalny dashboard SRE

**Opis:** Online gatewaye, provisioning error rate, czas ostatniego sync per gateway.

---

## Znane bugs / tech debt

| Bug | Priorytet | Opis |
|-----|-----------|------|
| Beacon timestamp bez RTC | niski | `millis()/1000` reset przy restarcie — TTL queue niedokładne |
| `prisma db push` w produkcji | średni | Powinno być `migrate deploy` |
| Session warning na mobile | niski | `inset-x-2` nie testowane na wszystkich urządzeniach |
| `date @db.Date` filtr | niski | Naprawione range filter, ale warto dodać indeks |
| Entra ID SSO — STAFF/END_USER | niski | Aktualnie tylko OFFICE_ADMIN może logować przez SSO |

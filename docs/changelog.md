# Changelog — Reserti Desk Management System

Format: `[wersja] — data — opis`

---

## [0.10.1] — 2026-04-07 — Code review fixes

### Bugs naprawione

**#1 NFC check-in LED — zły broker MQTT**
- `mqtt.handlers.ts`: `handleCheckin()` używał `mqtt.sendLedCommand()` (Docker Mosquitto, izolowany)
- Zamieniono na `ledEvents.emit()` — ta sama ścieżka co QR: LedEventsService → gateway HTTP → Pi Mosquitto → beacon

**#2 Checkout bez weryfikacji właściciela**
- `checkout(id, actorId, actorRole)` — END_USER nie może zamknąć cudzej sesji
- STAFF / ADMIN może checkout dowolne biurko

**#3 GET /reservations bez @Roles**
- `GET /` i `GET /:id` chronione przez `@Roles(STAFF+)`
- END_USER nie ma dostępu do listy cudzych rezerwacji

**#4 sync/heartbeat gateway bez autentykacji**
- `POST /:id/sync` i `POST /:id/heartbeat` — wymagają `x-gateway-secret` (bcrypt compare z DB)
- `PATCH /device/:id/heartbeat` — wymaga `x-gateway-provision-key`
- gateway.py: dodano nagłówki do `_forward_device_heartbeat` i `_notify_backend_offline`

### Refaktoryzacja (dead code)

- Usunięto: `markOffline()`, `getCommandTarget()` z `DevicesService`
- Usunięto: `sendLedCommand()`, `notifyUser()`, `broadcast()` z `MqttService`
- Usunięto: `TOPICS` import z `devices.controller.ts` i `devices.service.ts`
- Usunięto: `MqttService` z `DevicesController` i `DevicesModule`
- Usunięto: osierocone typy z `topics.ts`

### Jakość kodu

**#9 closeTime — strefa czasowa per biuro**
- `endOfWorkInTz(closeTime, timezone, now)` — pure TypeScript, `Intl.DateTimeFormat`, bez bibliotek
- `walkinQr()` używa `Location.timezone` (IANA, np. `Europe/Warsaw`) zamiast `setHours()` (UTC serwera)
- Poprawne zachowanie dla biur w strefie innej niż serwer

**#10 manual() bez weryfikacji organizacji**
- `manual(deskId, userId, reservationId, actorOrgId?)` — STAFF nie może checkin w obcej org
- Kontroler przekazuje `req.user.organizationId`

**#11 Duplikacja HTTP gateway**
- `GatewaysService.addBeaconCredentials()` — nowa ujednolicona metoda dla `/beacon/add`
- `DevicesService._notifyGateway()` usunięta (40 linii duplikatu)
- `ConfigService` usunięty z `DevicesService`

**#12 now vs now2**
- `checkinNfc()` — usunięto `now2 = new Date()` tworzone 200ms po `now`
- Transakcja używa `now` z początku metody

**#13 SendCommandDto bez walidacji**
- `@IsIn(['REBOOT', 'IDENTIFY', 'SET_LED'])` — backend odrzuca nieznane komendy
- `@ApiProperty({ enum })` dla Swagger

---

## [0.10.0] — 2026-04-07 — Bugfixes, LED event bus, responsywność

### Naprawione błędy

**LED po QR check-in**
- `LedEventsService` (rxjs Subject) jako event bus zamiast circular dependency
- `CheckinsService` / `ReservationsService` emitują zdarzenie LED
- `MqttHandlers` subskrybuje i publishuje do Mosquitto
- Dependency graph: ZERO circular (SharedModule @Global)

**Strefa czasowa (+2h offset)**
- `utils/date.ts`: `localDateStr()` i `localDateTimeISO()`
- ReservationModal: `.000Z` → `new Date('T...').toISOString()` (czas lokalny)
- Backend: date filter `exact match` → range `gte/lt` w `findAll()`
- MyReservationsPage: `new Date(r.date)` → `r.date.slice(0,10)+'T12:00:00'`

**Mapa biurek END_USER**
- `getCurrentStatus` zwraca `status: d.status` (poprzednio pole brakowało)
- Filter END_USER: tylko `status === 'ACTIVE'` (zajęte też widoczne i rezerwowalne)
- `qrToken` dodany do `select` w getCurrentStatus reservations include
- Okno czasowe `currentReservation`: usunięto limit 30min → `endTime >= now`

**Anulowanie rezerwacji**
- `cancel()` zamyka otwarty Checkin (`checkedOutAt = now`)
- `cancel()` emituje `LED_FREE` → beacon zmienia kolor na zielony

**Beacon FREE→OCCUPIED po restarcie**
- `flushOfflineQueue()`: TTL 1h — eventy starsze niż godzinę pomijane
- Eliminuje fałszywe OCCUPIED po restarcie beacona z kolejką NVS

**Duplikaty rezerwacji**
- Usunięto `prisma.reservation.create()` z seed (był nie-idempotentny)
- Seed teraz w pełni idempotentny (tylko upsert)

**Przyciski Restart/Identyfikuj**
- `DevicesController.command()` → `getCommandTarget()` + `mqtt.publish()`
- Działa dla beaconów bez biurka (`desk//command`)

**Provisioning — desk_id pusty**
- PROVISION command: `"desk_id":"${result.device?.deskId}"` (nie hardcoded pusty)

**QR sesja po logowaniu**
- `LoginPage` obsługuje `state.returnTo` → wraca do QR checkin po zalogowaniu

### Nowe funkcje

**Mapa biurek — ReservationModal unified**
- Jeden modal dla END_USER (bez ID) i Staff/Admin (dropdown pracownika + opcjonalnie)
- Hint: "Możesz przyjść o 8:00 i zarezerwować od 14:00"
- Staff/Admin: `targetUserId` w DTO — rezerwacja dla innego pracownika

**Reassign beacona**
- `openAssignModal()` ładuje desks dla lokalizacji gateway tego beacona
- Guzik "Przypisz" w tabeli beaconów w ProvisioningPage

**Trwałe usuwanie biurka**
- `DELETE /desks/:id/permanent` (tylko INACTIVE)
- Przycisk "Usuń trwale" obok "Reaktywuj" z 2-etapowym potwierdzeniem

**Responsywność mobile**
- AppLayout: hamburger + overlay sidebar drawer (`md:hidden`)
- Tabele: `hideOnMobile` prop na TD/Table headers
- DeskCard: prop `hideActions` — brak przycisków Check-in dla END_USER
- Session warning: pełna szerokość na mobile

**END_USER — dostęp do mapy**
- `GET /locations` — dodano STAFF + END_USER do `@Roles`
- `GET /locations/:id/desks/status` — wszystkie role

---

## [0.9.0] — 2026-04-01 — Unified Panel + zmiana hasła

### Nowe funkcje
- Unified Panel (`apps/unified/`) — scalenie Admin + Staff + Owner + Outlook w jednej aplikacji
- `MyReservationsPage` — aktywne + historyczne rezerwacje per zalogowany user
- `ChangePasswordPage` — link "Zmień hasło" w stopce sidebara
- `DeskMapPage` — picker biura z API (nie VITE_LOCATION_ID)
- Owner panel — impersonacja SUPER_ADMIN, stats, health per org
- Outlook Add-in (M3) — check-in z Microsoft Outlook

---

## [0.8.0] — 2026-03-31 — Gateway Python + provisioning UX

### Nowe funkcje
- `desk-gateway-python` — pełny przepis Python: Cache, SyncService, MqttBridge, DeviceMonitor
- Gateway provisioning przez tokeny jednorazowe (24h)
- InstallController — bash script z tokenem i API URL
- DeviceMonitor — wykrywa stale beacony + notuje backend `isOnline=false`
- Panel: `+ Gateway` → `InstallTokenModal` → komenda curl do wklejenia

# Changelog — Reserti Desk Management System

Format: `[wersja] — data — opis`

---

## [0.11.0] — 2026-04-15 — i18n + PWA + Testy + OTA + Notyfikacje

### Nowe funkcje

**Internacjonalizacja (i18n) — PL/EN**
- 427 kluczy tłumaczeń (PL i EN, pełna paryteta)
- `useTranslation()` we wszystkich 28 plikach `.tsx` (100% pokrycie)
- Dynamiczny locale dla `date-fns` i `toLocaleDateString` (`pl-PL`/`en-GB`)
- `LanguageSwitcher` komponent w headerze
- 0 `alert()` w kodzie produkcyjnym — wszystko zamienione na inline error state

**Progressive Web App (PWA)**
- `vite-plugin-pwa` — manifest, service worker, auto-update
- Skróty: `/map` (Mapa biurek), `/my-reservations` (Rezerwacje)
- Workbox: `NetworkFirst` dla `/api/`, `CacheFirst` dla fontów
- Ikony SVG 192×192 i 512×512 z brandem Reserti
- Meta tagi iOS (`apple-mobile-web-app-capable`, `viewport-fit=cover`)

**OTA aktualizacje firmware beacon (4 fazy)**
- GitHub Actions CI — build `.bin` i upload do GitHub Releases przy tagu `v*`
- `GET /firmware/latest` — pobiera wersję i URL z GitHub Releases API
- `POST /devices/:id/ota` — wysyła `OTA_UPDATE` przez gateway → beacon, org isolation
- `POST /devices/ota-all` — bulk OTA dla wszystkich biurek w lokalizacji (5s throttle)
- `otaStatus` tracking: `null | in_progress | success | failed`
- `timeoutStaleOta()` cron — failuje OTA >10 min bez potwierdzenia
- `OtaBadge` komponent — pulsujące wskaźniki statusu w ProvisioningPage
- Firmware ESP32: handler `OTA_UPDATE`, HTTP OTA, żółty LED podczas pobierania

**Powiadomienia email (8 typów)**
- Per-organizacja konfiguracja SMTP (`OrganizationSmtpConfig`, AES-256-GCM)
- Fallback na globalny SMTP z env
- Typy: gateway offline/online, beacon offline, firmware update, check-in missed,
  rotacja klucza, ogłoszenia systemowe, powiadomienia testowe
- Deduplikacja (24h cooldown per typ+org)
- `POST /notifications/settings/test` — test wysyłki

**Powiadomienia in-app (dzwoneczek)**
- `InAppNotification` model — polling co 15s, badge z liczbą nieprzeczytanych
- `NotificationBell` komponent — dropdown z listą, markAllRead
- Reguły per rola (`NotificationRule`) — OWNER konfiguruje kto widzi co
- `POST /notifications/inapp/announce` — ogłoszenie systemowe do wybranych ról
- 7 typów eventów: GATEWAY_OFFLINE, GATEWAY_BACK_ONLINE, BEACON_OFFLINE,
  FIRMWARE_UPDATE, GATEWAY_RESET_NEEDED, RESERVATION_CHECKIN_MISSED, SYSTEM_ANNOUNCEMENT

**Testy jednostkowe i integracyjne (178 testów)**
- P1 — Backend service specs (64 testy): reservations.service, checkins.service, devices.service
- P2 — Gateway Python (63 testy): test_cache, test_command_handler, test_handle_status, test_provisioning
- P3 — Kontrolery + auth (51 testów): auth.service, reservations.controller, devices.controller

### Fixes

- `getQrToken()` — walidacja właściciela rezerwacji
- `autoCheckout()` — stale walkin > 12h automatyczny checkout
- `DeskCard` — `getDeskConfig(desk, t)` z przekazaniem `t` jako argument
- `TableEmpty` helper component z `t('table.empty')`
- `GatewaySection` — `gwErr` state zamiast `alert()` (4 miejsca)
- `OwnerPage` — `setErr()` zamiast `alert()` w handleImpersonate/Deactivate/Activate

---

## [0.10.1] — 2026-04-07 — Code review fixes + security

### Bugs naprawione

- **#1 NFC check-in LED** — `ledEvents.emit()` zamiast `mqtt.sendLedCommand()` (zły broker)
- **#2 Checkout bez auth** — `checkout(id, actorId, actorRole)` weryfikacja właściciela
- **#3 GET /reservations bez @Roles** — `@Roles(STAFF+)` na GET / i GET /:id
- **#4 Gateway sync bez auth** — `x-gateway-secret` + `x-gateway-provision-key`

### Refaktoryzacja

- Usunięto dead code: `markOffline()`, `getCommandTarget()`, `sendLedCommand()`, `notifyUser()`, `broadcast()`
- `GatewaysService.addBeaconCredentials()` — ujednolicona metoda
- `endOfWorkInTz()` — pure TypeScript Intl, bez bibliotek zewnętrznych
- `SendCommandDto` — `@IsIn(['REBOOT','IDENTIFY','SET_LED'])` walidacja

---

## [0.10.0] — 2026-04-07 — LED event bus + responsywność mobile

### Naprawione błędy

- LED po QR check-in (LedEventsService rxjs Subject — zero circular dep)
- Strefa czasowa +2h (localDateStr + localDateTimeISO)
- Mapa biurek END_USER (getCurrentStatus, filter ACTIVE)
- Anulowanie rezerwacji → LED FREE + zamknięcie Checkin
- Beacon FREE→OCCUPIED po restarcie (TTL 1h w NVS queue)
- Duplikaty w seed (upsert idempotentny)

### Nowe funkcje

- ReservationModal unified (END_USER bez ID + Staff dropdown)
- Reassign beacon do biurka z panelu
- Trwałe usuwanie biurka (2-etap: dezaktywuj → usuń trwale)
- AppLayout: hamburger sidebar drawer mobile
- Session warning (5min timeout, ostrzeżenie 1min przed)

---

## [0.9.0] — 2026-04-01 — Unified Panel

- `apps/unified/` — scalenie wszystkich ról w jednej aplikacji
- MyReservationsPage — aktywne + historyczne rezerwacje
- ChangePasswordPage (z paskiem siły hasła)
- DeskMapPage — picker biura z API
- Owner Panel — impersonacja, stats per org

---

## [0.8.0] — 2026-03-31 — Gateway Python + provisioning

- `desk-gateway-python` — Cache, SyncService, MqttBridge, DeviceMonitor, MqttAdmin
- Gateway provisioning: tokeny jednorazowe (24h) + InstallController + bash script
- Panel: `+ Gateway` → `InstallTokenModal` → komenda curl

---

## [0.7.0] — 2026-03-15 — Entra ID SSO (M1)

- Azure JWKS validation (`jwks-rsa` + `jsonwebtoken`)
- JIT provisioning: nowy user z `azureObjectId` + `passwordHash = 'AZURE_SSO_ONLY'`
- `AzureConfigModal` — SUPER_ADMIN konfiguruje Tenant ID per org
- `GET /auth/azure/check` — public endpoint sprawdzający czy org ma SSO (20/min)

---

## [0.6.0] — 2026-03-01 — Owner Panel

- `OwnerModule` — CRUD organizacji, impersonacja (JWT 30min), stats
- `OwnerHealthService` — globalHealth, orgHealth (stale/offline kryterium 5/10min)
- `OWNER` enum w UserRole (najwyższy poziom hierarchii)
- `OWNER_IMPERSONATION` EventType (audit trail)

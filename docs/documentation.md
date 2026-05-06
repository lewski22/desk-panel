# Dokumentacja modułów — Reserti Backend

> **Wersja:** v0.17.0 | **Stack:** NestJS 11 + Prisma 5 + PostgreSQL 15  
> Przewodnik dla deweloperów — gdzie szukać konkretnej logiki i jak moduły współpracują.  
> Szczegóły architektury IoT → `architecture.md` | API + wzorce kodu → `ai-context.md` | Strefy czasowe → `timezones.md`

---

## Spis treści

1. [Mapa zależności modułów](#1-mapa-zależności-modułów)
2. [Moduły infrastrukturalne](#2-moduły-infrastrukturalne)
3. [Moduły domenowe — rdzeń](#3-moduły-domenowe--rdzeń)
4. [Moduły integracji zewnętrznych](#4-moduły-integracji-zewnętrznych)
5. [Moduły analityczne](#5-moduły-analityczne)
6. [Moduły platformowe (OWNER)](#6-moduły-platformowe-owner)
7. [Modele danych — gdzie co szukać](#7-modele-danych--gdzie-co-szukać)
8. [Przepływy między modułami](#8-przepływy-między-modułami)
9. [Cron jobs — co, gdzie, kiedy](#9-cron-jobs--co-gdzie-kiedy)
10. [Gdzie dodać nową funkcję](#10-gdzie-dodać-nową-funkcję)

---

## 1. Mapa zależności modułów

```
┌─────────────────────────────────────────────────────────────────┐
│  INFRASTRUKTURA (@Global — dostępna wszędzie bez importu)        │
│  DatabaseModule → PrismaService                                  │
│  SharedModule   → LedEventsService, NfcScanService              │
│  IntegrationsModule → IntegrationCryptoService, providers       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ wstrzykiwane przez NestJS DI
┌──────────────────────────▼──────────────────────────────────────┐
│  RDZEŃ BIZNESOWY                                                 │
│                                                                  │
│  AuthModule ──────────────────────────────────────────────────┐ │
│  UsersModule ─────────────────────────────────────────────┐   │ │
│  OrganizationsModule ───────────────────────────────────┐ │   │ │
│  LocationsModule → WifiCryptoService, R2Service         │ │   │ │
│  DesksModule     → LedEventsService                     │ │   │ │
│  DevicesModule   → GatewaysService, WifiCryptoService   │ │   │ │
│  GatewaysModule  → MqttModule, LedEventsService         │ │   │ │
│                                                         │ │   │ │
│  ReservationsModule → LedEventsService                  │ │   │ │
│                     → NotificationsModule               │ │   │ │
│                     → IntegrationEventService           │ │   │ │
│                     → GraphService (outlook sync)       │ │   │ │
│                     → PushService                       │ │   │ │
│                                                         │ │   │ │
│  CheckinsModule  → LedEventsService                     │ │   │ │
│                  → NfcScanService                       │ │   │ │
│                  → IntegrationEventService              │ │   │ │
└─────────────────────────────────────────────────────────┘─┘───┘─┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  INTEGRACJE ZEWNĘTRZNE                                           │
│  IntegrationsModule  → Slack, Teams, Webhook, Azure, Google      │
│  GraphSyncModule     → Microsoft Graph API (Calendar + Entra)    │
│  TeamsBotModule      → Azure Bot Framework v4                    │
│  NotificationsModule → MailerService (SMTP per org + global)     │
│  PushModule          → Web Push VAPID                            │
└─────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  PLATFORMA / ANALITYKA                                           │
│  OwnerModule         → OrganizationsModule, impersonacja         │
│  SubscriptionsModule → NotificationsModule, InAppModule          │
│  ReportsModule       → PrismaService (direct queries)            │
│  InsightsModule      → PrismaService (cron aggregation)          │
│  RecommendationsModule → PrismaService (history scoring)         │
│  VisitorsModule      → MailerService                             │
│  ResourcesModule     → PrismaService                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Moduły infrastrukturalne

### DatabaseModule
**Ścieżka:** `src/database/`  
**Zakres:** `@Global` — dostępny wszędzie bez importowania modułu

| Plik | Rola |
|------|------|
| `prisma.service.ts` | Rozszerza PrismaClient; zarządza połączeniem (connect/disconnect) |
| `db.module.ts` | Rejestruje PrismaService jako provider globalny |
| `seeds/seed.ts` | Dane startowe: konto OWNER, demo-org, biurka testowe |

**Użycie:** Wstrzyknij `PrismaService` w constructor dowolnego serwisu. Wszystkie operacje DB przechodzą przez Prisma — brak surowego SQL.

---

### SharedModule
**Ścieżka:** `src/shared/`  
**Zakres:** `@Global`

| Plik | Rola |
|------|------|
| `led-events.service.ts` | RxJS Subject — event bus dla zmiany stanu LED biurek |
| `nfc-scan.service.ts` | Jednorazowe sesje oczekiwania na skan karty NFC (przypisywanie kart użytkownikom) |

**LedEventsService** — kluczowy element architektury bez circular dependency:
```
CheckinsService / ReservationsService
  → ledEvents.emit(deskId, 'OCCUPIED')
    → GatewaysService subskrybuje events$
      → MQTT → beacon → LED zmiana koloru
```

**NfcScanService** — używany tylko w `UsersModule` do jednorazowej sesji przypisania karty NFC do konta użytkownika.

---

### MqttModule
**Ścieżka:** `src/mqtt/`

| Plik | Rola |
|------|------|
| `mqtt.service.ts` | Klient MQTT; trwałe połączenie z Mosquitto (auto-reconnect co 5s) |
| `mqtt.module.ts` | Moduł + eksport MqttService |
| `mqtt.handlers.ts` | Subskrybuje topiki, deleguje do GatewaysService i CheckinsService |
| `topics.ts` | Stałe nazw topików MQTT |

**Subskrybowane topiki:**

| Topik | Handler | Co robi |
|-------|---------|---------|
| `desk/+/checkin` | `handleCheckin()` | Skan NFC z beacona → CheckinsService.checkinNfc() |
| `desk/+/status` | `handleStatus()` | Heartbeat biurka → GatewaysService.updateDeviceStatus() |
| `gateway/+/hello` | `handleHello()` | Rejestracja nowej bramki |

**Publishowane topiki:**
- `desk/{deskId}/led` — komenda koloru LED → beacon

---

### MetricsModule
**Ścieżka:** `src/metrics/`

| Plik | Rola |
|------|------|
| `metrics.service.ts` | Cron co 30s — odświeża liczniki Prometheus |
| `metrics.controller.ts` | `GET /metrics` — endpoint dla Prometheusa |
| `metrics.registry.ts` | Definicje metryk (histogramy, countery, gauges) |
| `http-metrics.interceptor.ts` | Globalny interceptor — mierzy czas każdego HTTP requesta |

**Dostęp:** Endpoint `/metrics` jest poza `/api/v1` i może być chroniony przez `METRICS_ALLOWED_IPS`.

---

### IntegrationsModule
**Ścieżka:** `src/modules/integrations/`  
**Zakres:** `@Global` — dostawca konfiguracji integracji dla całej aplikacji

| Plik | Rola |
|------|------|
| `integrations.service.ts` | CRUD konfiguracji integracji; szyfrowanie AES-256-GCM |
| `integration-crypto.service.ts` | AES-256-GCM encrypt/decrypt/encryptJson/decryptJson |
| `integration-event.service.ts` | Dispatcher eventów do wszystkich aktywnych providerów (fire-and-forget) |
| `providers/slack.provider.ts` | Slack Bot API (chat.postMessage) |
| `providers/teams.provider.ts` | Teams Incoming Webhook + Adaptive Cards |
| `providers/webhook.provider.ts` | Custom webhook z HMAC-SHA256 + retry (3×, exponential backoff) |
| `providers/azure.provider.ts` | Weryfikacja konfiguracji Azure Entra per org |
| `providers/google.provider.ts` | Weryfikacja konfiguracji Google Workspace SSO per org |
| `types/integration-config.types.ts` | Typy konfiguracji dla każdego providera |

**Jak dodać nową integrację:**
1. Dodaj nowy provider w `IntegrationProvider` enum (schema.prisma)
2. Dodaj typ konfiguracji w `integration-config.types.ts`
3. Stwórz plik `providers/nazwa.provider.ts`
4. Zarejestruj w `integrations.module.ts`
5. Dodaj `onNazwaEvent()` w `integration-event.service.ts`

---

## 3. Moduły domenowe — rdzeń

### AuthModule
**Ścieżka:** `src/modules/auth/`

| Plik | Rola |
|------|------|
| `auth.service.ts` | Logowanie, JWT, refresh rotacja, zaproszenia, zmiana hasła |
| `azure-auth.service.ts` | SSO Microsoft Entra ID (JWKS, JIT provisioning) |
| `google-auth.service.ts` | SSO Google Workspace (OAuth2 PKCE, JIT provisioning) |
| `nonce-store.service.ts` | CSRF nonce dla Google OAuth (Redis lub in-memory fallback) |
| `auth.controller.ts` | Endpointy: login, refresh, logout, invite, register, Azure, Google |
| `strategies/jwt.strategy.ts` | Passport JWT — ekstrahuje z cookie lub Bearer |
| `strategies/local.strategy.ts` | Passport Local — email+hasło |
| `guards/jwt-auth.guard.ts` | Wymaga ważnego JWT |
| `guards/roles.guard.ts` | Weryfikuje role z `@Roles()` (OWNER bypass) |
| `decorators/roles.decorator.ts` | `@Roles(UserRole.ADMIN, ...)` |

**Przepływ JWT:**
```
POST /auth/login → validateUser() → login()
  → access_token (15min) + refresh_token (7d)
  → oba jako httpOnly cookie
  → refresh_token zapisany w tabeli RefreshToken

POST /auth/refresh → refresh()
  → walidacja w DB → delete stary → create nowy
  → nowa para tokenów

DELETE /auth/logout → logout()
  → delete RefreshToken z DB → clearCookies()
```

**JIT Provisioning SSO** — wspólna metoda `provisionSsoUser()` w `auth.service.ts`:
- Szuka użytkownika po email lub ssoId
- Jeśli nie istnieje — tworzy z rolą `END_USER`
- Jeśli istnieje — aktualizuje ssoId jeśli brakuje

---

### UsersModule
**Ścieżka:** `src/modules/users/`

| Plik | Rola |
|------|------|
| `users.service.ts` | CRUD użytkowników, org isolation, soft-delete, karta NFC |
| `users.controller.ts` | REST endpoints z `@Roles()` per endpoint |

**Org isolation:** Każda operacja filtrowana przez `organizationId` aktora z JWT. SUPER_ADMIN widzi tylko swoją org. OWNER widzi wszystkie.

**Soft-delete:** `deletedAt` + `scheduledDeleteAt` + `retentionDays`. Cron w `SubscriptionsModule` fizycznie usuwa dane po upływie retention.

**Przypisanie karty NFC:** `POST /users/:id/nfc-scan` → startSession w `NfcScanService` → następny skan z bramki trafia do sesji zamiast tworzyć check-in.

---

### LocationsModule
**Ścieżka:** `src/modules/locations/`

| Plik | Rola |
|------|------|
| `locations.service.ts` | CRUD lokalizacji, kiosk PIN (bcrypt), WiFi (AES-256-GCM), plany pięter |
| `locations.controller.ts` | REST endpoints, floor plan upload, attendance stats |
| `kiosk.controller.ts` | `POST /locations/:id/kiosk/verify-pin` — publiczny, bez JWT |

**Kiosk PIN:** Hashowany bcrypt(10) przed zapisem. Weryfikacja przez `bcrypt.compare()`. Plaintext nigdy nie trafia do bazy.

**WiFi:** Szyfrowane przez `WifiCryptoService` (AES-256-GCM, klucz `WIFI_ENCRYPTION_KEY`). Kolumny: `wifiSsidEnc`, `wifiPassEnc`.

**Plany pięter:** Przechowywane w Cloudflare R2 (jeśli `R2_ACCOUNT_ID` ustawiony) lub jako base64 w DB (tryb awaryjny). Model `LocationFloorPlan` obsługuje wiele pięter per lokalizacja.

---

### DesksModule
**Ścieżka:** `src/modules/desks/`

| Plik | Rola |
|------|------|
| `desks.service.ts` | CRUD biurek, aktualny status, pozycje na planie piętra |
| `desks.controller.ts` | REST + dostępność w zakresie dat + rekomendacja AI |

**Aktualny status biurka** (`getCurrentStatus()`):
```
Sprawdza równolegle:
  1. Aktywny Checkin bez checkedOutAt → OCCUPIED
  2. Aktywna Reservation w bieżącym oknie czasowym → RESERVED / GUEST_RESERVED
  3. Brak → FREE
```

**Pozycje na planie piętra:** `batchUpdatePositions()` — jedno wywołanie aktualizuje X/Y/rotation/width/height wielu biurek naraz (drag-and-drop w edytorze planu).

**Org guard:** `assertDeskInOrg(deskId, actorOrgId)` — weryfikuje łańcuch `Desk → Location → Organization` przed każdą operacją.

---

### DevicesModule
**Ścieżka:** `src/modules/devices/`

| Plik | Rola |
|------|------|
| `devices.service.ts` | Provisioning beaconów, OTA, heartbeat, online/offline tracking |
| `devices.controller.ts` | REST + komendy do beacona + status OTA |

**Provisioning beacona:**
```
POST /devices/provision (z bramki, x-gateway-secret)
  → upsert Device po hardwareId
  → generuj MQTT credentials (username + bcrypt hasło)
  → odczytaj WiFi lokalizacji (WifiCryptoService.decrypt)
  → zwróć { mqttUsername, mqttPassword, wifiSsid, wifiPass, deskId }
  → hasło zwracane jednorazowo, potem tylko hash w DB
```

**OTA flow:**
```
GET /devices/firmware/latest → GitHub Releases API
POST /devices/:id/ota → sendBeaconCommand('OTA_UPDATE', { url, version })
  → device.otaStatus = 'in_progress'
  → beacon pobiera .bin, restartuje
  → heartbeat z { version: newVersion } → otaStatus = 'success'
Cron: timeout po 10min → 'failed'
```

---

### GatewaysModule
**Ścieżka:** `src/modules/gateways/`

| Plik | Rola |
|------|------|
| `gateways.service.ts` | Rejestracja bramek, autentykacja, heartbeat, LED commands |
| `gateway-setup.service.ts` | Jednorazowe tokeny instalacyjne (TTL 24h) |
| `gateways.controller.ts` | REST endpoints dla bramek i adminów |
| `install.controller.ts` | `GET /install/gateway/:token` — bash skrypt instalacyjny |

**Instalacja bramki:**
```
Admin: POST /gateway/setup-tokens → token (randomBytes(32), TTL 24h)
Pi: curl .../install/gateway/{token} | bash
  → skrypt pobiera config (consumeToken)
  → rejestruje się w GatewaysService.register()
  → otrzymuje secretHash (bcrypt), dalej używa sekretu w nagłówku
```

**Autentykacja bramki:** Każde żądanie z bramki zawiera `x-gateway-id` + `x-gateway-secret`. Backend weryfikuje przez `bcrypt.compare()`.

**LED commands:** `GatewaysService` subskrybuje `LedEventsService.events$` i dla każdego eventu wysyła komendę `SET_LED` przez MQTT do odpowiedniej bramki.

---

### ReservationsModule
**Ścieżka:** `src/modules/reservations/`

| Plik | Rola |
|------|------|
| `reservations.service.ts` | Cały cykl życia rezerwacji |
| `reservations.controller.ts` | REST + moje rezerwacje + rezerwacje cykliczne |
| `dto/create-reservation.dto.ts` | Jednorazowa rezerwacja |
| `dto/create-recurring.dto.ts` | Cykliczna (iCalendar RRULE) |
| `dto/cancel-recurring.dto.ts` | Anulowanie całej serii lub od daty |

**Tworzenie rezerwacji:**
```
create(actorId, dto, actorOrgId):
  1. Walidacja limitów org (maxDaysAhead, maxHoursPerDay)
  2. Sprawdzenie konfliktu (overlap na tym samym biurku)
  3. prisma.reservation.create()
  4. ledEvents.emit(deskId, 'RESERVED')
  5. notifications.sendReservationConfirmation() ← email
  6. push.notifyUser() ← web push (jeśli subskrybuje)
  7. integrationEvents.onReservationCreated() ← Slack/Teams/Webhook (fire-and-forget)
  8. graphService.createCalendarEvent() ← Outlook (jeśli połączony)
```

**Rezerwacje cykliczne:** RRULE (np. `FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10`) ekspandowany przez `_expandRRule()`. Każde wystąpienie to osobny rekord w DB z `recurrenceGroupId`.

**CRON co minutę:** Sprawdza rezerwacje których `startTime` właśnie nadszedł → `ledEvents.emit(deskId, 'RESERVED')`. Po `endTime` → `ledEvents.emit(deskId, 'FREE')`.

---

### CheckinsModule
**Ścieżka:** `src/modules/checkins/`

| Plik | Rola |
|------|------|
| `checkins.service.ts` | Wszystkie metody check-in/checkout |
| `checkins.controller.ts` | REST + NFC (z bramki) + QR (z frontendu) + manual |

**Metody check-in:**

| Metoda | Wyzwalacz | Ścieżka |
|--------|-----------|---------|
| `checkinNfc()` | Beacon skanuje kartę | Gateway → MQTT → MqttHandlers → CheckinsService |
| `checkinQr()` | Użytkownik skanuje QR biurka | Frontend → POST /checkins/qr |
| `walkinQr()` | QR bez uprzedniej rezerwacji | Frontend → POST /checkins/qr/walkin |
| `manual()` | STAFF klika w panelu | Frontend → POST /checkins/manual |
| `checkout()` | Dowolna metoda | PATCH /checkins/:id/checkout |

**Po każdym check-in:** `ledEvents.emit(deskId, 'OCCUPIED')` → `integrationEvents.onCheckin()` (fire-and-forget)

**CRON co 5 minut:** `autoCheckout()` — szuka rezerwacji z `endTime < now` i aktywnym check-inem → `checkout()`.

---

## 4. Moduły integracji zewnętrznych

### NotificationsModule
**Ścieżka:** `src/modules/notifications/`

| Plik | Rola |
|------|------|
| `notifications.service.ts` | Alerty email dla adminów, reguły powiadamiania |
| `mailer.service.ts` | Transporter SMTP (org-specific → global fallback) |
| `smtp-crypto.ts` | AES-256-GCM dla haseł SMTP (klucz `SMTP_ENCRYPTION_KEY`) |
| `notification-types.ts` | Typy i szablony powiadomień |

**Hierarchia SMTP:**
```
1. Własny SMTP org (OrganizationSmtpConfig, lazy init z cache)
2. Globalny SMTP z env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
3. Brak SMTP → log warn, graceful skip
```

**Wysłanie emaila z dowolnego serwisu:**
```typescript
await this.mailer.send({ to, subject, html }, organizationId);
// organizationId → preferuje SMTP org, fallback do globalnego
```

---

### InAppNotificationsModule
**Ścieżka:** `src/modules/inapp-notifications/`

| Plik | Rola |
|------|------|
| `inapp-notifications.service.ts` | CRUD powiadomień w aplikacji (dzwonek w panelu) |
| `inapp-notifications.controller.ts` | REST: lista, przeczytaj, przeczytaj wszystkie, usuń |

**Deduplikacja:** Klucz `dedupeKey` (np. `gateway_offline:${gatewayId}`) zapobiega wielokrotnym identycznym powiadomieniom w krótkim czasie.

**Typy powiadomień (`InAppNotifType`):** `GATEWAY_OFFLINE`, `GATEWAY_BACK_ONLINE`, `BEACON_OFFLINE`, `FIRMWARE_UPDATE`, `RESERVATION_CHECKIN_MISSED`, `SUBSCRIPTION_EXPIRING`, `SUBSCRIPTION_EXPIRED`, `TRIAL_EXPIRING`, `LIMIT_WARNING`, `SYSTEM_ANNOUNCEMENT`.

---

### PushModule
**Ścieżka:** `src/modules/push/`

| Plik | Rola |
|------|------|
| `push.service.ts` | Subskrypcje Web Push + wysyłka do konkretnego użytkownika |
| `push.controller.ts` | REST: subscribe, unsubscribe, klucz publiczny VAPID |

**Wymagane env:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Bez nich powiadomienia są pomijane z logiem warn (graceful degradation).

**Auto-cleanup:** Subskrypcje z odpowiedzią 404/410 (przeglądarka odwołała zgodę) są automatycznie usuwane z DB po nieudanej próbie wysyłki.

---

### GraphSyncModule (M4)
**Ścieżka:** `src/modules/graph-sync/`

| Plik | Rola |
|------|------|
| `graph.service.ts` | Microsoft Graph API — Calendar sync, webhook subscription |
| `graph.controller.ts` | OAuth redirect/callback + webhook endpoint + status |

**Przepływ synchronizacji:**
```
Użytkownik autoryzuje: GET /auth/graph/redirect
  → Microsoft OAuth2 → GET /auth/graph/callback
  → tokens szyfrowane AES-256-GCM → GraphToken w DB

Rezerwacja w Reserti → createCalendarEvent()
  → POST Graph API /me/events → graphEventId w Reservation

Zmiana w Outlooku → POST /graph/webhook (clientState validated per subscription)
  → GraphService.handleNotifications()
  → Sync Reservation w Reserti

CRON co 24h: renewSubscriptions()
  → Graph subscriptions wygasają po max 3 dobach → odnawiaj przed wygaśnięciem
```

**Bezpieczeństwo webhook:** Każda subskrypcja ma unikalny `clientState` (randomBytes(16)). Każda notyfikacja jest walidowana przez porównanie `clientState` z DB.

---

### TeamsBotModule
**Ścieżka:** `src/modules/teams-bot/`

| Plik | Rola |
|------|------|
| `teams-bot.service.ts` | Azure Bot Framework v4 — obsługa wiadomości i Messaging Extensions |
| `teams-bot-cards.ts` | Generatory Adaptive Cards (helpCard, bookingFormCard, reservationsCard) |

**Obsługiwane komendy (wiadomość bezpośrednia):**
- `book` — formularz rezerwacji biurka (task module)
- `reservations` / `moje` — lista nadchodzących rezerwacji
- `cancel <id>` — anuluj rezerwację
- `help` — lista dostępnych komend

---

## 5. Moduły analityczne

### ReportsModule
**Ścieżka:** `src/modules/reports/`

| Plik | Rola |
|------|------|
| `reports.service.ts` | Heatmapy, wskaźniki zajętości, eksport XLSX |
| `reports.controller.ts` | `GET /reports/heatmap`, `GET /reports/export` |

**Dostępne raporty:**
- **Heatmap:** Macierz zajętości (dzień tygodnia × godzina) — które godziny są najbardziej obciążone
- **Dzienny wskaźnik:** Zajętość per lokalizacja per dzień w zakresie dat
- **Eksport XLSX:** Pełne dane z uwzględnieniem dni wolnych (biblioteka `date-holidays`)

**Org scoping:** OFFICE_ADMIN widzi tylko swoją org. SUPER_ADMIN może podać dowolne `organizationId`.

---

### InsightsModule (K2)
**Ścieżka:** `src/modules/insights/`

| Plik | Rola |
|------|------|
| `insights.service.ts` | Agregacja danych, template engine, cron cache |
| `insights.controller.ts` | `GET /insights?locationId=` |

**Działanie:** Cron generuje przegląd zajętości per lokalizacja (ostatnie 30 dni) i zapisuje wynik jako JSON w `UtilizationInsight`. Endpoint odczytuje cache — bez obciążenia DB przy każdym zapytaniu.

**Typy insightów:** Wskaźnik zajętości, najbardziej zajęte godziny, trendy tygodniowe, biurka nigdy nieużywane.

---

### RecommendationsModule (K1)
**Ścieżka:** `src/modules/recommendations/`

| Plik | Rola |
|------|------|
| `recommendations.service.ts` | Scoring biurek na podstawie historii użytkownika |

**Algorytm scoringu** (suma wag = 100):

| Kryterium | Waga | Opis |
|-----------|------|------|
| To samo biurko | 50 | Użytkownik rezerwował to biurko najczęściej |
| Ta sama strefa | 25 | Biurko w strefie preferowanej przez użytkownika |
| Beacon online | 15 | Biurko ma działający beacon |
| Ostatnie 7 dni | 10 | Użytkownik używał biurka niedawno |

Wynik: top 1 rekomendacja dla `GET /desks/recommended?locationId=&date=`.

---

### SubscriptionsModule
**Ścieżka:** `src/modules/subscriptions/`

| Plik | Rola |
|------|------|
| `subscriptions.service.ts` | Status planu, limity, historia zmian, CRON alertów |
| `subscriptions.controller.ts` | `GET /subscription/status` |

**Plany i limity (hardcoded):**

| Plan | Biurka | Użytkownicy | Bramki | Lokalizacje | OTA | SSO | SMTP |
|------|--------|-------------|--------|-------------|-----|-----|------|
| Trial | 10 | 10 | 1 | 1 | ❌ | ❌ | ❌ |
| Starter | 10 | 25 | 1 | 1 | ❌ | ❌ | ❌ |
| Pro | 50 | 150 | 3 | 5 | ✅ | ✅ | ✅ |
| Enterprise | ∞ | ∞ | ∞ | ∞ | ✅ | ✅ | ✅ |

**CRON:**
- Codziennie: sprawdza wygasające plany → `InAppNotificationsService` + email do admina
- Tygodniowo: archiwizuje dane użytkowników z przekroczonym `scheduledDeleteAt`

---

## 6. Moduły platformowe (OWNER)

### OwnerModule
**Ścieżka:** `src/modules/owner/`

| Plik | Rola |
|------|------|
| `owner.service.ts` | CRUD org, plany, impersonacja, logi audytowe |
| `owner-health.service.ts` | Globalny stan infrastruktury (bramki/beacony wszystkich org) |
| `owner.controller.ts` | REST tylko dla roli OWNER |

**Impersonacja:**
```
POST /owner/organizations/:id/impersonate
  → JWT (30min) z { role: SUPER_ADMIN, organizationId, impersonated: true }
  → Link wysyłany emailem na adres SUPER_ADMIN org
  → Zapis do Event (OWNER_IMPERSONATION) dla audytu
```

**`OwnerGuard`** — osobny guard od `RolesGuard`. Wymaga dokładnie roli `OWNER`. Używany na całym kontrolerze `@UseGuards(OwnerGuard)`.

---

### OrganizationsModule
**Ścieżka:** `src/modules/organizations/`

| Plik | Rola |
|------|------|
| `organizations.service.ts` | CRUD organizacji, konfiguracja Azure SSO per org |

Dostępny dla SUPER_ADMIN i OWNER. Każda organizacja to niezależny tenant z własną konfiguracją (SMTP, SSO, integracje, limity).

---

### VisitorsModule
**Ścieżka:** `src/modules/visitors/`

| Plik | Rola |
|------|------|
| `visitors.service.ts` | Zaproszenia gości, QR check-in, historia wizyt |
| `visitors.controller.ts` | REST + publiczny endpoint QR check-in |

**Przepływ gościa:**
```
STAFF: POST /visitors (email, locationId, expectedAt)
  → MailerService.send() z linkiem QR
  → Visitor.qrToken wygenerowany (UUID)

Gość skanuje QR: POST /visitors/qr/:token
  → checkinAt = now()
  → STAFF może zarejestrować wyjście: PATCH /visitors/:id/checkout
```

---

### ResourcesModule
**Ścieżka:** `src/modules/resources/`

| Plik | Rola |
|------|------|
| `resources.service.ts` | CRUD zasobów (sale, parking, sprzęt) + walidacja konfliktów bookingów |
| `resources.controller.ts` | REST + dostępność + bookings |

**Typy zasobów:** ROOM (sale konferencyjne), PARKING (miejsca parkingowe), EQUIPMENT (sprzęt do wypożyczenia).

Każdy zasób ma własne bookings (model `Booking`) niezależne od Reservation biurek.

---

## 7. Modele danych — gdzie co szukać

### Gdzie jest logika per model

| Model | Serwis | Uwagi |
|-------|--------|-------|
| `Organization` | `OrganizationsService` / `OwnerService` | CRUD org, plan, moduły |
| `User` | `UsersService` | CRUD, role, soft-delete, NFC |
| `Location` | `LocationsService` | Lokalizacje, WiFi enc, kiosk PIN |
| `LocationFloorPlan` | `LocationsService` | Plany pięter per piętro |
| `Desk` | `DesksService` | CRUD, status, pozycje, QR |
| `Device` | `DevicesService` | Beacony, OTA, heartbeat |
| `Gateway` | `GatewaysService` | Bramki Pi, MQTT, LED |
| `GatewaySetupToken` | `GatewaySetupService` | Jednorazowe tokeny instalacyjne |
| `Reservation` | `ReservationsService` | Rezerwacje, RRULE, Outlook sync |
| `Checkin` | `CheckinsService` | NFC/QR/manual check-in |
| `Resource` | `ResourcesService` | Sale, parking, sprzęt |
| `Booking` | `ResourcesService` | Rezerwacje zasobów |
| `Visitor` | `VisitorsService` | Goście, QR |
| `RefreshToken` | `AuthService` | Rotacja tokenów |
| `InvitationToken` | `AuthService` | Zaproszenia email |
| `PushSubscription` | `PushService` | Web Push |
| `OrgIntegration` | `IntegrationsService` | Konfiguracje Slack/Teams/Webhook |
| `OrganizationSmtpConfig` | `MailerService` | SMTP per org |
| `InAppNotification` | `InAppNotificationsService` | Dzwonek w panelu |
| `NotificationSetting` | `NotificationsService` | Konfiguracja alertów |
| `Event` | Każdy serwis | Audit log — `prisma.event.create()` |
| `GraphToken` | `GraphService` | MS OAuth tokeny (enc) |
| `GraphSubscription` | `GraphService` | Webhook subskrypcje MS |
| `UtilizationInsight` | `InsightsService` | Cache analityki |
| `SubscriptionEvent` | `SubscriptionsService` | Historia zmian planu |
| `PlanTemplate` | `SubscriptionsService` | Definicje planów |

---

## 8. Przepływy między modułami

### Check-in NFC (pełny przepływ)

```
ESP32 (beacon):
  → skan karty NFC → publish MQTT: desk/{deskId}/checkin { card_uid }

MqttHandlers.handleCheckin():
  → CheckinsService.checkinNfc(deskId, cardUid, gatewayId)

CheckinsService.checkinNfc():
  → prisma.user.findFirst({ where: { cardUid } })
  → prisma.checkin.create()
  → ledEvents.emit(deskId, 'OCCUPIED')           ← LedEventsService
  → integrationEvents.onCheckin() .catch(() => {}) ← fire-and-forget

LedEventsService.events$ (subskrybowany przez GatewaysService):
  → GatewaysService.sendBeaconCommand(gwId, deskId, 'SET_LED', red)
  → MqttService.publish(desk/{deskId}/led, { color: '#DC0000' })

IntegrationEventService.onCheckin():
  → SlackProvider.send() + TeamsProvider.send() + WebhookProvider.dispatch()
  → Promise.allSettled() — błędy nie propagują się
```

### Rezerwacja → Outlook Calendar

```
ReservationsService.create():
  → prisma.reservation.create()
  → graphService.createCalendarEvent(userId, reservationData)
      → GET GraphToken z DB → decrypt → POST /me/events
      → Reservation.graphEventId = eventId

Użytkownik usuwa event w Outlooku:
  → MS wysyła POST /graph/webhook
  → GraphService.handleNotifications()
  → znajdź Reservation po graphEventId → cancel()
  → ledEvents.emit(deskId, 'FREE')
```

### Nowy check-in → Powiadomienie push

```
CheckinsService.manual():
  → prisma.checkin.create()
  → pushService.notifyUser(userId, { title: 'Check-in potwierdzony', ... })
    → PushSubscription[] dla userId
    → webpush.sendNotification() per subskrypcja
    → auto-cleanup 410 Gone
```

---

## 9. Cron jobs — co, gdzie, kiedy

| Harmonogram | Moduł | Metoda | Co robi |
|------------|-------|--------|---------|
| Co 1 minutę | `ReservationsModule` | `tickLedStatus()` | Zmienia LED gdy rezerwacja się zaczyna/kończy |
| Co 5 minut | `CheckinsModule` | `autoCheckout()` | Wymeldowuje przeterminowane check-iny |
| Co 5 minut | `DevicesModule` | `timeoutStaleOta()` | Timeout OTA po 10min → status 'failed' |
| Co 5 minut | `DevicesModule` | `detectOfflineDevices()` | Beacon offline gdy brak heartbeat |
| Co 1 minutę | `GatewaysModule` | `detectOfflineGateways()` | Gateway offline gdy brak heartbeat > 90s |
| Co 24 godziny | `GraphSyncModule` | `renewSubscriptions()` | Odnawia webhook subskrypcje MS Graph |
| Co 30 sekund | `MetricsModule` | `updateMetrics()` | Odświeża liczniki Prometheus |
| Codziennie 08:00 | `SubscriptionsModule` | `checkExpiringPlans()` | Alerty o wygasających planach |
| Co 6 godzin | `InAppNotificationsModule` | `sendCriticalAlertEmails()` | Email o nieprzeczytanych alertach |

---

## 10. Gdzie dodać nową funkcję

### Nowy endpoint API

1. **DTO** → utwórz `dto/nazwa.dto.ts` z class-validator dekoratorami
2. **Serwis** → dodaj metodę do istniejącego `*.service.ts` (org isolation!)
3. **Kontroler** → dodaj endpoint z `@Roles()`, `@ApiOperation()`, odpowiednim guard
4. **Swagger** → `@ApiOperation({ summary: '...' })` — wymagane na każdym endpoincie

### Nowe powiadomienie email

1. Stwórz HTML przez `mailer.buildHtml({ title, body, ctaLabel, ctaUrl })`
2. Wywołaj `mailer.send({ to, subject, html }, organizationId)`
3. Opcjonalnie: `pushService.notifyUser(userId, payload)` dla push

### Nowe powiadomienie in-app

```typescript
await this.inapp.create({
  userId,
  type:       InAppNotifType.GATEWAY_OFFLINE,
  title:      'Gateway offline',
  body:       `Gateway ${name} stracił połączenie`,
  actionUrl:  `/devices`,
  dedupeKey:  `gateway_offline:${gatewayId}`,
});
```

### Nowe zdarzenie integracji (Slack/Teams/Webhook)

1. Dodaj metodę `onNazwaZdarzenia()` w `IntegrationEventService`
2. Wywołaj w odpowiednim serwisie: `this.integrationEvents.onNazwa(orgId, data).catch(() => {})`
3. Dodaj obsługę w `SlackProvider.send()` i `WebhookProvider.dispatch()` jeśli potrzeba nowego eventu

### Nowa migracja Prisma

```bash
# Dodaj zmiany do schema.prisma
# Następnie utwórz plik migracji:
prisma migrate dev --name opis_zmiany

# Przy produkcyjnym deploy:
prisma migrate deploy
```

**Wzorzec idempotentny dla nowych enumów:**
```sql
DO $$ BEGIN
  CREATE TYPE "NazwaEnum" AS ENUM ('WARTOŚĆ_1', 'WARTOŚĆ_2');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

### Nowy cron job

```typescript
@Cron('0 */5 * * * *') // co 5 minut
async nazwaCrona(): Promise<void> {
  // logika
}
// Wymagane: @Injectable() na klasie + ScheduleModule w app.module.ts (już zarejestrowany)
```

---

*Powiązane dokumenty:*
- [`architecture.md`](./architecture.md) — architektura IoT (Beacon → Gateway → Serwer)
- [`ai-context.md`](./ai-context.md) — pełne API, schematy DB, wzorce kodu, env vars
- [`api.md`](./api.md) — szczegółowa dokumentacja REST API
- [`security-isolation.md`](./security-isolation.md) — izolacja danych per tenant
- [`BACKLOG.md`](./BACKLOG.md) — zaplanowane funkcje i dług techniczny

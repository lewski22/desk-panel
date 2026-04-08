# Reserti Desk Management — Kontekst dla narzędzi AI

> Aktualizacja: 2026-04-07 — po sesji bugfixów i refaktoryzacji

---

## Czym jest Reserti

SaaS do zarządzania hot-deskami w biurach z fizycznymi beaconami IoT.
Pracownicy rezerwują biurka przez przeglądarkę lub Microsoft Teams.
Beacon ESP32 przy każdym biurku: LED status + check-in kartą NFC lub QR kodem.

---

## Monitoring (Prometheus + Grafana)

Backend wystawia `GET /metrics` (prom-client, poza /api/v1).
Gateway Python wystawia `GET /metrics` na porcie 9100 (prometheus_client).
Konfiguracja: env `METRICS_ALLOWED_IPS` dla backendu, `GATEWAY_METRICS_PORT` dla gateway.
Szczegóły: `docs/metrics.md`.

Pliki: `backend/src/metrics/` (registry, service, controller, interceptor, module).

---

## Repozytoria

| Repo | Branch | Opis |
|------|--------|------|
| `github.com/lewski22/desk-panel` | main | Backend + Unified Panel |
| `github.com/lewski22/desk-gateway-python` | master | Python gateway (RPi) |
| `github.com/lewski22/desk-firmware` | master | ESP32 PlatformIO |

**Produkcja:** `api.prohalw2026.ovh`, `app.prohalw2026.ovh`, `owner.prohalw2026.ovh`  
**Deploy:** Coolify na Proxmox LXC + Cloudflare Tunnel

---

## Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Backend | NestJS 10 + Prisma 5 + PostgreSQL 15 |
| Frontend | React 18 + Vite + Tailwind CSS (Unified Panel) |
| Gateway | Python 3.8+ + paho-mqtt + requests + sqlite3 (stdlib) |
| Firmware | ESP32 + PlatformIO + ArduinoJson + PubSubClient + PN532 + NeoPixel |
| Infra | Docker, Coolify, Proxmox, Cloudflare Tunnel, Mosquitto (MQTT) |

---

## Architektura modułów backend

```
AppModule
├── SharedModule (@Global)          ← LedEventsService (rxjs Subject — event bus)
├── DatabaseModule                  ← Prisma
├── AuthModule                      ← JWT + Entra ID SSO
├── UsersModule
├── OrganizationsModule
├── LocationsModule
├── DesksModule
├── DevicesModule → MqttModule      ← JEDNA STRONA (DevicesController używa MqttService)
├── GatewaysModule
├── ReservationsModule              ← brak MqttModule (używa LedEventsService)
├── CheckinsModule                  ← brak MqttModule (używa LedEventsService)
├── MqttModule → [CheckinsModule, GatewaysModule]   ← ZERO circular
└── OwnerModule
```

**Kluczowa zasada:** Żaden moduł domenowy nie importuje MqttModule bezpośrednio,
poza DevicesModule (gdzie MqttService jest potrzebny w kontrolerze).
LED commands idą przez LedEventsService → MqttHandlers.

---

## Dependency Graph — LED flow

```
CheckinsService.checkinQr()  ─→ LedEventsService.emit('OCCUPIED')
CheckinsService.walkinQr()   ─→ LedEventsService.emit('OCCUPIED')
CheckinsService.checkout()   ─→ LedEventsService.emit('FREE')
ReservationsService.cancel() ─→ LedEventsService.emit('FREE')
                                      │
                              MqttHandlers.onModuleInit()
                              .ledEvents.events$.subscribe()
                                      │
                              mqtt.publish(desk/{deskId}/command, SET_LED)
                                      │
                              Mosquitto → Beacon ESP32 → LED zmienia kolor
```

---

## Pliki krytyczne (backend)

| Plik | Rola |
|------|------|
| `src/shared/led-events.service.ts` | Event bus LED (rxjs Subject) |
| `src/mqtt/mqtt.handlers.ts` | Obsługa NFC scans + subskrypcja LED events |
| `src/mqtt/mqtt.service.ts` | MQTT client (publish, subscribe, handlers) |
| `src/mqtt/topics.ts` | Definicje topicków + LED payloads |
| `src/modules/checkins/checkins.service.ts` | NFC/QR/manual checkin + LED emit |
| `src/modules/desks/desks.service.ts` | getCurrentStatus — mapa z qrToken |
| `src/modules/devices/devices.controller.ts` | sendCommand + assign (MQTT publish) |
| `src/modules/gateways/gateways.service.ts` | deviceHeartbeat (isOnline) |
| `src/modules/reservations/reservations.service.ts` | cancel() zamyka checkin + LED FREE |
| `src/database/seeds/seed.ts` | Seed idempotentny (upsert) — BEZ rezerwacji testowych |

---

## Pliki krytyczne (frontend — Unified Panel)

| Plik | Rola |
|------|------|
| `src/utils/date.ts` | `localDateStr()`, `localDateTimeISO()` — lokalna data nie UTC |
| `src/components/desks/DeskMap.tsx` | Mapa biurek + ReservationModal (END_USER + Admin) |
| `src/components/desks/DeskCard.tsx` | Karta biurka, prop `hideActions` dla END_USER |
| `src/components/layout/AppLayout.tsx` | Sidebar desktop + hamburger drawer mobile |
| `src/pages/QrCheckinPage.tsx` | QR flow — walkin + checkin z rezerwacji |
| `src/pages/ProvisioningPage.tsx` | Provisioning beaconów + reassign + gateway setup |
| `src/api/client.ts` | Wszystkie wywołania API |

---

## Schemat bazy danych (kluczowe modele)

```
Organization ─┬── Location ─┬── Desk ─── Device (Beacon)
              │             └── Gateway
              └── User

Reservation (Desk + User, date @db.Date, startTime/endTime DateTime UTC)
  └── Checkin (method: NFC|QR|MANUAL, checkedOutAt nullable)

Event (log wszystkich operacji)
GatewaySetupToken (jednorazowy token instalacji gateway)
```

**Ważne:** `Reservation.date` to `@db.Date` (PostgreSQL DATE bez czasu).
Porównanie w backendzie przez range `gte/lt` (nie exact match).

---

## MQTT — Tematy

```
desk/{deskId}/command    ← backend → beacon
desk/{deskId}/checkin    → gateway ← beacon (NFC)
desk/{deskId}/status     → backend + gateway ← beacon (heartbeat)
desk/#                   ← gateway subskrybuje wszystko
gateway/{gwId}/hello     retain=true ← gateway → backend
gateway/{gwId}/status    retain=true (LWT)
```

**Uwaga:** Beacon bez przypisanego biurka subskrybuje `desk//command` (pusty deskId).
Po `assignToDesk` backend wysyła `SET_DESK_ID` na stary topic → beacon restartuje z nowym.

---

## Provisioning Beacon — flow

```
1. Panel Admin → Provisioning → "+ Beacon"
2. Wypełnij: hardwareId, gateway, biurko (opcjonalne)
3. Backend: POST /devices/provision → generuje MQTT credentials
4. Panel wyświetla komendę do Serial Monitora:
   PROVISION:{"wifi_ssid":"...","mqtt_user":"beacon-X","desk_id":"UUID","..."}
5. Wklej w Serial Monitor ESP32 → beacon zapisuje do NVS → restart
6. Beacon łączy się z Mosquitto → subskrybuje desk/{deskId}/command
```

**Gateway** dowiaduje się o beaconie gdy ten wysyła pierwszy heartbeat na MQTT.

---

## Provisioning Gateway — flow

```
1. Panel Admin → Provisioning → "+ Gateway" przy danym biurze
2. Backend: POST /gateway/setup-tokens → jednorazowy token (24h)
3. Panel wyświetla komendę:
   curl -fsSL https://api.../install/gateway/{token} | bash
4. Skrypt install.sh:
   - Instaluje Python, paho-mqtt, uv
   - Tworzy /opt/reserti-gateway/.env z TOKEN + API_URL
   - Wywołuje gateway.py --setup → rejestruje w backendzie
   - Tworzy systemd service reserti-gateway
5. Gateway działa jako bridge MQTT ↔ HTTPS
```

---

## Kluczowe problemy rozwiązane (code review 2026-04-07)

| Problem | Rozwiązanie |
|---------|-------------|
| NFC LED → zły broker MQTT | `ledEvents.emit()` zamiast `sendLedCommand()` |
| checkout bez auth | `checkout(id, actorId, actorRole)` — weryfikacja właściciela |
| GET /reservations bez @Roles | `@Roles(STAFF+)` na GET / i GET /:id |
| sync/heartbeat gateway publiczne | `x-gateway-secret` + `x-gateway-provision-key` |
| Dead code: markOffline, getCommandTarget | Usunięte z DevicesService |
| Dead code: sendLedCommand, notifyUser, broadcast | Usunięte z MqttService |
| closeTime UTC vs local | `endOfWorkInTz(closeTime, timezone, now)` — Intl, bez bibliotek |
| manual() bez weryfikacji org | Sprawdzanie `location.organizationId === actorOrgId` |
| Duplikacja HTTP gateway code | `GatewaysService.addBeaconCredentials()` — jeden punkt |
| now vs now2 w checkinNfc | Jedno `now` z początku metody |
| SendCommandDto bez walidacji | `@IsIn(['REBOOT','IDENTIFY','SET_LED'])` |

---

## Kluczowe problemy rozwiązane w sesji 2026-04-07

| Problem | Rozwiązanie |
|---------|-------------|
| LED nie zmienia się po QR check-in | LedEventsService (event bus) zamiast forwardRef circular |
| Circular dependency MqttModule | SharedModule @Global + LedEventsService + DevicesController publish |
| Godziny rezerwacji +2h | `localDateTimeISO()` — bez `.000Z`, parsuje jako czas lokalny |
| Data nie przesuwa się (UTC vs local) | `localDateStr()` + backend range filter `gte/lt` |
| END_USER nie widzi wolnych biurek | `getCurrentStatus` zwraca `status: d.status` |
| Zajęte biurko znika z mapy END_USER | Filtr tylko po `status === 'ACTIVE'` (nie `!isOccupied`) |
| Beacon FREE→OCCUPIED po restarcie | TTL 1h dla offline NVS queue (flushOfflineQueue) |
| Anulowanie rezerwacji nie zwalnia LED | `cancel()` zamyka Checkin + emituje LED FREE |
| Przyciski Restart/Identyfikuj przez MQTT | `DevicesController.command()` publishuje bezpośrednio |
| `qrToken` null w getCurrentStatus | Dodano do `select` w reservations include |
| Okno rezerwacji 30min ograniczone | Usunięto limit — `endTime >= now` |
| Duplikaty rezerwacji z seed | Usunięto `prisma.reservation.create()` z seed (był nie-idempotentny) |

---

## Aktualny stan panelu (role → funkcje)

### SUPER_ADMIN / OFFICE_ADMIN
- Dashboard z wykresami (7 dni, godzinowy, strefy, top biurka)
- Biurka: CRUD, dezaktywacja, trwałe usunięcie (tylko INACTIVE)
- Rezerwacje: tabela z filtrami (data, status), check-in ręczny, anulowanie
- Użytkownicy: lista aktywnych/dezaktywowanych, edycja, karty NFC, dezaktywacja
- Provisioning: lista beaconów + gateway, reassign, REBOOT/IDENTIFY, tokeny instalacji
- Raporty: wykresy zajętości i check-inów
- Organizacje: CRUD (tylko SUPER_ADMIN)
- Mapa biurek: pełna mapa + ReservationModal z wyborem pracownika
- Moje rezerwacje

### STAFF
- Dashboard (uproszczony)
- Wszystkie rezerwacje + check-in/out
- Mapa biurek + ReservationModal
- Urządzenia (DevicesPage)
- Moje rezerwacje

### END_USER
- Mapa biurek — WSZYSTKIE aktywne (zajęte też widoczne, kliknięcie = ReservationModal)
- ReservationModal: data + godziny (bez pytania o ID — rezerwacja dla siebie)
- Moje rezerwacje + anulowanie
- QR check-in (przez link z QR kodu na biurku)

---

## Hardware constraints

| Urządzenie | Wymagania | Uwagi |
|------------|-----------|-------|
| Beacon | ESP32 (4MB flash) | Nie ESP8266 — brak MQTT TLS support |
| Gateway | RPi 3B+, 4, lub Zero 2W | RPi 1B+ NIE — ARMv6, brak Python 3.10+ |
| NFC | PN532 | I2C na pinach 21 (SDA) i 22 (SCL) |
| LED | WS2812B 12-LED ring | Pin 13, 5V zasilanie |

---

## Roadmap — co planowane

Szczegóły: `docs/roadmap.md`

**P1 (pilne):**
- Location.timezone — strefa czasowa per biuro (IANA)
- QR LED przez gateway (backup gdy backend MQTT offline)

**P2:**
- OTA aktualizacje gateway (bash update przez panel)
- OTA aktualizacje firmware beacon (HTTP OTA, wersjonowanie)
- Auto-NFC assign (60s tryb scan bez UID ręcznie)
- Moduł max rezerwacji (limit dni/godzin do przodu)

**P3 (roadmap):**
- Rotacja kluczy gateway (okno 15min dwóch kluczy)
- M365/Entra Teams App (M2)
- M4 — Microsoft Graph Sync (kalendarze)
- Metryki SRE (provisioning error rate, beacon uptime)

---

## Znane ograniczenia / TODO

1. **Strefa czasowa** — ✅ `walkinQr()` używa `endOfWorkInTz()` (Intl, IANA). Rezerwacje panelowe nadal UTC — `localDateTimeISO()` w frontendzie jako workaround.

2. **QR check-in LED** — LED zmienia się przez backend MQTT publish. Jeśli backend MQTT
   jest rozłączony, LED nie reaguje. Backup: gateway mógłby słuchać checkin eventów.

3. **Beacon bez RTC** — timestamp w heartbeat to `millis()/1000` (czas od startu).
   TTL offline queue (1h) bazuje na tym offsetcie — działa jeśli beacon nie jest offline > 1h.

4. **Seed nieodwracalny** — `prisma db push --accept-data-loss` przy każdym deployu.
   Należy przejść na `prisma migrate deploy` dla bezpiecznych migracji.

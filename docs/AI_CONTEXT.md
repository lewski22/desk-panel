# Reserti Desk Management — Kontekst dla narzędzi AI

> Aktualizacja: 2026-04-15 — v0.11.0 (i18n + PWA + Testy + OTA + Notyfikacje)

---

## Czym jest Reserti

SaaS do zarządzania hot-deskami w biurach z fizycznymi beaconami IoT.
Pracownicy rezerwują biurka przez przeglądarkę lub Microsoft Teams.
Beacon ESP32 przy każdym biurku: LED status + check-in kartą NFC lub QR kodem.

**Produkcja:** `api.prohalw2026.ovh`, `app.prohalw2026.ovh`
**Deploy:** Coolify na Proxmox LXC + Cloudflare Tunnel

---

## Repozytoria

| Repo | Branch | Opis |
|------|--------|------|
| `github.com/lewski22/desk-panel` | main | Backend NestJS + Unified Panel React |
| `github.com/lewski22/desk-gateway-python` | master | Python gateway (RPi) |
| `github.com/lewski22/desk-firmware` | master | ESP32 PlatformIO |

---

## Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Backend | NestJS 10 + Prisma 5 + PostgreSQL 15 |
| Frontend | React 18 + Vite + Tailwind CSS + i18next + vite-plugin-pwa |
| Gateway | Python 3.8+ + paho-mqtt + requests + sqlite3 (stdlib) |
| Firmware | ESP32 + PlatformIO + ArduinoJson + PubSubClient + PN532 + NeoPixel |
| Infra | Docker, Coolify, Proxmox, Cloudflare Tunnel, Mosquitto (MQTT) |
| Monitoring | Prometheus (backend /metrics + gateway :9100) + Grafana (planowane) |

---

## Architektura modułów backend

```
AppModule
├── SharedModule (@Global)          ← LedEventsService (rxjs Subject — event bus)
├── DatabaseModule                  ← Prisma
├── AuthModule                      ← JWT + Entra ID SSO
├── UsersModule
├── OrganizationsModule             ← Azure SSO config + (planowane: SubscriptionsService)
├── LocationsModule
├── DesksModule
├── DevicesModule → MqttModule      ← JEDNA STRONA (DevicesController uses MqttService)
├── GatewaysModule
├── ReservationsModule              ← brak MqttModule (używa LedEventsService)
├── CheckinsModule                  ← brak MqttModule (używa LedEventsService)
├── NotificationsModule             ← email per org (SMTP AES-256-GCM) + in-app
├── MqttModule → [CheckinsModule, GatewaysModule]   ← ZERO circular
└── OwnerModule                     ← CRUD org, impersonacja, stats, health
```

**Kluczowa zasada:** LED commands idą przez `LedEventsService → MqttHandlers`.
Żaden moduł domenowy nie importuje MqttModule bezpośrednio (oprócz DevicesModule).

---

## LED flow (dependency graph)

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

## Schemat bazy danych (kluczowe modele)

```
Organization ─┬── Location ─┬── Desk ─── Device (Beacon)
              │             ├── Gateway
              │             └── GatewaySetupToken
              ├── User
              ├── OrganizationSmtpConfig
              └── SubscriptionEvent (planowane v0.12.0)

Organization.plan: starter|pro|enterprise|trial
Organization.planExpiresAt: DateTime? (null = bezterminowy)
Organization.limitDesks/limitUsers/limitGateways/limitLocations: Int? (null = ∞)

Reservation (Desk + User, date @db.Date, startTime/endTime DateTime UTC)
  └── Checkin (method: NFC|QR|MANUAL, checkedOutAt nullable)

Event (audit log wszystkich operacji — EventType enum 20+ typów)
NotificationSetting (per org, 8 typów, SMTP AES-256-GCM)
NotificationLog (historia wysyłki emaili)
NotificationRule (in-app — per rola)
InAppNotification (per user, polling 15s)
```

**Ważne:** `Reservation.date` to `@db.Date` — filtrowanie przez range `gte/lt`.

---

## MQTT — Tematy

```
desk/{deskId}/command    ← backend/gateway → beacon (SET_LED, REBOOT, OTA_UPDATE)
desk/{deskId}/checkin    → gateway ← beacon (NFC scan)
desk/{deskId}/status     → backend + gateway ← beacon (heartbeat)
gateway/{gwId}/hello     retain=true ← gateway → backend
gateway/{gwId}/status    retain=true (LWT)
```

---

## Provisioning — flows

**Beacon:**
```
Panel → POST /devices/provision → MQTT credentials
Panel wyświetla: PROVISION:{wifi_ssid, mqtt_user, desk_id, ...}
Serial Monitor ESP32 → beacon zapisuje do NVS → restart
Beacon łączy się z Mosquitto → subskrybuje desk/{deskId}/command
```

**Gateway:**
```
Panel → POST /gateway/setup-tokens → jednorazowy token (24h)
Panel wyświetla: curl .../install/gateway/{token} | bash
install.sh: Python + systemd service + .env z TOKEN + API_URL
Gateway.py --setup → rejestruje w backendzie
```

**OTA Firmware:**
```
GitHub Actions CI → build .bin → GitHub Releases (przy tagu v*)
Backend: GET /firmware/latest → GitHub Releases API → { version, url }
POST /devices/:id/ota → triggerOta(id, actorOrgId)
                       → sendBeaconCommand(gw, desk, OTA_UPDATE, {url, version})
Gateway → MQTT → Beacon: HTTP download → ESP.restart()
Backend cron timeoutStaleOta() → fail po 10min bez heartbeat
```

---

## i18n (v0.11.0)

- **427 kluczy** w `apps/unified/src/locales/{pl,en}/translation.json`
- **100% pokrycie** — 28 plików `.tsx` z `useTranslation()`
- `LanguageSwitcher` w headerze AppLayout
- Date locale dynamiczny: `i18n.language === 'en' ? 'en-GB' : 'pl-PL'`
- date-fns: `import { pl, enUS }` + warunkowy wybór
- **0 `alert()`** w kodzie produkcyjnym — wszystkie zamienione na `setErr()`

---

## PWA (v0.11.0)

- `vite-plugin-pwa` + Workbox w `apps/unified/vite.config.ts`
- manifest: name Reserti, theme #B53578, start_url /dashboard
- Service worker: `NetworkFirst` dla `/api/`, `CacheFirst` dla fontów
- `registerSW()` w `main.tsx`
- Ikony: `public/icon-192.svg`, `public/icon-512.svg`

---

## Testy (v0.11.0)

| Faza | Pliki | Testy |
|------|-------|-------|
| P1 — backend service | 3 spec.ts | 64 |
| P2 — gateway Python | 3 test_*.py | 63 |
| P3 — kontrolery + auth | 3 spec.ts | 51 |
| **RAZEM** | **9** | **178** |

Uruchamianie:
```bash
cd backend && npx jest --coverage
cd desk-gateway-python && python3 -m unittest discover -s tests/ -v
```

---

## Pliki krytyczne (backend)

| Plik | Rola |
|------|------|
| `src/shared/led-events.service.ts` | Event bus LED (rxjs Subject) |
| `src/mqtt/mqtt.handlers.ts` | NFC scans + LED events subscription |
| `src/mqtt/topics.ts` | Definicje topicków + LED payloads |
| `src/modules/checkins/checkins.service.ts` | NFC/QR/manual + LED emit |
| `src/modules/devices/devices.service.ts` | triggerOta, timeoutStaleOta, heartbeat |
| `src/modules/gateways/gateways.service.ts` | sendBeaconCommand, heartbeat |
| `src/modules/reservations/reservations.service.ts` | cancel() + LED FREE |
| `src/modules/notifications/` | email + in-app (8 typów, SMTP per org) |
| `src/database/seeds/seed.ts` | Idempotentny seed (tylko upsert) |

---

## Pliki krytyczne (frontend — Unified Panel)

| Plik | Rola |
|------|------|
| `src/utils/date.ts` | `localDateStr()`, `localDateTimeISO()` — lokalna data nie UTC |
| `src/i18n.ts` | i18next setup, lng: 'pl', fallbackLng: 'en' |
| `src/locales/{pl,en}/translation.json` | 427 kluczy per język |
| `src/components/desks/DeskMap.tsx` | Mapa biurek + ReservationModal |
| `src/components/layout/AppLayout.tsx` | Sidebar + hamburger + LanguageSwitcher |
| `src/components/layout/NotificationBell.tsx` | In-app notifications (polling 15s) |
| `src/pages/ProvisioningPage.tsx` | Beacony + gateway + OTA badges |
| `src/api/client.ts` | Wszystkie wywołania API |

---

## Aktualny stan panelu (role → funkcje)

### OWNER
- Owner Panel: CRUD firm, impersonacja, stats platform, subskrypcje (v0.12.0)

### SUPER_ADMIN / OFFICE_ADMIN
- Dashboard (wykresy 7 dni, godzinowy, strefy, top biurka)
- Biurka: CRUD, dezaktywacja, trwałe usunięcie
- Rezerwacje: tabela z filtrami, check-in ręczny, anulowanie
- Użytkownicy: lista, NFC card, dezaktywacja z retention
- Provisioning: beacony + gateway + OTA + auto-refresh
- Raporty, Organizacje (SUPER_ADMIN), Mapa, Moje rezerwacje
- **Subskrypcja: stan planu + limity zasobów (planowane v0.12.0)**

### STAFF
- Dashboard, rezerwacje + check-in/out, mapa, urządzenia, moje rezerwacje

### END_USER
- Mapa biurek (wszystkie aktywne), ReservationModal, moje rezerwacje, QR check-in

---

## Moduł subskrypcji (planowany v0.12.0)

Szczegóły: `docs/subscription.md`

SUPER_ADMIN widzi:
- aktualny plan (Starter/Pro/Enterprise/Trial), ważność
- pasek wykorzystania: biurka/użytkownicy/gatewaye/biura (used/limit/%)
- ostrzeżenia przy > 80% i > 95% utilizacji
- `ExpiryBanner` w AppLayout przy < 14 dni do wygaśnięcia

OWNER zarządza planami z `OwnerPage` — tabela klientów z MRR, wygasającymi, historią.

---

## Hardware constraints

| Urządzenie | Wymagania | Uwagi |
|------------|-----------|-------|
| Beacon | ESP32 (4MB flash) | Nie ESP8266 — brak MQTT TLS support |
| Gateway | RPi 3B+, 4, lub Zero 2W | RPi 1B+ NIE — ARMv6, brak Python 3.10+ |
| NFC | PN532 | I2C: pin 21 (SDA), 22 (SCL) |
| LED | WS2812B 12-LED ring | Pin 13, 5V |

---

## Konta testowe

| Email | Hasło | Rola |
|-------|-------|------|
| `owner@reserti.pl` | `Owner1234!` | OWNER |
| `superadmin@reserti.pl` | `Admin1234!` | SUPER_ADMIN |
| `admin@demo-corp.pl` | `Admin1234!` | OFFICE_ADMIN |
| `staff@demo-corp.pl` | `Staff1234!` | STAFF |
| `user@demo-corp.pl` | `User1234!` | END_USER |

---

## Zmienne środowiskowe (backend)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
MQTT_BROKER_URL=mqtt://mosquitto-NAME:1883
CORS_ORIGINS=https://app.prohalw2026.ovh
GATEWAY_PROVISION_KEY=...
PUBLIC_API_URL=https://api.prohalw2026.ovh/api/v1
AZURE_CLIENT_ID=...
FIRMWARE_REPO=lewski22/desk-firmware   # GitHub Releases source
SMTP_ENCRYPTION_KEY=...                # 64 hex chars, AES-256-GCM
SMTP_HOST/PORT/USER/PASS/FROM          # globalny fallback SMTP
METRICS_ALLOWED_IPS=127.0.0.1,10.0.0.0/8
```

# Architektura systemu — Reserti Desk Management

> Aktualizacja: 2026-05-07 — v0.17.8  
> Strefy czasowe per lokalizacja → `timezones.md`

---

## Przegląd

Trzywarstwowy system IoT do zarządzania zajętością biurek hot-desk.

```
┌────────────────────────────────────────────────────────────────────┐
│  WARSTWA 3 — SERWER (Coolify / Proxmox LXC)                        │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐   │
│  │ NestJS Backend    │  │ Unified Panel     │  │ PostgreSQL 15  │   │
│  │ 11 modułów        │  │ React 18 + PWA    │  │ Prisma ORM     │   │
│  │ JWT + MQTT client │  │ i18n PL/EN        │  │ 16 modeli      │   │
│  │ /metrics (Prom)   │  │ Tailwind CSS      │  └────────────────┘   │
│  └────────┬─────────┘  └──────────────────┘                        │
│           │ MQTT                             ┌────────────────┐     │
│  ┌────────▼─────────┐                       │ Mosquitto      │     │
│  │ LedEventsService  │                       │ MQTT broker    │     │
│  │ rxjs Subject      │                       │ Docker network │     │
│  └───────────────────┘                       └────────────────┘     │
└───────────────────────┬────────────────────────────────────────────┘
                        │ HTTPS + MQTT (Cloudflare Tunnel)
┌───────────────────────▼────────────────────────────────────────────┐
│  WARSTWA 2 — GATEWAY (per biuro, Raspberry Pi)                      │
│                                                                     │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐ │
│  │ gateway.py (systemd service) │  │ Mosquitto (local broker)     │ │
│  │ ├── SyncService (co 60s)    │  │ port 1883 + passwd auth      │ │
│  │ ├── Cache (SQLite WAL)      │  │ ACL: beacon read/write       │ │
│  │ ├── DeviceMonitor           │  └──────────────┬───────────────┘ │
│  │ ├── MqttAdmin               │                 │ MQTT/WiFi        │
│  │ ├── MqttBridge              │  ┌──────────────▼──────────────┐  │
│  │ └── /metrics :9100 (Prom)   │  │  ESP32 Beacony              │  │
│  └─────────────────────────────┘  │  PN532 NFC + WS2812B LED    │  │
│                                   └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Warstwa 1 — Beacon (ESP32)

**Hardware:** ESP32 (4MB flash) + PN532 (I2C: SDA=21, SCL=22) + WS2812B 12-LED ring (pin 13)
**Repo:** `desk-firmware` (PlatformIO, Arduino framework)

### Odpowiedzialności
- Skanowanie kart NFC → `desk/{deskId}/checkin` MQTT
- Wyświetlanie stanu LED: zielony (wolne), niebieski (zarezerwowane), czerwony (zajęte)
- Heartbeat co 30s → `desk/{deskId}/status`
- Obsługa komend: `SET_LED`, `REBOOT`, `IDENTIFY`, `SET_DESK_ID`, `OTA_UPDATE`, `FACTORY_RESET`
- Offline NVS queue — buforuje eventy NFC gdy MQTT offline (TTL 1h)
- HTTP OTA: pobiera `.bin` z URL i restartuje do nowej partycji

### Provisioning
Przez Serial Monitor: `PROVISION:{"wifi_ssid":"...","mqtt_user":"beacon-X","desk_id":"UUID",...}`

---

## Warstwa 2 — Gateway (Raspberry Pi)

**Hardware:** RPi 3B+, 4 lub Zero 2W (nie RPi 1B+ — ARMv6 niekompatybilne)
**Repo:** `desk-gateway-python`
**Serwis:** systemd `reserti-gateway`

### Komponenty

| Klasa | Rola |
|-------|------|
| `Cache` | SQLite WAL — rezerwacje, LED state, device registry |
| `SyncService` | Pull z backendu co 60s → aktualizacja SQLite |
| `MqttBridge` | Subskrybuje `desk/#` → forward NFC do backendu |
| `DeviceMonitor` | Wykrywa beacony offline (> 90s bez heartbeat) |
| `MqttAdmin` | Dynamiczne zarządzanie users Mosquitto |
| `GatewayApiHandler` | REST API dla backendu (`/command`, `/health`) |

### Offline-first
Gdy sieć niedostępna: Cache obsługuje NFC z lokalnych danych (grace period 15min).

### Provisioning
Automatyczna instalacja: `curl -fsSL .../install/gateway/{token} | bash`

---

## Warstwa 3 — Serwer

### NestJS Backend — moduły

```
AppModule
├── SharedModule (@Global)
│   └── LedEventsService         rxjs Subject — event bus dla LED
├── DatabaseModule
│   └── PrismaService
├── MetricsModule                Prometheus /metrics
├── AuthModule                   JWT (15min/7d) + Entra ID SSO
├── UsersModule
├── OrganizationsModule          Azure SSO config + (planowane: Subscriptions)
├── LocationsModule              Biura + occupancy + extended stats
├── DesksModule                  CRUD + live status + QR tokens
├── DevicesModule                Provisioning + OTA + heartbeat
│   └── → MqttModule
├── GatewaysModule               Setup tokens + sendBeaconCommand
│   └── InstallController        GET /install/gateway/:token (poza /api/v1)
├── ReservationsModule           CRUD + konflikty + QR + cron expireOld
├── CheckinsModule               NFC/QR/manual + cron autoCheckout
├── NotificationsModule          Email (SMTP per org) + in-app
├── MqttModule                   MQTT client + handlers
└── OwnerModule                  CRUD org + impersonacja + stats + health
```

### LED flow (zero circular dependency)

```
CheckinsService / ReservationsService
  → LedEventsService.emit({ deskId, state: 'OCCUPIED'|'FREE'|'RESERVED' })
    → MqttHandlers.ledEvents.events$.subscribe()
      → GatewaysService.sendBeaconCommand(gatewayId, deskId, 'SET_LED', { color })
        → HTTP POST gateway Pi → Mosquitto → ESP32 → LED zmiana koloru
```

### OTA flow

```
GitHub Actions CI (push tag v*):
  PlatformIO build → .bin → GitHub Releases

Backend:
  GET /firmware/latest → GitHub Releases API → { version, url, sha256 }
  POST /devices/:id/ota → device.otaStatus = 'in_progress'
                        → sendBeaconCommand('OTA_UPDATE', { url, version })

Gateway → MQTT → ESP32:
  HTTPUpdate.update(url) → new partition → ESP.restart()
  → heartbeat z { version: newVersion }
    → backend: otaStatus = 'success'

Cron timeoutStaleOta() (co 5min):
  otaStartedAt < now - 10min && otaStatus == 'in_progress' → 'failed'
```

---

## Przepływ danych — check-in NFC

```
1. Pracownik przykłada kartę do beacona ESP32
2. Beacon czyta UID karty NFC
3. Beacon publishuje: desk/{deskId}/checkin { card_uid, ts }
4. Mosquitto (Pi) → gateway.py.MqttBridge._handle_checkin()
5. Cache.find_by_card(uid) — sprawdza lokalnie (grace period 15min)
6. POST backend /checkins (przez HTTPS, Cloudflare Tunnel)
7. CheckinsService.nfcCheckin():
   a. Znajdź User po cardUid
   b. Sprawdź aktywną rezerwację
   c. Utwórz Checkin record
   d. LedEventsService.emit('OCCUPIED')
8. MqttHandlers.onLedEvent():
   GatewaysService.sendBeaconCommand(gwId, deskId, 'SET_LED', { color: '#DC0000' })
9. HTTP POST gateway Pi /command → Mosquitto (Pi) → ESP32
10. LED zmienia kolor na czerwony (< 200ms end-to-end)
```

---

## Bezpieczeństwo

| Aspekt | Rozwiązanie |
|--------|-------------|
| Auth API | JWT Bearer, 15min access + 7d refresh z rotacją |
| Auth gateway | `x-gateway-secret` (bcrypt) + `x-gateway-provision-key` |
| Auth MQTT | Mosquitto passwd + ACL per beacon (user/password) |
| Multi-tenant isolation | `organizationId` w każdym query + RolesGuard |
| OWNER isolation | OwnerGuard — dedykowany guard |
| SMTP hasła | AES-256-GCM (SMTP_ENCRYPTION_KEY env) |
| Rate limiting | @nestjs/throttler: 100/60s globalnie, 5/60s dla auth |
| Metrics | IP whitelist (METRICS_ALLOWED_IPS) |
| Provisioning tokens | crypto.randomBytes(32).toString('hex'), jednorazowe, TTL 24h |
| Impersonacja | JWT 30min + impersonated: true + audit log OWNER_IMPERSONATION |

---

## Monitorowanie

```
NestJS /metrics (port 3000, poza /api/v1):
  ├── http_request_duration_seconds (histogram)
  ├── db_query_duration_seconds
  ├── mqtt_events_total{type}
  └── reserti_*_{orgs,gateways,beacons,checkins}_*

Gateway /metrics (port 9100):
  ├── gateway_mqtt_publishes_total{type}
  ├── gateway_http_errors_total{endpoint}
  ├── gateway_beacon_last_seen_seconds{hardware_id}
  └── gateway_sync_duration_seconds

Planowane: Prometheus + Grafana w Coolify (v0.12.1)
  - Dashboard 1: Owner — System Health
  - Dashboard 2: Owner — Fleet Overview
  - Dashboard 3: Client — Desk Analytics
  - Dashboard 4: Client — IoT Health
```

---

## Moduł subskrypcji (planowany v0.12.0)

```
Organization
  ├── plan: starter|pro|enterprise|trial
  ├── planExpiresAt: DateTime?
  ├── limitDesks/Users/Gateways/Locations: Int? (null = ∞)
  └── SubscriptionEvent[]
        ├── type: plan_changed|renewed|expired|trial_started|limit_exceeded
        ├── previousPlan, newPlan
        └── changedBy (OWNER userId)

GET /subscription/status → SUPER_ADMIN
  { plan, daysUntilExpiry, status, usage: { desks: { used, limit, pct }, ... }, features }

POST /owner/organizations/:id/subscription → OWNER
  { plan, planExpiresAt, limitDesks, limitUsers, limitGateways, limitLocations, mrr }
```

Szczegóły: `docs/subscription.md`

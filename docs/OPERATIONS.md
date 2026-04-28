# Operations — Reserti Desk Panel

> Ostatnia aktualizacja: 2026-04-28

Konsolidacja: wdrożenie produkcyjne, provisioning sprzętu, monitoring i komunikacja MQTT.

---

## Wdrożenie

### Architektura produkcyjna

```
Internet
  │
  ▼
Cloudflare Tunnel (zero-trust, bez otwierania portów)
  │
  ▼
Proxmox LXC — Coolify
  ├── desk-backend     (NestJS)    → api.twoja-domena.pl
  ├── unified-panel    (React)     → app.twoja-domena.pl
  ├── PostgreSQL                   → wewnętrzny port
  └── Mosquitto (MQTT)             → port 1883
```

**Wymagania:** Proxmox VE 9.1+, LXC Debian 12 (4 CPU / 6 GB RAM / 80 GB), konto Cloudflare z domeną, repozytoria GitHub: `desk-panel`, `desk-gateway-python`, `desk-firmware`.

### Krok 1 — Coolify na LXC

```bash
apt update && apt install -y curl
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
# → Panel dostępny na http://IP_LXC:8000
```

### Krok 2 — Cloudflare Tunnel

W Coolify: **New Resource → Services → Cloudflare Tunnel**

W Cloudflare Dashboard → Zero Trust → Networks → Tunnels → Public Hostnames:
```
api.twoja-domena.pl   → HTTP → localhost:3000
app.twoja-domena.pl   → HTTP → localhost:80
```

### Krok 3 — PostgreSQL

```
Coolify → projekt desk → New Resource → Database → PostgreSQL 15
  Name: desk-postgres  |  User: admin  |  Database: desk
→ Deploy
```

### Krok 4 — Mosquitto

```
New Resource → Service → Mosquitto
  Name: desk-mqtt
environment:
  MQTT_USERNAME=backend
  MQTT_PASSWORD=twoje-haslo
  ALLOW_ANONYMOUS=false
→ Deploy
```

### Krok 5 — Backend NestJS

```
New Resource → Application → GitHub → desk-panel
  Base dir: /backend  |  Build Pack: Dockerfile

Environment Variables:
  DATABASE_URL        = postgresql://admin:HASLO@desk-postgres:5432/desk
  JWT_SECRET          = (openssl rand -hex 32)
  JWT_REFRESH_SECRET  = (openssl rand -hex 32)
  MQTT_BROKER_URL     = mqtt://mosquitto-XXXX:1883
  MQTT_USERNAME       = backend
  MQTT_PASSWORD       = twoje-haslo-mqtt
  PORT                = 3000
  NODE_ENV            = production
  CORS_ORIGINS        = https://app.twoja-domena.pl
  VAPID_PUBLIC_KEY    = (node generate-vapid-keys.js)
  VAPID_PRIVATE_KEY   = (node generate-vapid-keys.js)
  VAPID_SUBJECT       = mailto:admin@reserti.pl
  METRICS_ALLOWED_IPS = 127.0.0.1

Ports: 3000:3000  |  Connect To Predefined Network: ✓
→ Deploy
```

Inicjalizacja bazy po pierwszym deploymencie:
```bash
docker exec -it NAZWA_KONTENERA npx prisma migrate deploy
docker exec -it NAZWA_KONTENERA node dist/database/seeds/seed.js
```

### Krok 6 — Unified Panel

```
New Resource → Application → GitHub → desk-panel
  Base dir: /apps/unified  |  Build Pack: Dockerfile

Environment Variables:
  VITE_API_URL = https://api.twoja-domena.pl/api/v1

Ports: 3000:80  |  Domain: http://app.twoja-domena.pl
→ Deploy
```

### Weryfikacja

```
https://api.twoja-domena.pl/api/docs   → Swagger UI
https://app.twoja-domena.pl            → Panel logowania
```

**Konta testowe:**
```
owner@reserti.pl       / Owner1234!
superadmin@reserti.pl  / Admin1234!
admin@demo-corp.pl     / Admin1234!
staff@demo-corp.pl     / Staff1234!
user@demo-corp.pl      / User1234!
```

### Troubleshooting

| Problem | Przyczyna | Rozwiązanie |
|---------|-----------|-------------|
| `Failed to fetch` | Zły VITE_API_URL lub CORS | Ustaw CORS_ORIGINS i Redeploy frontendu |
| `ENOTFOUND hostname` | Sieć Docker | Włącz `Connect To Predefined Network` |
| Brak tabel w DB | Brak migracji | `docker exec ... npx prisma migrate deploy` |
| Mosquitto crash loop | Plik passwords istnieje | Usuń plik, popraw entrypoint w compose |

---

## Provisioning

### Provisioning Beacona ESP32

#### Przegląd procesu

```
1. Zmontuj hardware (ESP32 + PN532 + WS2812B)
2. Wgraj firmware (PlatformIO)
3. Zarejestruj beacon w panelu Admin → /desks → "+ Paruj beacon"
4. Sflashuj konfigurację przez serial (scripts/flash-config.py)
5. Beacon startuje, łączy się z MQTT, LED → zielony
```

#### Hardware

| Komponent | Model | Pin |
|-----------|-------|-----|
| Mikrokontroler | ESP32 (WROOM-32) | — |
| NFC/RFID reader | PN532 (I2C) | SDA=21, SCL=22, IRQ=4, RST=5 |
| LED strip | WS2812B | DATA=13 |
| Zasilanie | 5V / min. 1A | — |

#### Firmware

```bash
git clone https://github.com/reserti/desk-firmware
pip install platformio
pio run --target upload --upload-port /dev/ttyUSB0
pio device monitor --port /dev/ttyUSB0 --baud 115200
```

Po wgraniu: beacon wyświetla `PROVISIONING` (żółty pulse) i czeka na konfigurację przez serial.

#### Rejestracja w panelu

```
Admin Panel → Biurka → wybierz biurko → "+ Paruj beacon"
  Hardware ID: d-UNIKALNE-ID  (np. d-warsaw-a01)
  Gateway:     gw-warsaw-1
→ Utwórz
```

Panel zwróci (zapisz!):
```
DEVICE_ID  = d-warsaw-a01
MQTT_USER  = beacon-d-warsaw-a01
MQTT_PASS  = xxxxxxxxxxxxxxxx   ← JEDNORAZOWO
DESK_ID    = clxxxxxxxxxxxxxxxxxx
```

#### Flash konfiguracji

```bash
python3 scripts/flash-config.py \
  --port       /dev/ttyUSB0 \
  --device-id  d-warsaw-a01 \
  --desk-id    clxxxxxxxxxxxxxxxxxx \
  --wifi-ssid  "BiuroWiFi" \
  --wifi-pass  "haslo-wifi" \
  --mqtt-host  192.168.1.100 \
  --mqtt-port  1883 \
  --mqtt-user  beacon-d-warsaw-a01 \
  --mqtt-pass  xxxxxxxxxxxxxxxx
```

#### Weryfikacja

Po restarcie beacon: żółty pulse (WiFi) → żółty pulse (MQTT) → **zielony solid (FREE)** ✓

Panel Admin → Biurka → beacon powinien pokazać "Online".

#### Provisioning masowy (CSV)

```bash
# beacons.csv: device_id,desk_id,wifi_ssid,wifi_pass,mqtt_host,mqtt_user,mqtt_pass
python3 scripts/flash-config.py --csv beacons.csv --port /dev/ttyUSB0
```

#### Troubleshooting

| Problem | Przyczyna | Rozwiązanie |
|---------|-----------|-------------|
| LED miga czerwonym stale | Brak WiFi lub MQTT | Sprawdź hasło WiFi i dane MQTT |
| LED żółty na stałe | Provisioning mode | Wgraj konfigurację przez serial |
| `PROVISION_ERR:json_parse_failed` | Błędny JSON | Sprawdź skrypt flash-config.py |
| `PROVISION_ERR:nvs_write_failed` | Pełna pamięć NVS | `ERASE_NVS` przez serial |
| Beacon online ale nie check-inuje | Zły desk_id | Sprawdź desk_id w Admin → Biurka |

#### Reset do factory defaults

```bash
# Przez serial monitor:
ERASE_NVS
# Beacon wraca do żółtego pulse (PROVISIONING mode)
```

---

### Provisioning Gateway (Raspberry Pi)

Token instalacyjny generowany w panelu (`POST /gateway/setup-tokens`). Admin skanuje QR → Pi pobiera token i uruchamia kontenery.

<!-- TODO: zweryfikować — auto-setup.sh na Pi jest planowany (Faza 1 roadmap), aktualnie instalacja manualna -->

Aktualna instalacja manualna:
```bash
curl https://api.reserti.pl/install/gateway/TOKEN | bash
```

Plany rozwoju → `docs/roadmap.md` sekcja "Gateway Provisioning — Plan Rozwoju".

---

### Generowanie QR kodów dla biurek

```
Admin Panel → Biurka → przycisk "QR" → Modal z podglądem → "Kopiuj URL" lub "Drukuj QR"
```

URL struktury: `https://app.domena.pl/checkin/{qrToken}`

`qrToken` unikalny per biurko, generowany automatycznie (CUID), nie zmienia się chyba że biurko usunięte.

---

## Monitoring

### Architektura

```
NestJS Backend (port 3000)          Raspberry Pi Gateway (port 9100)
  GET /metrics                        GET /metrics
       │                                   │
       └──────────── Prometheus ───────────┘
                          │
                     Grafana Dashboards
```

### Backend — NestJS `/metrics`

Endpoint poza `/api/v1`, chroniony IP whitelist:
```env
METRICS_ALLOWED_IPS=127.0.0.1,<ip-prometheus-serwera>
```

#### Grupy metryk — Backend

| Metryka | Typ | Labele |
|---------|-----|--------|
| `reserti_http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` |
| `reserti_http_requests_total` | Counter | `method`, `route`, `status_code` |
| `reserti_http_errors_total` | Counter | `route`, `status_code` |
| `reserti_db_query_duration_seconds` | Histogram | `model`, `operation` |
| `reserti_db_errors_total` | Counter | `model`, `operation` |
| `reserti_mqtt_messages_received_total` | Counter | `topic_type` |
| `reserti_mqtt_messages_published_total` | Counter | `topic_type` |
| `reserti_organizations_total` | Gauge | `status` (active/inactive) |
| `reserti_gateways_total` | Gauge | `status` (online/offline) |
| `reserti_beacons_total` | Gauge | `status` (online/offline) |
| `reserti_desks_total` | Gauge | `org_id`, `location_id`, `status` |
| `reserti_desks_occupied_now` | Gauge | `org_id`, `location_id` |
| `reserti_reservations_today_total` | Gauge | `org_id`, `location_id`, `status` |
| `reserti_checkins_total` | Counter | `org_id`, `location_id`, `method` |
| `reserti_beacon_rssi_dbm` | Gauge | `org_id`, `location_id`, `device_id` |
| `reserti_beacon_last_seen_seconds` | Gauge | `org_id`, `location_id`, `device_id` |
| `reserti_gateway_last_seen_seconds` | Gauge | `org_id`, `gateway_id` |

### Gateway Python `/metrics` (port 9100)

```env
GATEWAY_METRICS_PORT=9100  # default
```

| Metryka | Typ | Labele |
|---------|-----|--------|
| `gateway_mqtt_messages_total` | Counter | `type` |
| `gateway_mqtt_connect_total` | Counter | `result` |
| `gateway_sync_total` | Counter | `result` |
| `gateway_sync_duration_seconds` | Histogram | — |
| `gateway_offline_queue_size` | Gauge | — |
| `gateway_beacon_last_seen_seconds` | Gauge | `hardware_id`, `desk_id` |
| `gateway_beacon_rssi_dbm` | Gauge | `hardware_id`, `desk_id` |
| `gateway_beacon_online` | Gauge (0/1) | `hardware_id`, `desk_id` |

### Prometheus scrape config

```yaml
scrape_configs:
  - job_name: 'reserti-backend'
    static_configs:
      - targets: ['api.domena.pl:443']
    scheme: https
    metrics_path: /metrics

  - job_name: 'reserti-gateway'
    static_configs:
      - targets:
          - '<pi-office-1-ip>:9100'
          - '<pi-office-2-ip>:9100'
    relabel_configs:
      - source_labels: [__address__]
        target_label: gateway_ip
```

### Dashboardy Grafana

| Dashboard | Grupa | Kluczowe panele |
|-----------|-------|-----------------|
| **System Health** | Owner | API p99 latency, error rate, DB query time, MQTT throughput |
| **Fleet Overview** | Owner | Gateway online/offline, beacon status per org, FW outdated |
| **Desk Analytics** | Client | Occupancy % w ciągu dnia, check-in metody, rezerwacje today |
| **IoT Health** | Client | RSSI trend, beacon uptime, sync lag, offline queue size |

**Separacja Owner/Client:** Metryki zawierają label `org_id`. Owner dashboardy — brak filtra; Client dashboardy — zmienna `$org_id` w Grafanie filtruje po labelu.

---

## MQTT

### Broker

| Property | Value |
|----------|-------|
| Implementation | Eclipse Mosquitto 2.x |
| Protocol | MQTT 3.1.1 |
| Port (plain) | 1883 |
| Port (WebSocket) | 9001 |
| QoS domyślne | 1 (at least once) |
| Auth | Username/password per klient |
| ACL | Per-topic per-klient (`infra/docker/mosquitto/acl`) |

### Identyfikatory klientów

| Klient | Username | Subskrybuje |
|--------|----------|-------------|
| Backend (NestJS) | `backend` | `desk/#`, `gateway/#`, `user/#` |
| Gateway | `gateway-{gatewayId}` | — |
| Beacon | `beacon-{hardwareId}` | — |

### Drzewo tematów

```
desk/
  {deskId}/
    checkin       beacon → gateway → server   (QoS 1)
    status        beacon → server              (QoS 1, co 30s)
    qr_scan       beacon → gateway             (QoS 1)
    command       server → gateway → beacon   (QoS 1)
    config        server → beacon             (QoS 1, retained)

gateway/
  {gatewayId}/
    hello         gateway → server            (QoS 1, retained)
    heartbeat     gateway → server            (QoS 1)
    status        LWT gateway                 (QoS 1, retained)

user/
  {userId}/
    event         server → PWA/mobile         (QoS 1)

system/
  broadcast       server → wszyscy            (QoS 0)
```

### Schematy payloadów

#### `desk/{deskId}/checkin` — beacon publikuje
```json
{
  "event_id":  "550e8400-e29b-41d4-a716-446655440000",
  "type":      "checkin",
  "device_id": "d-abc123",
  "desk_id":   "clxxxxxxxxxxxxxxxxxx",
  "timestamp": 1710000000,
  "method":    "nfc",
  "offline":   false,
  "card_uid":  "AA:BB:CC:DD",
  "rssi":      -62
}
```

#### `desk/{deskId}/command` — serwer publikuje
```json
{
  "command": "SET_LED",
  "params": { "color": "#00C800", "animation": "solid", "duration": 0 }
}
```

**Komendy:** `SET_LED` (color, animation, duration?), `REBOOT`, `IDENTIFY` (błysk biały 3×)

### Kolory LED

| Hex | Stan | Animacja |
|-----|------|----------|
| `#00C800` | Wolne | solid |
| `#0050DC` | Zarezerwowane | solid |
| `#DC0000` | Zajęte / błąd / denied | solid / blink |
| `#C8A000` | Łączenie / provisioning | pulse |
| `#C8C8C8` | IDENTIFY flash | solid (tymczasowy) |

### Flow check-in NFC (ścieżka MQTT)

```
1. Beacon      → desk/{deskId}/checkin         (card_uid, event_id)
2. Gateway     → weryfikuje w SQLite cache
3a. Match      → desk/{deskId}/command         (SET_LED #DC0000 solid)
               → POST /checkins/nfc            (async do serwera)
               → user/{userId}/event           (checkin_confirmed)
3b. Brak match → desk/{deskId}/command         (SET_LED #DC0000 blink 3s)
               → logi UNAUTHORIZED_SCAN
```

Gateway odpowiada beaconowi **natychmiast** z lokalnego cache. Latencja LED: ~15 ms.

### Strategia QoS

| Temat | QoS | Uzasadnienie |
|-------|-----|--------------|
| `desk/+/checkin` | 1 | Check-in nie może zaginąć |
| `desk/+/status` | 0 | Heartbeat — best effort, częsty |
| `desk/+/command` | 1 | Komenda LED musi dotrzeć |
| `desk/+/config` | 1 + retain | Config przeżywa restarty |
| `gateway/+/hello` | 1 + retain | Serwer widzi nawet po późnym połączeniu |
| `user/+/event` | 1 | Powiadomienie do użytkownika |

### Bezpieczeństwo MQTT

- Każdy klient ma unikalny login/hasło (brak anonymous)
- ACL ogranicza każdy beacon do własnych tematów `desk/{deskId}/*`
- Konto gateway może czytać/pisać wszystkie `desk/#`
- Konto backend ma pełny dostęp
- Produkcja: TLS port 8883, wyłącz plain 1883

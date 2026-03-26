# Architektura systemu — Desk Beacon System

## Przegląd

Trójwarstwowy system IoT do zarządzania zajętością biurek hot-desk.

```
┌─────────────────────────────────────────────────────────────────┐
│              WARSTWA 3 — SERWER GŁÓWNY (Coolify/cloud)          │
│                                                                 │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ Admin Panel   │  │  NestJS REST API │  │  PostgreSQL 15   │   │
│  │  React/Vite   │  │  + MQTT bridge   │  │  Prisma ORM      │   │
│  │  3 role        │  │  9 modułów       │  │  9 tabel         │   │
│  └──────────────┘  └─────────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌─────────────────┐                          │
│  │ Staff Panel   │  │   Mosquitto      │                         │
│  │  React/Vite   │  │   MQTT broker    │                         │
│  └──────────────┘  └─────────────────┘                          │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / MQTT
┌────────────────────────────▼────────────────────────────────────┐
│         WARSTWA 2 — GATEWAY (per biuro, on-premise)             │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Eclipse Mosquitto    │  │  Gateway Node.js                 │ │
│  │  MQTT broker lokalny  │  │  - SyncService (pull co 60s)    │ │
│  │  auth + ACL           │  │  - CacheService (SQLite WAL)    │ │
│  │  port 1883            │  │  - DeviceMonitor (heartbeat)    │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
└──────────┬────────────────────────┬──────────────────┬──────────┘
           │ MQTT/WiFi              │ MQTT/WiFi         │ MQTT/WiFi
   ┌───────▼──────┐       ┌────────▼─────┐    ┌────────▼─────┐
   │ Desk Beacon  │       │ Desk Beacon  │    │ Desk Beacon  │
   │ ESP32        │  ...  │ ESP32        │    │ ESP32        │
   │ NFC + LED    │       │ NFC + LED    │    │ NFC + LED    │
   └──────────────┘       └─────────────┘    └─────────────┘
```

---

## Warstwa 1 — Beacon (ESP32)

**Hardware:** ESP32 + PN532 (NFC/RFID) + WS2812B (LED)  
**Firmware:** C++ / Arduino framework / PlatformIO  
**Repo:** `desk-firmware`

### Odpowiedzialności
- Skanowanie kart NFC i publikowanie UID przez MQTT
- Wyświetlanie stanu biurka przez kolor/animację LED
- Odbieranie i wykonywanie komend (`SET_LED`, `REBOOT`, `IDENTIFY`)
- Wysyłanie heartbeatu co 30s z RSSI, uptime i wersją firmware
- Przechowywanie konfiguracji w NVS flash (przeżywa restarty)
- **Kolejka offline** — przy braku MQTT: zdarzenia NVS → flush po reconnect

### FSM (Finite State Machine)
```
BOOTING → PROVISIONING          (brak konfiguracji w NVS)
BOOTING → CONNECTING_WIFI
        → CONNECTING_MQTT
        → FREE

FREE ↔ RESERVED ↔ OCCUPIED      (driven by server SET_LED commands)
dowolny → ERROR                  (utrata WiFi/MQTT)
ERROR   → FREE                   (przywrócenie połączenia)
```

### Kolory LED per stan
| Stan | Kolor | Animacja |
|---|---|---|
| FREE | `#00C800` zielony | solid |
| RESERVED | `#0050DC` niebieski | solid |
| OCCUPIED | `#DC0000` czerwony | solid |
| ERROR | `#DC0000` czerwony | pulse |
| CONNECTING | `#C8A000` żółty | pulse |

---

## Warstwa 2 — Gateway

**Runtime:** Node.js / TypeScript  
**Platforma:** Raspberry Pi 4 lub mini PC (Ubuntu 22.04)  
**Repo:** `desk-gateway`

### Odpowiedzialności
- Lokalny broker MQTT (Mosquitto) dla wszystkich beaconów w biurze
- Cache rezerwacji w SQLite (dziś + jutro) — synchronizacja co 60s
- Weryfikacja check-inów z cache **bez round-tripu do serwera**
- Forwarding autoryzowanych check-inów do serwera (async, kolejka przy offline)
- Monitoring heartbeatów — brak sygnału → SET_LED ERROR

### Odporność offline
```
Gateway offline →
  Beacony → weryfikacja przez lokalny cache
  Zdarzenia → offline_events (SQLite)

Gateway reconnect →
  Flush offline_events → POST /checkins/nfc per event
  Serwer przetwarza wszystkie zaległe zdarzenia
```

Użytkownik nie odczuwa różnicy niezależnie od dostępności serwera.

---

## Warstwa 3 — Serwer główny

**Framework:** NestJS (TypeScript)  
**Baza danych:** PostgreSQL 15 + Prisma ORM  
**Repo:** `desk-panel`

### Moduły
```
auth            JWT (15 min) + rotacja refresh tokenów
organizations   Multi-tenant root (tylko Super Admin)
locations       Biura w ramach organizacji
desks           CRUD, mapa zajętości, tokeny QR
devices         Provisioning beaconów, heartbeat, komendy
gateways        Rejestracja gateway, API sync
reservations    CRUD z weryfikacją konfliktów
checkins        NFC / QR / ręczny — pełny audit trail
mqtt            Bridge do sieci MQTT gateway
users           Konta użytkowników, przypisanie kart NFC
```

**Source of truth:** Serwer przechowuje autorytatywny stan. Cache gateway to kopia read-through dla odporności offline.

---

## Flow check-in NFC (happy path, online)

```
t=0ms    Użytkownik przykłada kartę do beacona
t=5ms    Beacon czyta UID → MQTT: desk/{id}/checkin
t=8ms    Gateway odbiera wiadomość
t=10ms   Gateway → SQLite cache lookup → MATCH
t=12ms   Gateway → desk/{id}/command SET_LED #DC0000 ← LED zmienia się
t=13ms   Gateway → POST /checkins/nfc (async, non-blocking)
t=80ms   Serwer waliduje, tworzy rekord Checkin, loguje Event
t=82ms   Serwer → user/{userId}/event (checkin_confirmed)

Latencja odczuwana przez użytkownika: ~15ms (odpowiedź LED)
```

---

## Deployment produkcyjny

```
Cloudflare (DNS + Tunnel)
  ↓ HTTPS
Proxmox LXC — Coolify
  ├── desk-backend  (NestJS)  → api.domena.pl
  ├── front-admin   (nginx)   → admin.domena.pl
  ├── front-staff   (nginx)   → staff.domena.pl
  ├── PostgreSQL 15            → internal
  └── Mosquitto                → port 1883

Raspberry Pi (per biuro)
  └── desk-gateway             → MQTT local broker
```

Pełna instrukcja → [deployment.md](deployment.md)

---

## Bezpieczeństwo

| Obszar | Zabezpieczenie |
|---|---|
| MQTT auth | Per-device login/hasło, brak anonymous |
| MQTT ACL | Każdy beacon ograniczony do własnych tematów |
| API auth | JWT 15min + rotacja refresh tokenów |
| Gateway auth | `x-gateway-id` + `x-gateway-secret` |
| Hasła | bcrypt (rounds=10) |
| CORS | Whitelist origins (CORS_ORIGINS env var) |
| MQTT TLS | Port 8883 — zalecane w produkcji |
| NFC | UID karty — rozważyć NDEF/challenge-response dla wyższego bezpieczeństwa |

---

## QR Check-in — flow bez beacona

Alternatywny flow check-inu bez hardware ESP32. Działa na każdym telefonie z aparatem.

```
1. Admin generuje QR kod dla biurka (Admin Panel → Biurka → przycisk QR)
   URL: https://staff.domena.pl/checkin/{qrToken}
   Drukuje i klei na biurku

2. Użytkownik skanuje QR telefonem → otwiera się Staff Panel (mobilny)

3a. Biurko WOLNE:
    → przycisk "Zarezerwuj i zrób check-in"
    → POST /checkins/qr/walkin
    → backend: tworzy rezerwację (teraz → closeTime) + check-in w transakcji
    → sukces: "Biurko zostało zarezerwowane"

3b. MOJA rezerwacja:
    → przycisk "Check-in — potwierdź rezerwację"
    → POST /checkins/qr z qrToken rezerwacji
    → sukces: "Check-in udany!"

3c. Biurko ZAJĘTE przez kogoś innego:
    → "To biurko jest już zajęte. Wybierz inne biurko."
    → przycisk do mapy biurek

4. Czas check-inu zapisywany na rezerwacji (checkedInAt + checkedInMethod)
```

**Godziny pracy biura** (`Location.openTime` / `Location.closeTime`):
- Konfigurowane przez Super Admin: Biura → ⏰ Godziny
- Walk-in kończy się o `closeTime` (domyślnie 17:00)
- Walk-in po `closeTime` jest zablokowany
- Jeśli ktoś ma rezerwację w godzinach pracy → walk-in kończy się 5 min przed nią

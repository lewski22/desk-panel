# Reserti Desk Management — Kontekst dla narzędzi AI

> Ten plik zawiera pełny kontekst systemu dla innych modeli AI.
> Aktualizuj po każdej większej zmianie architektury.
> Ostatnia aktualizacja: 2026-03-30

---

## Czym jest Reserti

SaaS do zarządzania hot-deskami w biurach. Firma rezerwuje biurko przez przeglądarkę
lub Microsoft Teams, fizycznie przy biurku stoi beacon ESP32 z LED i czytnikiem NFC.

---

## Repozytoria

| Repo | URL | Opis |
|---|---|---|
| `desk-panel` | github.com/lewski22/desk-panel | Backend + Admin Panel + Staff Panel |
| `desk-gateway` | github.com/lewski22/desk-gateway | MQTT bridge lokalny w biurze |
| `desk-firmware` | github.com/lewski22/desk-firmware | Firmware ESP32 |

---

## Architektura systemu

```
┌─────────────────────────────────────────────────────────┐
│                    INTERNET / CLOUD                       │
│                                                           │
│  ┌──────────────┐    ┌────────────────────────────────┐  │
│  │ Admin Panel  │    │       desk-panel backend        │  │
│  │ React/Vite   │◄──►│   NestJS + Prisma + PostgreSQL │  │
│  │ admin.*      │    │   api.prohalw2026.ovh/api/v1   │  │
│  └──────────────┘    └────────────────────────────────┘  │
│  ┌──────────────┐              ▲                          │
│  │ Staff Panel  │              │ HTTPS sync               │
│  │ React/Vite   │              │ (co 60s)                 │
│  │ staff.*      │              ▼                          │
│  └──────────────┘    ┌────────────────────────────────┐  │
│                       │   Coolify (Proxmox LXC)        │  │
│                       │   + Cloudflare Tunnel          │  │
└───────────────────────┤                                ├──┘
                        └────────────────────────────────┘
                                    ▲
                                    │ HTTPS
                         ┌──────────┴──────────┐
                         │  SIEĆ LOKALNA BIURA  │
                         │                      │
                         │  ┌────────────────┐  │
                         │  │ Raspberry Pi   │  │
                         │  │ desk-gateway   │  │
                         │  │ + Mosquitto    │  │
                         │  │ 192.168.x.x    │  │
                         │  └───────┬────────┘  │
                         │          │ MQTT 1883  │
                         │          ▼            │
                         │  ┌────────────────┐  │
                         │  │  ESP32 Beacon  │  │
                         │  │  NFC + LED     │  │
                         │  └────────────────┘  │
                         └──────────────────────┘
```

---

## Stack technologiczny

### Backend (desk-panel/backend)
- **NestJS** + TypeScript
- **Prisma ORM** + PostgreSQL 15
- **JWT auth** (15min access + 7d refresh token rotation)
- **MQTT** przez bibliotekę `mqtt` (połączenie z lokalnym Mosquitto)
- Deploy: **Coolify** na Proxmox LXC + Cloudflare Tunnel

### Frontend Admin (desk-panel/apps/admin)
- React + Vite + TypeScript + Tailwind CSS
- Brak zewnętrznych komponentów UI (własne w `ui.tsx`)
- Recharts dla wykresów
- Token auth: `localStorage` (`admin_access`, `admin_refresh`, `admin_user`)

### Frontend Staff (desk-panel/apps/staff)
- React + Vite + TypeScript + Tailwind CSS
- Token auth: `localStorage` (`access_token`, `refresh_token`, `staff_user`)
- QR check-in: `/checkin/:token` — działa na mobile bez instalacji

### Gateway (desk-gateway)
- Node.js 20 + TypeScript
- `mqtt` lib dla połączenia z Mosquitto
- `better-sqlite3` dla lokalnego cache (offline support)
- HTTP API na porcie 3001 (zarządzanie MQTT users)
- Deploy: Docker Compose na Raspberry Pi

### Firmware (desk-firmware)
- PlatformIO + Arduino framework
- ESP32 DevKit V1
- Biblioteki: PubSubClient, Adafruit PN532, Adafruit NeoPixel, ArduinoJson
- NVS (Preferences) dla persystentnej konfiguracji
- Offline queue: do 20 zdarzeń w NVS

---

## Model danych (kluczowe encje)

```
Organization (firma)
  └── Location / "Biuro" (fizyczne biuro)
        ├── openTime: "08:00"  ← godziny pracy
        ├── closeTime: "17:00"
        ├── Desk[] (biurka)
        │     ├── qrToken (unikalny, do QR check-in)
        │     └── Device? (beacon ESP32)
        └── Gateway[] (Raspberry Pi)

User
  ├── role: SUPER_ADMIN | OFFICE_ADMIN | STAFF | END_USER
  ├── organizationId
  ├── cardUid (karta NFC)
  └── azureObjectId (M365 SSO - planowane)

Reservation
  ├── deskId, userId
  ├── date, startTime, endTime
  ├── status: PENDING | CONFIRMED | CANCELLED | EXPIRED
  ├── qrToken (do QR check-in)
  ├── checkedInAt, checkedInMethod: NFC | QR | MANUAL

Checkin
  ├── reservationId?, deskId, userId
  ├── method: NFC | QR | MANUAL
  └── checkedOutAt?

Gateway
  ├── locationId, secretHash
  ├── isOnline, lastSeen, ipAddress

Device (beacon ESP32)
  ├── hardwareId, gatewayId, deskId?
  ├── mqttUsername, mqttPasswordHash
  └── isOnline, lastSeen, rssi, firmwareVersion
```

---

## Role użytkowników

| Rola | Panel | Uprawnienia |
|---|---|---|
| `SUPER_ADMIN` | Admin | Wszystkie organizacje, pełny dostęp |
| `OFFICE_ADMIN` | Admin | Jedna organizacja, pełny zarząd |
| `STAFF` | Staff | Podgląd + ręczny check-in/out |
| `END_USER` | Staff | Własne rezerwacje, QR check-in, tylko wolne biurka |

---

## Kluczowe endpointy API

```
Auth:
POST /auth/login         { email, password } → { accessToken, refreshToken, user }
POST /auth/refresh       { refreshToken }    → { accessToken, refreshToken, user }
POST /auth/logout        { refreshToken }

Lokalizacje:
GET  /locations                     ← OFFICE_ADMIN widzi tylko swoją org
POST /locations                     { organizationId, name, openTime, closeTime }
PATCH /locations/:id                { openTime, closeTime, ... }

Biurka:
GET  /locations/:id/desks
POST /locations/:id/desks           { name, code, floor, zone }
GET  /desks/qr/:token               ← PUBLICZNY (bez auth)
PATCH /desks/:id/unpair

Rezerwacje:
GET  /reservations                  ?locationId=&userId=&date=&status=
POST /reservations                  { deskId, date, startTime, endTime }
DELETE /reservations/:id            (cancel)

Check-in:
POST /checkins/qr                   { deskId, qrToken }          ← JWT required
POST /checkins/qr/walkin            { deskId }                   ← JWT required
POST /checkins/manual               { deskId, userId, reservationId? }
PATCH /checkins/:id/checkout

Gateway:
POST /gateway/register              { locationId, name }         → { gateway, secret }
POST /gateway/:id/sync              ← wywołane przez gateway
POST /gateway/:id/heartbeat

Devices:
POST /devices/provision             { hardwareId, gatewayId, deskId? }
                                    → { device, mqttUsername, mqttPassword }
```

---

## Zmienne środowiskowe

### Backend (.env)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
MQTT_BROKER_URL=mqtt://mosquitto-SERVICE_NAME:1883
CORS_ORIGINS=https://admin.domain.pl,https://staff.domain.pl
GATEWAY_PROVISION_KEY=...   # klucz do gateway HTTP API
PORT=3000
```

### Gateway (.env)
```env
GATEWAY_ID=...              # ID z panelu Admin
GATEWAY_SECRET=...          # secret z panelu Admin
LOCATION_ID=...             # ID biura z panelu Admin
SERVER_URL=https://api.domain.pl/api/v1
MQTT_BROKER_URL=mqtt://mosquitto:1883
MQTT_USERNAME=backend       # WAŻNE: username usera w lokalnym Mosquitto
MQTT_PASSWORD=...
CACHE_DB_PATH=./data/cache.db
GATEWAY_PROVISION_KEY=...   # musi być taki sam jak w backendzie
```

### Firmware (przez PROVISION: komendę serial)
```json
{
  "wifi_ssid": "...",
  "wifi_pass": "...",
  "mqtt_host": "192.168.x.x",    ← IP Raspberry Pi
  "mqtt_port": 1883,
  "mqtt_user": "backend",         ← MQTT_USERNAME z gateway .env
  "mqtt_pass": "...",             ← MQTT_PASSWORD z gateway .env
  "device_id": "...",             ← dowolny unikalny ID
  "desk_id": "",                  ← opcjonalnie ID biurka
  "gateway_id": "..."             ← GATEWAY_ID z gateway .env
}
```

---

## Znane problemy i decyzje techniczne

### Cloudflare Tunnel nie obsługuje raw TCP
MQTT (port 1883) **nie może** przechodzić przez Cloudflare Tunnel.
Beacon MUSI łączyć się z Mosquitto na lokalnym IP (np. `192.168.101.237`).

### Raspberry Pi 1 B+ — NIEKOMPATYBILNY
ARMv6 architektura. Node.js 20, Docker, better-sqlite3 — **nie działają** na ARMv6.
Wymagane: RPi 3B+, RPi 4, RPi Zero 2W (wszystkie ARM64/ARMv7).

### better-sqlite3 wymaga kompilacji native
W Dockerfile musi być `python3 make g++` w builder stage.
Rozwiązanie: `npm prune --production` w builderze + `COPY node_modules` do production.
Nie instaluj ponownie w production stage.

### JWT validate musi sprawdzać isActive
`jwt.strategy.ts` odpytuje DB przy każdym request — inaczej dezaktywowani użytkownicy
mogą używać stale tokenów.

### Provisioning MQTT users — flow
1. Admin Panel → + Provisioning → backend generuje `mqttUsername` + `mqttPassword`
2. Backend wywołuje `POST http://PI_IP:3001/beacon/add` (gateway HTTP API)
3. Gateway dodaje usera do Mosquitto passwd + ACL + SIGHUP reload
4. Admin prowizjonuje ESP32 przez monitor serialny z tymi credentials

---

## Firmware — komendy serial (115200 baud)

```
PROVISION:{"wifi_ssid":"...","wifi_pass":"...","mqtt_host":"IP","mqtt_port":1883,
           "mqtt_user":"backend","mqtt_pass":"...","device_id":"...","gateway_id":"..."}
RESET           ← czyści NVS, restart w trybie PROVISIONING
```

Przez MQTT (gdy już połączony):
```
REBOOT          ← restart
IDENTIFY        ← miga białym LED (znajdowanie fizyczne)
FACTORY_RESET   ← czyści NVS + restart
```

---

## MQTT topics

```
desk/{deskId}/checkin    beacon → gateway (event NFC scan)
desk/{deskId}/status     beacon → gateway (heartbeat co 30s)
desk/{deskId}/command    gateway → beacon (SET_LED, REBOOT, IDENTIFY)
gateway/{gwId}/hello     gateway → backend (gateway online)
```

---

## Deployment (Coolify na Proxmox)

Serwisy w Coolify:
- `desk-postgres` — PostgreSQL 15
- `desk-mqtt` — Mosquitto (wewnętrzny broker backendu)
- `desk-backend` — NestJS API
- `front-admin` — React Admin Panel (nginx)
- `front-staff` — React Staff Panel (nginx)
- `cloudflared` — Cloudflare Tunnel

Adresy produkcyjne:
- API: `https://api.prohalw2026.ovh/api/v1`
- Admin: `https://admin.prohalw2026.ovh`
- Staff: `https://staff.prohalw2026.ovh`
- Swagger: `https://api.prohalw2026.ovh/api/docs`

---

## Konta testowe

| Email | Hasło | Rola |
|---|---|---|
| `superadmin@reserti.pl` | `Admin1234!` | SUPER_ADMIN |
| `admin@demo-corp.pl` | `Admin1234!` | OFFICE_ADMIN |
| `staff@demo-corp.pl` | `Staff1234!` | STAFF |
| `user@demo-corp.pl` | `User1234!` | END_USER |

---

## Planowane funkcje (roadmap)

1. **M365 integracja** — Entra ID SSO + Outlook Add-in + Teams App
2. **Gateway QR token** — auto-konfiguracja Pi przez jednorazowy token z panelu
3. **Dedykowany OS image** — RPi Imager z preinstalowanym gatewayem
4. **Web Serial provisioning ESP32** — flash config przez przeglądarkę (Chrome Web Serial API)
5. **Cloud MQTT** — brak potrzeby lokalnego Pi (MQTT over TLS na mqtt.reserti.pl)

Szczegóły: `docs/gateway-provisioning-roadmap.md`, `docs/roadmap.md`

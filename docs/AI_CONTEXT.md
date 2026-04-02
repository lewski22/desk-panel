# Reserti Desk Management — Kontekst dla narzędzi AI

> Pełny kontekst systemu dla narzędzi AI.
> Ostatnia aktualizacja: 2026-03-31

---

## Czym jest Reserti

SaaS do zarządzania hot-deskami w biurach. Pracownicy rezerwują biurka przez
przeglądarkę lub Microsoft Teams. Przy każdym biurku stoi beacon ESP32 z LEDem
i czytnikiem NFC — umożliwia check-in przez kartę lub kod QR bez telefonu.

---

## Repozytoria

| Repo | URL | Opis |
|---|---|---|
| `desk-panel` | github.com/lewski22/desk-panel | Backend + Admin + Staff + Owner + Outlook Add-in |
| `desk-gateway` | github.com/lewski22/desk-gateway | Node.js MQTT bridge (legacy) |
| `desk-gateway-python` | github.com/lewski22/desk-gateway-python | Python gateway (aktualny) |
| `desk-firmware` | github.com/lewski22/desk-firmware | Firmware ESP32 |

---

## Architektura systemu

```
┌─────────────────────────────────────────────────────────────┐
│                       INTERNET / CLOUD                       │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │ Owner Panel │  │ Admin Panel │  │   Staff Panel     │   │
│  │ React/Vite  │  │ React/Vite  │  │   React/Vite      │   │
│  │ owner.*     │  │ admin.*     │  │   staff.*         │   │
│  └──────┬──────┘  └──────┬──────┘  └─────────┬─────────┘   │
│         └────────────────┼──────────────────┘             │
│                          ▼                                   │
│              ┌───────────────────────────┐                  │
│              │    desk-panel backend     │                  │
│              │  NestJS + Prisma + PG 15  │                  │
│              │  api.prohalw2026.ovh/v1   │                  │
│              │  + @nestjs/throttler      │                  │
│              │  + @nestjs/schedule       │                  │
│              └───────────────────────────┘                  │
│                          │                                   │
│              ┌───────────────────────────┐                  │
│              │  Coolify (Proxmox LXC)    │                  │
│              │  + Cloudflare Tunnel      │                  │
└──────────────┴───────────────────────────┴──────────────────┘
                           ▲ HTTPS
            ┌──────────────┴──────────────┐
            │      SIEĆ LOKALNA BIURA     │
            │  ┌─────────────────────┐    │
            │  │   Raspberry Pi 4+   │    │
            │  │  desk-gateway-python│    │
            │  │  + Mosquitto MQTT   │    │
            │  └──────────┬──────────┘    │
            │             │ MQTT 1883     │
            │             ▼               │
            │  ┌─────────────────────┐    │
            │  │    ESP32 Beacon     │    │
            │  │    NFC + WS2812     │    │
            │  └─────────────────────┘    │
            └─────────────────────────────┘
```

---

## Stack technologiczny

### Backend (`desk-panel/backend`)
- **NestJS** 10 + TypeScript (strict)
- **Prisma** 5 + PostgreSQL 15
- **JWT** (15min access + 7d refresh rotation)
- **@nestjs/throttler** — rate limiting (global + per endpoint)
- **@nestjs/schedule** — cron job `expireOld()` co 15 min
- **jwks-rsa + jsonwebtoken** — weryfikacja Azure JWKS
- **ConfigService** wszędzie zamiast `process.env`
- Deploy: Coolify → Proxmox LXC + Cloudflare Tunnel

### Frontend Admin (`apps/admin/`)
- React + Vite + TypeScript + Tailwind CSS
- Własne komponenty w `ui.tsx` (Btn, Modal, Card, Badge…)
- Recharts dla wykresów
- `tryRefresh()` przy 401 — auto-odnowienie tokenu
- localStorage: `access_token`, `refresh_token`, `admin_user`

### Frontend Staff (`apps/staff/`)
- React + Vite + TypeScript + Tailwind CSS
- `tryRefresh()` przy 401
- Logowanie przez Entra ID (przycisk "Zaloguj przez Entra ID")
- localStorage: `access_token`, `refresh_token`, `staff_user`

### Frontend Owner (`apps/owner/`) ← NOWY
- React + Vite + TypeScript + Tailwind CSS + Recharts
- Osobna aplikacja — TYLKO rola OWNER
- `ownerApi` z `tryRefresh()` — localStorage: `owner_access`, `owner_refresh`, `owner_user`
- Domena: `owner.prohalw2026.ovh`

### Outlook Add-in (`apps/outlook/`)
- React + Vite + HTTPS (basicSsl)
- `@azure/msal-browser` — PKCE flow
- UUID manifestu: `cf93f4bf-3bcb-406b-9a5a-7a3e1294aa09`
- Domena: `outlook.prohalw2026.ovh`

### Gateway Python (`desk-gateway-python`) — aktualny
- Python 3.8+ + paho-mqtt + requests + sqlite3 (stdlib)
- Systemd service: `reserti-gateway`
- Instalacja: `curl -fsSL https://api.prohalw2026.ovh/install/gateway/TOKEN | bash`
- Klasy: `Cache`, `SyncService`, `MqttBridge`, `DeviceMonitor`, `MqttAdmin`, `GatewayApiHandler`

### Firmware (`desk-firmware`)
- PlatformIO + Arduino, ESP32 DevKit V1
- PubSubClient, Adafruit PN532, Adafruit NeoPixel, ArduinoJson
- NVS dla konfiguracji, offline queue do 20 zdarzeń

---

## Model danych (kluczowe encje)

```
Organization (firma-klient)
  ├── plan: starter | pro | enterprise
  ├── planExpiresAt, trialEndsAt
  ├── notes, contactEmail, createdBy (Owner)
  ├── azureTenantId, azureEnabled (M365 SSO)
  └── Location[] / "Biuro"
        ├── openTime, closeTime
        ├── Desk[]
        │     ├── qrToken
        │     └── Device? (beacon ESP32)
        ├── Gateway[]
        └── GatewaySetupToken[]   ← tokeny instalacyjne

User
  ├── role: OWNER | SUPER_ADMIN | OFFICE_ADMIN | STAFF | END_USER
  ├── organizationId (null dla OWNER)
  ├── cardUid (karta NFC)
  ├── azureObjectId (M365 SSO JIT provisioning)
  └── azureTenantId

Reservation
  ├── deskId, userId, date, startTime, endTime
  ├── status: PENDING | CONFIRMED | CANCELLED | EXPIRED
  ├── qrToken
  └── checkedInAt, checkedInMethod: NFC | QR | MANUAL

GatewaySetupToken
  ├── token (cuid, jednorazowy)
  ├── locationId  ← @@index
  ├── expiresAt (24h)
  └── usedAt (null = nie użyty)
```

---

## Role użytkowników — pełna hierarchia

| Rola | Panel | Uprawnienia |
|---|---|---|
| `OWNER` | Owner Panel | Wszystkie organizacje, impersonacja SUPER_ADMIN, metryki platformy |
| `SUPER_ADMIN` | Admin Panel | Jedna organizacja — pełny dostęp |
| `OFFICE_ADMIN` | Admin Panel | Jedno biuro — zarządzanie |
| `STAFF` | Staff Panel | Podgląd + ręczny check-in/out |
| `END_USER` | Staff Panel | Własne rezerwacje, QR check-in |

---

## Kluczowe endpointy API

### Auth
```
POST /auth/login             { email, password } → tokens + user
POST /auth/refresh           { refreshToken }    → tokens
POST /auth/logout            { refreshToken }
POST /auth/azure             { idToken }         → tokens + user (JIT provisioning)
GET  /auth/azure/check       ?email=             → { available, tenantId }
PATCH /auth/change-password  { currentPassword, newPassword } → 204 (JWT required)
```

### Owner (`/owner/*`) — tylko OWNER
```
GET  /owner/organizations               lista firm z metrykami
POST /owner/organizations               utwórz firmę + SUPER_ADMIN (transakcja)
GET  /owner/organizations/:id           szczegóły: biura, gateway, beacony, eventy
PATCH /owner/organizations/:id          plan, status, notatki
DELETE /owner/organizations/:id         soft delete (isActive=false)
POST /owner/organizations/:id/impersonate  JWT 30min jako SUPER_ADMIN + audit log
GET  /owner/health                      globalny stan IoT (gateway + beacony)
GET  /owner/health/:orgId               stan jednej firmy
GET  /owner/stats                       metryki: firmy, gateway, beacony, check-iny
```

### Lokalizacje / Biura
```
GET  /locations                         OFFICE_ADMIN: tylko własna org
POST /locations                         { organizationId, name, openTime, closeTime }
PATCH /locations/:id
```

### Gateway
```
POST /gateway/setup-tokens              { locationId } → { token, installCmd }
POST /gateway/setup/:token              { gatewayName } — jednorazowe, 24h ważność
GET  /install/gateway/:token            bash wrapper z wstrzykniętym tokenem + API URL
POST /gateway/:id/sync / heartbeat
```

### Devices (beacony)
```
POST /devices/provision                 { hardwareId, gatewayId, deskId? }
GET  /devices, PATCH, DELETE
```

### Outlook Add-in
```
GET  /desks/available                   ?locationId&startTime&endTime → wolne biurka
GET  /reservations/my                   JWT → moje rezerwacje (max 100, domyślnie 50)
```

---

## Zmienne środowiskowe backendu

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
MQTT_BROKER_URL=mqtt://mosquitto-NAME:1883
CORS_ORIGINS=https://admin.prohalw2026.ovh,https://staff.prohalw2026.ovh
GATEWAY_PROVISION_KEY=...
PUBLIC_API_URL=https://api.prohalw2026.ovh/api/v1
ADMIN_URL=https://admin.prohalw2026.ovh
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_REDIRECT_URI=https://api.prohalw2026.ovh/auth/azure/callback
GATEWAY_INSTALL_SCRIPT_URL=https://raw.githubusercontent.com/lewski22/desk-gateway-python/main/install.sh
```

---

## Deployment (Coolify na Proxmox)

### Serwisy

| Serwis | Źródło | Domena |
|---|---|---|
| `desk-postgres` | PostgreSQL 15 | wewnętrzny |
| `desk-mqtt` | Mosquitto | wewnętrzny |
| `desk-backend` | `backend/` | api.prohalw2026.ovh |
| `front-admin` | `apps/admin/` | admin.prohalw2026.ovh |
| `front-staff` | `apps/staff/` | staff.prohalw2026.ovh |
| `front-owner` | `apps/owner/` | owner.prohalw2026.ovh ← NOWY |
| `front-unified` | `apps/unified/` | app.prohalw2026.ovh ← NOWY |
| `front-outlook` | `apps/outlook/` | outlook.prohalw2026.ovh |

### CMD backendu przy starcie kontenera
```
prisma db push --accept-data-loss
  → node dist/database/seeds/seed.js   (upsert — idempotentny)
    → node dist/main
```

---

## Konta testowe

| Email | Hasło | Rola |
|---|---|---|
| `owner@reserti.pl` | `Owner1234!` | OWNER |
| `superadmin@reserti.pl` | `Admin1234!` | SUPER_ADMIN |
| `admin@demo-corp.pl` | `Admin1234!` | OFFICE_ADMIN |
| `staff@demo-corp.pl` | `Staff1234!` | STAFF |
| `user@demo-corp.pl` | `User1234!` | END_USER |

---

## Logowanie — dwa niezależne flow

### Email + hasło (domyślny)
```
Formularz email/password → POST /auth/login → JWT
Zero requestów w tle przy wpisywaniu — zero ryzyka "Failed to fetch"
```

### Entra ID SSO (osobny przycisk)
```
Klik "Zaloguj przez Entra ID"
  → Modal: wpisz email firmowy
    → GET /auth/azure/check?email=...
      → available: false → komunikat błędu w modalu
      → available: true  → MSAL loginPopup (tenant-specific)
        → idToken → POST /auth/azure → JWT
```
Przycisk zawsze widoczny — nie pojawia się dynamicznie.
Błąd z backendu może się pojawić TYLKO w modalu Entra ID.

---

## Impersonation Owner → Admin

```
Owner: kliknij "Wejdź jako Admin" przy firmie
  → POST /owner/organizations/:id/impersonate
    Backend:
      1. Sprawdź role === OWNER (OwnerGuard)
      2. Znajdź pierwszego aktywnego SUPER_ADMIN w org
      3. Zapisz Event(OWNER_IMPERSONATION, { ownerId, orgId, ip, at })
      4. Generuj JWT 30min { sub, role: SUPER_ADMIN, orgId, impersonated: true }
    Odpowiedź: { token, expiresAt, adminUrl, orgName }
  → Owner Panel otwiera admin.prohalw2026.ovh/auth/impersonate?token=...
    Admin Panel: ImpersonatePage dekoduje JWT, zapisuje admin_impersonated=true
    AdminLayout: amber baner "Sesja tymczasowa 30 min, wszystko logowane"
```

---

## Znane ograniczenia i decyzje techniczne

### MQTT nie przechodzi przez Cloudflare Tunnel
Beacon musi łączyć się bezpośrednio z Mosquitto na IP lokalnym (192.168.x.x).

### Raspberry Pi 1 B+ — niekompatybilny
ARMv6 — nie obsługuje Node.js 20, Docker, better-sqlite3.
Wymagane: RPi 3B+, RPi 4, RPi Zero 2W (ARMv7/ARM64).

### prisma db push zamiast migrate deploy
Brak folderu `migrations/` — schemat synchronizowany przez `db push`.
`--accept-data-loss` bezpieczny gdy nowe pola są nullable.

### Seed uruchamiany automatycznie przy każdym starcie
`node dist/database/seeds/seed.js` w CMD Dockerfile.
Upsert jest idempotentny — nie duplikuje danych.

### ConfigService zamiast process.env
Wszystkie env vars dostępne przez `this.config.get<string>('KEY')`.
Dotyczy: DevicesService, InstallController, OwnerService, AzureAuthService.

### ReservationStatus enum zamiast string literals
`ReservationStatus.CANCELLED`, `.PENDING` itd. zamiast `'CANCELLED'`.
TypeScript wykryje literówki w czasie kompilacji.

# Reserti — Desk Management System

**SaaS do zarządzania hot-deskami z IoT beaconami** (ESP32 + NFC + LED).  
Pracownicy rezerwują biurka przez panel webowy lub Microsoft Teams.  
Beacon przy biurku obsługuje check-in kartą NFC lub kodem QR z telefonu.

---

## Repozytoria systemu

| Repo | URL | Opis |
|------|-----|------|
| `desk-panel` | github.com/lewski22/desk-panel | Backend NestJS + Unified Panel (React) |
| `desk-gateway-python` | github.com/lewski22/desk-gateway-python | Gateway Python (Raspberry Pi) |
| `desk-firmware` | github.com/lewski22/desk-firmware | Firmware ESP32 (PlatformIO) |

**Produkcja:**
- API: `https://api.prohalw2026.ovh/api/v1`
- App (Unified): `https://app.prohalw2026.ovh`
- Owner: `https://owner.prohalw2026.ovh`
- Deploy: Coolify na Proxmox LXC + Cloudflare Tunnel

---

## Architektura systemu

```
┌─────────────────────────────────────────────────────────────────┐
│  CLOUD                                                           │
│                                                                  │
│  ┌──────────────────────────────────────────────┐              │
│  │  desk-panel (Coolify)                         │              │
│  │  ┌─────────────┐  ┌────────────────────────┐ │              │
│  │  │ Backend     │  │ Unified Panel           │ │              │
│  │  │ NestJS      │  │ React + Vite + Tailwind │ │              │
│  │  │ Prisma/PG15 │  │ app.prohalw2026.ovh     │ │              │
│  │  │ MQTT client │  └────────────────────────┘ │              │
│  │  └──────┬──────┘                              │              │
│  └─────────┼───────────────────────────────────--┘              │
│            │ HTTPS + MQTT (Cloudflare Tunnel)                    │
└────────────┼────────────────────────────────────────────────────┘
             │
┌────────────┼────────────────────────────────────────────────────┐
│  SIEĆ LOKALNA BIURA                                              │
│            │                                                     │
│  ┌─────────▼──────────────────────────────┐                    │
│  │  Raspberry Pi 3B+/4/Zero 2W            │                    │
│  │  ┌─────────────────┐  ┌─────────────┐  │                    │
│  │  │ desk-gateway    │  │ Mosquitto   │  │                    │
│  │  │ Python/systemd  │  │ MQTT broker │  │                    │
│  │  └────────┬────────┘  └──────┬──────┘  │                    │
│  └───────────┼──────────────────┼──────────┘                    │
│              │ MQTT             │ MQTT                           │
│    ┌─────────▼──────────────────▼──────────┐                    │
│    │  ESP32 Beacony (per biurko)            │                    │
│    │  WS2812B LED + PN532 NFC + WiFi        │                    │
│    └────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Struktura repo

```
desk-panel/
├── backend/                    NestJS REST API + MQTT bridge
│   ├── src/
│   │   ├── modules/            Moduły domenowe
│   │   │   ├── auth/           JWT + rotacja tokenów + SSO Entra ID
│   │   │   ├── organizations/  Multi-tenant (Super Admin)
│   │   │   ├── locations/      Biura w ramach organizacji
│   │   │   ├── desks/          CRUD, mapa zajętości, tokeny QR
│   │   │   ├── devices/        Provisioning beaconów, heartbeat
│   │   │   ├── gateways/       Rejestracja gateway, setup tokeny
│   │   │   ├── reservations/   CRUD + weryfikacja konfliktów + LED event
│   │   │   ├── checkins/       NFC / QR / ręczny + checkout + LED event
│   │   │   ├── users/          Konta, NFC card assignment
│   │   │   └── owner/          Panel operatora (Owner role)
│   │   ├── mqtt/               MQTT Service + Handlers (NFC events)
│   │   │   └── topics.ts       Definicje topicków + LED payloads
│   │   ├── shared/             Shared module (global)
│   │   │   └── led-events.service.ts  Rxjs Subject — event bus LED
│   │   ├── database/           Prisma + seed
│   │   └── app.module.ts
│   ├── prisma/
│   │   ├── schema.prisma       Model bazy danych
│   │   └── migrations/
│   └── Dockerfile
│
├── apps/
│   └── unified/                Unified Panel — jedna app dla wszystkich ról
│       ├── src/
│       │   ├── pages/          Login, Dashboard, Desks, Reservations,
│       │   │                   Users, Provisioning, DeskMap, MyReservations,
│       │   │                   Reports, Organizations, QrCheckin, ChangePassword
│       │   ├── components/
│       │   │   ├── desks/      DeskMap, DeskCard (hideActions prop)
│       │   │   ├── layout/     AppLayout (mobile sidebar drawer)
│       │   │   └── ui.tsx      Shared UI components (Table, Modal, Btn...)
│       │   ├── api/client.ts   API client (wszystkie endpointy)
│       │   ├── hooks/          useDesks (polling co 30s)
│       │   ├── types/          DeskMapItem, Reservation, ...
│       │   └── utils/
│       │       └── date.ts     localDateStr(), localDateTimeISO()
│       └── Dockerfile
│
├── docs/
│   ├── AI_CONTEXT.md           ← Kontekst dla narzędzi AI (ten plik)
│   ├── roadmap.md              Roadmapa i planowane funkcje
│   ├── changelog.md            Historia zmian
│   ├── architecture.md         Architektura techniczna
│   ├── api.md                  REST API reference
│   ├── mqtt.md                 MQTT specyfikacja
│   ├── provisioning.md         Provisioning beaconów
│   └── deployment.md           Wdrożenie produkcyjne
│
└── docker-compose.yml          Lokalny dev stack
```

---

## Role użytkowników

| Rola | Dostęp | Uprawnienia |
|------|--------|-------------|
| **OWNER** | `/owner` | Operator platformy — zarządza wszystkimi klientami |
| **SUPER_ADMIN** | `/app` | Pełny dostęp do jednej organizacji + provisioning |
| **OFFICE_ADMIN** | `/app` | Biurka, użytkownicy, rezerwacje, raporty |
| **STAFF** | `/app` | Mapa + check-in/out ręczny, urządzenia |
| **END_USER** | `/app` + QR | Mapa biurek, rezerwacje, QR check-in |

---

## Konta testowe (seed)

| Email | Hasło | Rola |
|-------|-------|------|
| `owner@reserti.pl` | `Owner1234!` | OWNER |
| `superadmin@reserti.pl` | `Admin1234!` | SUPER_ADMIN |
| `admin@demo-corp.pl` | `Admin1234!` | OFFICE_ADMIN |
| `staff@demo-corp.pl` | `Staff1234!` | STAFF |
| `user@demo-corp.pl` | `User1234!` | END_USER |

---

## Zmienne środowiskowe produkcyjne

```env
# Backend
DATABASE_URL=postgresql://...
JWT_SECRET=...                    # min. 32 znaki
JWT_REFRESH_SECRET=...
MQTT_BROKER_URL=mqtt://mosquitto-NAME:1883
MQTT_USERNAME=backend
MQTT_PASSWORD=...
CORS_ORIGINS=https://app.prohalw2026.ovh,https://owner.prohalw2026.ovh
GATEWAY_PROVISION_KEY=...         # współdzielony z gateway
PUBLIC_API_URL=https://api.prohalw2026.ovh/api/v1
AZURE_CLIENT_ID=...               # Entra ID SSO
AZURE_CLIENT_SECRET=...
AZURE_REDIRECT_URI=...
```

---

## Szybki start — development

```bash
git clone https://github.com/lewski22/desk-panel
cd desk-panel

# Backend
cd backend
cp .env.example .env
npm install
npx prisma db push
node -e "require('./dist/database/seeds/seed.js')"
npm run start:dev

# Unified Panel
cd apps/unified
cp .env.example .env
npm install
npm run dev     # → http://localhost:5175
```

---

## Deploy produkcyjny (Coolify)

1. Wgraj zmiany do `main` na GitHub
2. Coolify wykrywa push i buduje Docker image
3. Automatyczny `prisma db push` + seed (idempotentny)
4. Seed NIE tworzy rezerwacji testowych (tylko użytkowników i biurka)

**Ważne:** Coolify deployuje z brancha `main`. Push na inny branch nie trigguje deploy.

---

## Kluczowe decyzje architektoniczne

### LED Event Bus (SharedModule)
Zamiast circular dependency `MqttModule ↔ CheckinsModule`, używamy rxjs Subject:
```
CheckinsService → LedEventsService.emit('OCCUPIED')
MqttHandlers   ← LedEventsService.events$.subscribe() → mqtt.publish()
```

### Strefa czasowa
Wszystkie daty przechowywane jako UTC w PostgreSQL.  
Frontend używa `localDateStr()` i `localDateTimeISO()` z `utils/date.ts`  
zamiast `toISOString()` (które zwraca UTC datę, nie lokalną).  
**TODO:** Location.timezone per biuro — patrz roadmap.

### MQTT Topic Schema
```
desk/{deskId}/command    ← backend → beacon (SET_LED, REBOOT, IDENTIFY, SET_DESK_ID)
desk/{deskId}/checkin    → gateway ← beacon (NFC scan)
desk/{deskId}/status     → gateway ← beacon (heartbeat)
gateway/{gwId}/hello     → backend ← gateway (rejestracja)
```

### Provisioning Flow
```
Panel Admin → POST /devices/provision → generuje MQTT credentials
→ wyświetla komendę PROVISION:{...} do wklejenia w Serial Monitor
→ beacon zapisuje config do NVS → restart → MQTT connect
→ beacon subscribe desk/{deskId}/command
```

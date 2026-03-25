# desk-panel

**Backend API + Admin Panel + Staff Panel** dla systemu Reserti Desk Management.

Repozytorium zawiera serwer główny (NestJS + PostgreSQL), panel administracyjny (Office Admin / Super Admin) oraz panel Staff do podglądu zajętości biurek w czasie rzeczywistym.

Część systemu [Reserti Desk Management](https://github.com/reserti).

---

## Zawartość repo

```
desk-panel/
├── backend/              NestJS REST API + MQTT bridge
│   ├── src/modules/      Moduły domenowe (desks, users, reservations...)
│   ├── prisma/           Schema bazy danych (PostgreSQL)
│   └── Dockerfile        Build produkcyjny (dla Coolify)
│
├── apps/
│   ├── admin/            Panel Office Admin + Super Admin (React + Vite)
│   │   └── Dockerfile    Build produkcyjny nginx
│   └── staff/            Panel Staff — mapa zajętości (React + Vite)
│       └── Dockerfile    Build produkcyjny nginx
│
├── infra/
│   └── docker/           Konfiguracje: Mosquitto, PostgreSQL, Dockerfile
│
├── docs/                 Dokumentacja techniczna
│   ├── deployment.md     ← Wdrożenie produkcyjne (Coolify + Proxmox)
│   ├── api.md            REST API reference
│   ├── architecture.md   Architektura systemu
│   ├── mqtt.md           MQTT specyfikacja
│   └── provisioning.md   Provisioning beaconów
│
├── scripts/
│   ├── setup.sh          One-shot dev setup
│   └── flash-config.py   Serial provisioning ESP32
│
└── docker-compose.yml    Lokalny dev stack
```

---

## Role użytkowników

| Rola | Panel | Uprawnienia |
|------|-------|-------------|
| **Super Admin** | `/admin` | Pełny dostęp — wszystkie organizacje, urządzenia, logi |
| **Office Admin** | `/admin` | Jedna organizacja — biurka, użytkownicy, rezerwacje, provisioning |
| **Staff** | `/staff` | Podgląd mapy + ręczny check-in / check-out |
| **End User** | Mobilna PWA | Tworzenie rezerwacji, QR check-in |

---

## Szybki start — development

### Wymagania
- Node.js 20+
- Docker + Docker Compose

### Instalacja

```bash
git clone https://github.com/reserti/desk-panel
cd desk-panel
./scripts/setup.sh
```

Skrypt automatycznie: kopiuje `.env`, instaluje zależności, generuje Prisma client, startuje PostgreSQL i Mosquitto, uruchamia migracje i seed.

### Uruchomienie

```bash
# Wszystko naraz (wymaga: npm install w root)
npm run dev

# Lub osobno:
cd backend      && npm run start:dev   # → http://localhost:3000
cd apps/admin   && npm run dev         # → http://localhost:5174
cd apps/staff   && npm run dev         # → http://localhost:5173
```

**Swagger UI:** http://localhost:3000/api/docs

---

## Konta testowe (seed)

| Email | Hasło | Rola |
|-------|-------|------|
| `superadmin@reserti.pl` | `Admin1234!` | Super Admin |
| `admin@demo-corp.pl` | `Admin1234!` | Office Admin |
| `staff@demo-corp.pl` | `Staff1234!` | Staff |
| `user@demo-corp.pl` | `User1234!` | End User |

---

## Zmienne środowiskowe

### `backend/.env`
```env
DATABASE_URL        = postgresql://admin:admin@localhost:5432/desk
JWT_SECRET          = (min. 32 znaki)
JWT_REFRESH_SECRET  = (min. 32 znaki)
MQTT_BROKER_URL     = mqtt://localhost:1883
MQTT_USERNAME       = backend
MQTT_PASSWORD       = changeme
PORT                = 3000
NODE_ENV            = production
CORS_ORIGINS        = https://admin.twoja-domena.pl,https://staff.twoja-domena.pl
```

### `apps/admin/.env` i `apps/staff/.env`
```env
VITE_API_URL      = https://api.twoja-domena.pl/api/v1
VITE_LOCATION_ID  = seed-location-01
```

---

## Baza danych

```bash
# Utwórz tabele (pierwszy deploy — brak migracji)
cd backend && npx prisma db push

# Lub migracje (development)
cd backend && npx prisma migrate dev --name nazwa

# Prisma Studio — GUI bazy
cd backend && npm run db:studio

# Seed danych testowych
cd backend && node dist/database/seeds/seed.js
```

---

## Deploy produkcyjny

Pełna instrukcja wdrożenia na **Proxmox LXC + Coolify + Cloudflare Tunnel**:

→ **[docs/deployment.md](docs/deployment.md)**

---

## Moduły backendu

| Moduł | Opis |
|-------|------|
| `auth` | JWT + rotacja refresh tokenów, role guards |
| `organizations` | Multi-tenant root (Super Admin) |
| `locations` | Biura w ramach organizacji |
| `desks` | CRUD, mapa zajętości, tokeny QR |
| `devices` | Provisioning beaconów, heartbeat |
| `gateways` | Rejestracja gateway, API synchronizacji |
| `reservations` | CRUD z weryfikacją konfliktów |
| `checkins` | NFC / QR / ręczny + checkout |
| `mqtt` | Bridge do sieci MQTT gateway |
| `users` | Konta użytkowników, przypisanie kart NFC |

Pełne API → [docs/api.md](docs/api.md)

---

## CI/CD

GitHub Actions na każdy push do `main` / `develop`:
- **Backend** — install → Prisma generate → migrate test DB → build → test
- **Admin panel** — build check
- **Staff panel** — build check

---

## Powiązane repozytoria

| Repo | Opis |
|------|------|
| [`desk-firmware`](https://github.com/reserti/desk-firmware) | Firmware ESP32 dla beaconów (NFC + LED) |
| [`desk-gateway`](https://github.com/reserti/desk-gateway) | Gateway per-biuro (MQTT bridge + cache offline) |

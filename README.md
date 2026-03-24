# desk-panel

**Backend API + Admin Panel + Staff Panel** for the Reserti Desk Management System.

This repo contains the main server (NestJS + PostgreSQL), the Office Admin interface, and the Staff real-time occupancy panel.

Part of the [Reserti Desk Management System](https://github.com/reserti).

---

## What's inside

```
desk-panel/
├── backend/          NestJS REST API + MQTT bridge
├── apps/
│   ├── admin/        Office Admin & Super Admin panel (React)
│   └── staff/        Staff real-time occupancy view (React)
└── scripts/
    ├── setup.sh       One-shot dev environment setup
    └── flash-config.py  Serial provisioning for ESP32
```

---

## Screenshots

| Staff — Desk map | Admin — Provisioning |
|---|---|
| Live occupancy grid, floor-grouped | Register gateways + beacons |

---

## User roles

| Role | Panel | Permissions |
|------|-------|-------------|
| **Super Admin** | `/admin` | Full platform — all orgs, devices, logs |
| **Office Admin** | `/admin` | One org — desks, users, reservations, provisioning |
| **Staff** | `/staff` | Read-only map + manual check-in / check-out |
| **End User** | Mobile / PWA | Create reservations, QR check-in |

---

## Quick start

### Prerequisites
- Node.js 20+, npm
- Docker + Docker Compose
- PostgreSQL 15 (or use Docker)

### One-shot setup
```bash
git clone https://github.com/reserti/desk-panel
cd desk-panel

./scripts/setup.sh
```

This script:
1. Copies `.env.example` → `.env` in `backend/`
2. Installs all backend dependencies
3. Generates Prisma client
4. Starts PostgreSQL + Mosquitto via Docker
5. Runs database migrations
6. Seeds the database with demo data and test accounts

### Start everything

```bash
# Backend
cd backend && npm run start:dev
# → http://localhost:3000
# → Swagger: http://localhost:3000/api/docs

# Admin panel
cd apps/admin && npm run dev
# → http://localhost:5174

# Staff panel
cd apps/staff && npm run dev
# → http://localhost:5173
```

---

## Test accounts (seed)

| Email | Password | Role |
|-------|----------|------|
| `superadmin@reserti.pl` | `Admin1234!` | Super Admin |
| `admin@demo-corp.pl` | `Admin1234!` | Office Admin |
| `staff@demo-corp.pl` | `Staff1234!` | Staff |
| `user@demo-corp.pl` | `User1234!` | End User |

---

## Backend — NestJS modules

| Module | Description |
|--------|-------------|
| `auth` | JWT + refresh token rotation, role guards |
| `organizations` | Multi-tenant root (Super Admin) |
| `locations` | Office buildings per org |
| `desks` | CRUD, live status map, QR tokens |
| `devices` | Beacon provisioning + heartbeat tracking |
| `gateways` | Gateway registration + sync API |
| `reservations` | Create/cancel with conflict check |
| `checkins` | NFC / QR / manual + checkout |
| `mqtt` | Bridge to gateway MQTT network |
| `users` | Accounts + NFC card assignment |

Full API reference → [`docs/api.md`](../docs/api.md)

---

## Environment variables

### `backend/.env`

```env
DATABASE_URL=postgresql://admin:admin@localhost:5432/desk
JWT_SECRET=change-me-32-chars-minimum
JWT_REFRESH_SECRET=change-me-refresh-32-chars
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=backend
MQTT_PASSWORD=backend-secret
PORT=3000
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
```

### `apps/staff/.env`

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_LOCATION_ID=seed-location-01
```

### `apps/admin/.env`

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_DEFAULT_LOCATION_ID=seed-location-01
```

---

## Database

```bash
# Generate Prisma client after schema changes
cd backend && npx prisma generate

# Create and apply new migration
cd backend && npx prisma migrate dev --name <migration-name>

# Open Prisma Studio (DB GUI)
cd backend && npm run db:studio

# Re-seed
cd backend && npm run db:seed
```

Schema → [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)

---

## Docker (production)

```bash
# Build and run all services
docker-compose up -d

# View logs
docker-compose logs -f backend
```

`docker-compose.yml` starts: PostgreSQL 15, Eclipse Mosquitto, NestJS backend (with auto-migrate on start).

---

## CI/CD

GitHub Actions runs on every push to `main` / `develop`:

- **Backend:** install → generate Prisma → migrate test DB → lint → build → test
- **Frontend:** build check per app (coming)

See [`.github/workflows/`](.github/workflows/).

---

## Provisioning a new beacon (serial flash)

```bash
python3 scripts/flash-config.py \
  --port      /dev/ttyUSB0 \
  --device-id d-abc123 \
  --desk-id   clxxxxxxxxxxxxxxxxxx \
  --wifi-ssid "OfficeWiFi" \
  --wifi-pass "wifipass" \
  --mqtt-host 192.168.1.100 \
  --mqtt-user beacon-d-abc123 \
  --mqtt-pass "generated-secret"
```

Full provisioning guide → [`docs/provisioning.md`](../docs/provisioning.md)

---

## Related repos

| Repo | Description |
|------|-------------|
| [`desk-firmware`](https://github.com/reserti/desk-firmware) | ESP32 firmware for desk beacons |
| [`desk-gateway`](https://github.com/reserti/desk-gateway) | Per-office MQTT bridge + local cache |

# Deployment — Coolify + Proxmox

Instrukcja wdrożenia produkcyjnego na Proxmox LXC z Coolify.

---

## Architektura produkcyjna

```
Internet
  │
  ▼
Cloudflare Tunnel (zero-trust, bez otwierania portów)
  │
  ▼
Proxmox LXC — Coolify
  ├── desk-backend     (NestJS)    → api.twoja-domena.pl
  ├── front-admin      (React)     → admin.twoja-domena.pl
  ├── front-staff      (React)     → staff.twoja-domena.pl
  ├── PostgreSQL                   → wewnętrzny port
  └── Mosquitto (MQTT)             → port 1883
```

---

## Wymagania

- Proxmox VE 9.1+
- LXC: Debian 12, 4 CPU, 6 GB RAM, 80 GB dysk
- Konto Cloudflare z domeną
- GitHub — repozytoria: `desk-panel`, `desk-gateway`, `desk-firmware`

---

## Krok 1 — Coolify na LXC

```bash
# W konsoli LXC (Debian 12, nesting włączone)
apt update && apt install -y curl
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
# → Panel dostępny na http://IP_LXC:8000
```

---

## Krok 2 — Cloudflare Tunnel

W Coolify: **New Resource → Services → Cloudflare Tunnel**

W Cloudflare Dashboard (one.dash.cloudflare.com):
```
Zero Trust → Networks → Tunnels → Twój tunel →
Public Hostnames:

  api.twoja-domena.pl   → HTTP → localhost:3000
  admin.twoja-domena.pl → HTTP → localhost:80
  staff.twoja-domena.pl → HTTP → localhost:80
```

---

## Krok 3 — PostgreSQL

```
Coolify → projekt desk → New Resource → Database → PostgreSQL 15

  Name:     desk-postgres
  User:     admin
  Password: (silne hasło)
  Database: desk

→ Deploy
```

---

## Krok 4 — Mosquitto

```
New Resource → Service → Mosquitto
  Name: desk-mqtt
  Username: (puste)
  Password: (puste)

→ Deploy
```

Po deploymencie — dodaj hasło przez entrypoint:

```
Edit Compose File → dodaj entrypoint generujący passwd:

environment:
  - MQTT_USERNAME=backend
  - MQTT_PASSWORD=twoje-haslo
  - ALLOW_ANONYMOUS=false

entrypoint: "sh -c \"...\" (patrz docker-compose.yml w repo)"
```

---

## Krok 5 — Backend NestJS

```
New Resource → Application → GitHub → desk-panel
  Base dir:         /backend
  Build Pack:       Dockerfile
  Dockerfile path:  Dockerfile

Environment Variables:
  DATABASE_URL        = postgresql://admin:HASLO@desk-postgres:5432/desk
  JWT_SECRET          = (openssl rand -hex 32)
  JWT_REFRESH_SECRET  = (openssl rand -hex 32)
  MQTT_BROKER_URL     = mqtt://mosquitto-XXXX:1883
  MQTT_USERNAME       = backend
  MQTT_PASSWORD       = twoje-haslo-mqtt
  PORT                = 3000
  NODE_ENV            = production
  CORS_ORIGINS        = https://admin.twoja-domena.pl,https://staff.twoja-domena.pl

Ports: 3000:3000
Domain: http://api.twoja-domena.pl
Connect To Predefined Network: ✓

→ Deploy
```

### Inicjalizacja bazy po pierwszym deploymencie

```bash
# Znajdź kontener backendu
docker ps | grep -v coolify | grep -v traefik

# Utwórz tabele
docker exec -it NAZWA_KONTENERA npx prisma db push

# Załaduj dane testowe
docker exec -it NAZWA_KONTENERA node dist/database/seeds/seed.js
```

---

## Krok 6 — Admin Panel

```
New Resource → Application → GitHub → desk-panel
  Base dir:   /apps/admin
  Build Pack: Dockerfile
  Dockerfile: Dockerfile

Environment Variables:
  VITE_API_URL      = https://api.twoja-domena.pl/api/v1
  VITE_LOCATION_ID  = seed-location-01

Ports: 3000:80
Domain: http://admin.twoja-domena.pl

→ Deploy
```

---

## Krok 7 — Staff Panel

```
New Resource → Application → GitHub → desk-panel
  Base dir:   /apps/staff
  Build Pack: Dockerfile
  Dockerfile: Dockerfile

Environment Variables:
  VITE_API_URL      = https://api.twoja-domena.pl/api/v1
  VITE_LOCATION_ID  = seed-location-01

Ports: 3001:80
Domain: http://staff.twoja-domena.pl

→ Deploy
```

---

## Weryfikacja

```
https://api.twoja-domena.pl/api/docs   → Swagger UI
https://admin.twoja-domena.pl          → Admin Panel login
https://staff.twoja-domena.pl          → Staff Panel login
```

**Konta testowe:**
```
superadmin@reserti.pl  / Admin1234!
admin@demo-corp.pl     / Admin1234!
staff@demo-corp.pl     / Staff1234!
user@demo-corp.pl      / User1234!
```

---

## Troubleshooting

| Problem | Przyczyna | Rozwiązanie |
|---------|-----------|-------------|
| `Failed to fetch` | Zły VITE_API_URL lub CORS | Ustaw CORS_ORIGINS i Redeploy frontendu |
| `ENOTFOUND hostname` | Sieć Docker | Włącz `Connect To Predefined Network` |
| `prisma db push` tabele brak | Brak migracji | Uruchom `npx prisma db push` w kontenerze |
| Mosquitto crash loop | Plik passwords istnieje | Usuń plik, popraw entrypoint w compose |
| Build TypeScript errors | Brakujące typy | Sprawdź tsconfig.json i `"types": ["vite/client"]` |

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
- App: `https://app.prohalw2026.ovh`
- Deploy: Coolify na Proxmox LXC + Cloudflare Tunnel

---

## Architektura systemu

```
┌─────────────────────────────────────────────────────────────────┐
│  CLOUD (Coolify / Proxmox)                                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  desk-panel                                               │   │
│  │  ┌─────────────────────┐  ┌───────────────────────────┐  │   │
│  │  │ NestJS Backend       │  │ Unified Panel (React)     │  │   │
│  │  │ Prisma + PostgreSQL  │  │ PWA + i18n PL/EN          │  │   │
│  │  │ MQTT client         │  │ app.prohalw2026.ovh        │  │   │
│  │  │ Prometheus /metrics  │  └───────────────────────────┘  │   │
│  │  └──────────┬──────────┘                                  │   │
│  └─────────────┼──────────────────────────────────────────────┘  │
│                │ HTTPS + MQTT (Cloudflare Tunnel)                 │
└────────────────┼────────────────────────────────────────────────┘
                 │
┌────────────────┼────────────────────────────────────────────────┐
│  SIEĆ LOKALNA BIURA                                              │
│  ┌─────────────▼────────────────────────────────────────────┐   │
│  │  Raspberry Pi 3B+ / 4 / Zero 2W                          │   │
│  │  ┌────────────────────┐  ┌──────────────────────────┐    │   │
│  │  │ gateway.py (systemd)│  │ Mosquitto (MQTT broker)  │    │   │
│  │  │ SyncService         │  │ port 1883 + auth + ACL   │    │   │
│  │  │ Cache (SQLite)      │  └──────────┬───────────────┘    │   │
│  │  │ DeviceMonitor       │             │ MQTT                │   │
│  │  │ /metrics :9100      │  ┌──────────▼───────────────┐    │   │
│  │  └────────────────────┘  │  ESP32 Beacony (per biurko)│   │   │
│  └───────────────────────────│  WS2812B LED + PN532 NFC   │───┘   │
│                              └───────────────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Stack technologiczny

| Warstwa | Technologia | Wersja |
|---------|-------------|--------|
| Backend | NestJS + Prisma + PostgreSQL | NestJS 10, Prisma 5, PG 15 |
| Frontend | React + Vite + Tailwind + i18next + vite-plugin-pwa | React 18 |
| Gateway | Python + paho-mqtt + sqlite3 | Python 3.8+ |
| Firmware | ESP32 + PlatformIO + ArduinoJson + PN532 | Arduino framework |
| Infra | Docker + Coolify + Mosquitto + Cloudflare Tunnel | — |
| Monitoring | Prometheus + Grafana (planowane) | prom-client 14 |

---

## Funkcjonalności

### ✅ Produkcja (v0.11.0)

**Rezerwacje i check-in**
- Rezerwacja biurek przez panel webowy lub QR kod
- Check-in NFC (karta przy beaconie), QR (scan QR na biurku), ręczny (STAFF)
- Walk-in przez QR bez rezerwacji
- LED beacon: zielony (wolne), niebieski (zarezerwowane), czerwony (zajęte)
- Auto-wygasanie rezerwacji co 15 min, auto-checkout walkin po 12h

**Multi-tenant i role**
- 5 ról: OWNER > SUPER_ADMIN > OFFICE_ADMIN > STAFF > END_USER
- Impersonacja: OWNER wchodzi do panelu klienta (JWT 30min + audit log)
- SSO Entra ID (Microsoft 365) per organizacja

**IoT — provisioning**
- Gateway: automatyczna instalacja curl + systemd (jednorazowy token 24h)
- Beacon: provisioning przez Serial Monitor (PROVISION:{...} JSON)
- OTA firmware: GitHub Actions CI → GitHub Releases → HTTP OTA na ESP32
- Reassign beacona do biurka z panelu

**Powiadomienia**
- Email: 8 typów, per-org SMTP (AES-256-GCM), fallback globalny
- In-app: dzwoneczek, polling 15s, ogłoszenia systemowe (OWNER)

**Jakość**
- i18n: 427 kluczy PL + EN, 100% pokrycie UI
- PWA: instalacja na telefon, offline cache, skróty
- Testy: 178 testów (backend NestJS + gateway Python)
- Monitoring: Prometheus metrics (backend + gateway)

### 🚧 Planowane (v0.12.0 — Q2 2026)

**Moduł subskrypcji**
- SUPER_ADMIN: plan, ważność, utilizacja zasobów (biurka/users/gateways)
- OWNER: zarządzanie planami klientów, MRR dashboard
- Powiadomienia: 30/14/7/1 dzień przed wygaśnięciem
- Szczegóły: `docs/subscription.md`

**Grafana dashboards**
- Owner: System Health, Fleet Overview
- Client: Desk Analytics, IoT Health

---

## Struktura repo

```
desk-panel/
├── backend/                      NestJS REST API
│   ├── src/
│   │   ├── modules/              Moduły domenowe (auth, users, desks, ...)
│   │   ├── mqtt/                 MQTT service + handlers
│   │   ├── shared/               LedEventsService (rxjs event bus)
│   │   ├── metrics/              Prometheus exporter
│   │   └── database/
│   │       ├── prisma.service.ts
│   │       └── seeds/seed.ts
│   ├── prisma/
│   │   └── schema.prisma         16 modeli
│   └── src/modules/
│       ├── auth/                 JWT + Entra ID SSO
│       ├── organizations/        Multi-tenant + Azure config
│       ├── locations/            Biura (godziny, limity rezerwacji)
│       ├── desks/                CRUD + live status + QR
│       ├── devices/              Beacony + OTA
│       ├── gateways/             Gateway setup + heartbeat
│       ├── reservations/         CRUD + konflikty
│       ├── checkins/             NFC/QR/manual + LED event
│       ├── users/                Konta + NFC card
│       ├── notifications/        Email + in-app
│       └── owner/                Owner Panel API
│
├── apps/
│   └── unified/                  React Unified Panel (wszystkie role)
│       ├── src/
│       │   ├── pages/            18 stron
│       │   ├── components/       DeskMap, NfcCardModal, NotificationBell, ...
│       │   ├── locales/          pl/ en/ (427 kluczy każdy)
│       │   └── api/client.ts     Wszystkie wywołania API
│       └── public/               favicon.svg, icon-192.svg, icon-512.svg
│
├── docs/
│   ├── AI_CONTEXT.md             Główny kontekst dla AI (ten plik na start)
│   ├── AI_BACKEND_CONTEXT.md     Szczegóły backendu
│   ├── AI_OWNER_CONTEXT.md       Owner Panel + subskrypcje
│   ├── AI_M365_CONTEXT.md        Microsoft 365 integracja
│   ├── api.md                    REST API reference
│   ├── architecture.md           Architektura systemu
│   ├── roadmap.md                Plan rozwoju
│   ├── subscription.md           Specyfikacja modułu subskrypcji
│   ├── changelog.md              Historia wersji
│   ├── roles.md                  Role i uprawnienia
│   ├── deployment.md             Wdrożenie produkcyjne
│   ├── hardware.md               ESP32 + RPi specyfikacja
│   ├── mqtt.md                   Tematy i protokół MQTT
│   ├── metrics.md                Prometheus metryki
│   └── provisioning.md           Provisioning gateway i beaconów
│
└── docker-compose.yml            Backend + Mosquitto
```

---

## Szybki start (development)

```bash
# 1. Backend
cd backend
cp .env.example .env   # uzupełnij DATABASE_URL, JWT_SECRET, ...
npm install
npx prisma db push
npx prisma db seed
npm run start:dev      # http://localhost:3000/api/v1

# 2. Frontend
cd apps/unified
npm install
npm run dev            # http://localhost:3010

# 3. Gateway (opcjonalnie)
cd desk-gateway-python
pip install paho-mqtt requests
cp .env.example .env
python3 gateway.py

# 4. Testy
cd backend && npx jest --coverage
cd desk-gateway-python && python3 -m unittest discover -s tests/ -v
```

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

## Dokumentacja

| Dokument | Zawartość |
|----------|-----------|
| `docs/AI_CONTEXT.md` | **Start tutaj** — pełny kontekst dla AI |
| `docs/AI_BACKEND_CONTEXT.md` | Moduły NestJS, Prisma, wzorce |
| `docs/AI_OWNER_CONTEXT.md` | Owner Panel, impersonacja, subskrypcje |
| `docs/subscription.md` | Specyfikacja modułu subskrypcji (v0.12.0) |
| `docs/api.md` | REST API reference |
| `docs/roadmap.md` | Plan rozwoju + versioning |
| `docs/roles.md` | Role i tabela uprawnień |
| `docs/hardware.md` | ESP32, RPi, NFC, LED specyfikacja |
| `docs/mqtt.md` | Tematy MQTT i flow komunikacji |
| `docs/provisioning.md` | Provisioning gateway i beaconów krok po kroku |
| `docs/metrics.md` | Prometheus metryki (backend + gateway) |
| `docs/deployment.md` | Wdrożenie na Coolify + Cloudflare Tunnel |


---

## TODO — Dług techniczny (zweryfikowano 2026-04-19)

| # | Zadanie | Status | Opis |
|---|---------|--------|------|
| 1 | **Web-push VAPID keys** | ✅ Zrobione | `web-push` zainstalowany, `push.service.ts` obsługuje VAPID. Wymagane ustawienie env vars w Coolify — patrz sekcja [Konfiguracja VAPID](#konfiguracja-vapid-web-push) niżej. |
| 2 | **Visitor email invite** | ❌ Do zrobienia | `visitors.service.ts` tworzy rekord gościa, ale nie wysyła emaila zaproszenia. Należy wstrzyknąć `NotificationsService` i wywołać `sendEmail()` po `prisma.visitor.create()`. |
| 3 | **Floor Plan CDN** | ❌ Do zrobienia | Floor plan przechowywany jako base64 w kolumnie `floorPlanUrl` w bazie danych (~2–3 MB per rekord). Należy zmigrować upload do S3 / Cloudflare R2 i zapisywać tylko URL. |
| 4 | **Kiosk link w UI** | ❌ Do zrobienia | Brak przycisku `/kiosk?location=...` w `OrganizationsPage.tsx`. Jedna linia kodu — przycisk otwierający kiosk dla danej lokalizacji. |
| 5 | **Playwright E2E** | ✅ Zrobione | `playwright.config.ts` skonfigurowany, testy: `auth.spec.ts`, `checkin.spec.ts`, `reservation.spec.ts` w `backend/tests/e2e/`. |
| 6 | **Beacon RTC timestamp** | ❓ Nieweryfikowalne | Kod firmware beacona/gateway nie jest w tym repozytorium — nie można potwierdzić implementacji NTP sync. |

---

## Konfiguracja VAPID (Web Push)

Klucze VAPID generuje się **jeden raz** na serwerze — nie regeneruj po deploymencie (istniejące subskrypcje przestają działać).

```bash
# Na serwerze produkcyjnym (SSH do Coolify LXC):
cd /path/to/desk-panel/backend
node generate-vapid-keys.js
```

Wynik wklej jako zmienne środowiskowe w Coolify (sekcja Environment):

| Zmienna | Opis |
|---------|------|
| `VAPID_PUBLIC_KEY` | Klucz publiczny (base64url) — przekazywany też do frontendu |
| `VAPID_PRIVATE_KEY` | Klucz prywatny — trzymaj w sekrecie, nigdy nie commituj |
| `VAPID_SUBJECT` | `mailto:admin@reserti.pl` |

Po ustawieniu zmiennych — restart backendu. Jeśli `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` nie są ustawione, backend loguje `VAPID keys not configured — push notifications disabled` i push jest wyłączony (bez błędu krytycznego).

---

---

## Teams Bot Framework (slash commands)

Zaimplementowano 2026-04-19. Moduł: `backend/src/modules/teams-bot/`.

### Architektura

| Plik | Opis |
|------|------|
| `teams-bot.module.ts` | `CloudAdapter` z auth Bot Framework + rejestracja modułu |
| `teams-bot.controller.ts` | `POST /api/v1/bot/messages` — endpoint dla Bot Framework Service |
| `teams-bot.service.ts` | `TeamsActivityHandler` — routing komend + Messaging Extensions |
| `teams-bot-cards.ts` | Adaptive Cards: formularz rezerwacji, lista, success/error |
| `apps/teams/manifest/manifest.json` | Manifest v1.17 — dodano sekcje `bots` i `composeExtensions` |

### Komendy (wiadomość bezpośrednia do bota)

| Komenda | Opis |
|---------|------|
| `book` / `zarezerwuj` | Pokaż dostępne biurka + Adaptive Card z formularzem |
| `reservations` / `moje` | Lista 5 nadchodzących rezerwacji z przyciskiem Anuluj |
| `cancel <id>` | Anuluj rezerwację po ID |
| `help` | Lista komend |

### Slash commands (okno kompozycji Teams)

Dostępne przez przycisk `...` → Reserti lub wpisanie `/` w compose box:

| Komenda | Typ | Opis |
|---------|-----|------|
| `/book` | action | Otwiera task module z formularzem rezerwacji |
| `/reservations` | action | Otwiera task module z listą rezerwacji |

### Konfiguracja produkcyjna

**Zmienne środowiskowe w Coolify:**

| Zmienna | Wartość |
|---------|---------|
| `BOT_APP_ID` | App ID z Azure Bot Registration |
| `BOT_APP_PASSWORD` | Client Secret z Azure Bot Registration |

**Azure Bot Service** → Messaging Endpoint: `https://api.prohalw2026.ovh/api/v1/bot/messages`

**Manifest** (`apps/teams/manifest/manifest.json`) — zastąp oba `REPLACE-WITH-BOT-APP-ID` tym samym App ID co `BOT_APP_ID`.

### Wymaganie: azureObjectId

Bot identyfikuje użytkownika przez pole `User.azureObjectId` (ustawiane przy logowaniu przez Entra ID SSO). Użytkownicy, którzy logują się wyłącznie przez email/hasło, nie będą rozpoznawani przez bota.

---

### Sprint K — AI Features (zweryfikowano 2026-04-19)

| Element | Status | Uwagi |
|---------|--------|-------|
| K1: `recommendations.service.ts` — algorytm rule-based | ✅ Zrobione | Historia 20 rez., scoring wag, wykluczanie konfliktów |
| K1: `GET /desks/recommended` controller | ✅ Zrobione | |
| K1: `appApi.desks.getRecommended()` | ✅ Zrobione | |
| K1: `RecommendationBanner.tsx` komponent | ✅ Zrobione | |
| K1: **Banner podpięty w `DeskMapPage`** | ❌ Do zrobienia | Import + `<RecommendationBanner>` nad mapą |
| K2: `insights.service.ts` — template engine + cron 07:00 | ✅ Zrobione | 6 typów insightów, cachowane w DB |
| K2: `GET /insights`, `POST /insights/refresh` | ✅ Zrobione | |
| K2: `InsightsWidget.tsx` + `OrgInsightsWidget.tsx` | ✅ Zrobione | |
| K2: **`InsightsWidget` podpięty w `DashboardPage`** | ❌ Do zrobienia | Import + `<InsightsWidget>` w sekcji dashboardu |

# Reserti — Paczka wdrożeniowa v0.17.0
> Sesja: 2026-04-18 | Gałąź docelowa: `main` repozytoria `desk-panel`

---

## Struktura paczki

```
reserti-deploy/
├── backend/                        NestJS backend
│   ├── src/
│   │   ├── main.ts.patch.ts        ← PATCH: dodaj exclude dla Graph/Google routes
│   │   ├── app.module.patch.ts     ← PATCH: dodaj GraphSyncModule, IntegrationsModule
│   │   └── modules/
│   │       ├── auth/               Azure SSO (backward compat) + Google SSO
│   │       ├── reports/            Sprint C — CSV/XLSX export
│   │       ├── recommendations/    Sprint K1 — AI desk scoring
│   │       ├── insights/           Sprint K2 — utilization patterns + cron
│   │       ├── integrations/       Sprint F — Slack/Teams/Webhook/Azure/Google
│   │       │   ├── providers/
│   │       │   └── types/
│   │       ├── graph-sync/         M4 — Microsoft Graph Calendar Sync
│   │       ├── notifications/      Tech Debt: visitor email invite
│   │       ├── locations/          Tech Debt: Floor Plan CDN (R2/S3)
│   │       └── visitors/           Tech Debt: visitor service patch
│   ├── prisma/migrations/          4 nowe migracje SQL
│   ├── tests/e2e/                  Playwright E2E (auth, reservations, checkin)
│   ├── playwright.config.ts
│   └── generate-vapid-keys.js      Tech Debt: web-push VAPID
│
├── apps/
│   ├── unified/src/               Staff Panel (React)
│   │   ├── pages/                 IntegrationsPage, ReportsPage, login patch
│   │   ├── components/
│   │   │   ├── integrations/      ProviderCard + 5 formularzy konfiguracji
│   │   │   ├── insights/          InsightsWidget (K2)
│   │   │   ├── recommendations/   RecommendationBanner (K1)
│   │   │   ├── calendar/          CalendarSyncSection + GraphConnectButton
│   │   │   └── KioskLinkButton.tsx
│   │   ├── locales/pl/integrations.json
│   │   ├── locales/en/integrations.json
│   │   ├── locales/graph-google.i18n.json
│   │   └── _patches/              api.client.ts patches (połącz ręcznie)
│   │
│   └── teams/                     Teams App (nowy katalog)
│       ├── src/{auth,api,pages,components}
│       ├── manifest/manifest.json
│       ├── Dockerfile + nginx.conf
│       └── package.json
│
├── monitoring/                     Grafana + Prometheus stack
│   ├── docker-compose.yml
│   ├── prometheus.yml
│   └── grafana/{dashboards,provisioning}
│
├── firmware/
│   ├── time_utils.h               NTP sync (Tech Debt #6)
│   └── ntp_patch.cpp
│
├── .env.example.additions         Nowe zmienne środowiskowe
└── README.md                      Ten plik
```

---

## Kolejność aplikowania (obowiązkowa)

### Krok 1 — Migracje Prisma
```bash
cd backend

# Skopiuj migracje
cp prisma/migrations/20260418000001_add_floor_plan_key.sql    prisma/migrations/20260418000001_add_floor_plan_key/migration.sql
cp prisma/migrations/20260418000002_add_utilization_insight.sql prisma/migrations/20260418000002_add_utilization_insight/migration.sql
cp prisma/migrations/20260418000003_add_org_integration.sql   prisma/migrations/20260418000003_add_org_integration/migration.sql
cp prisma/migrations/20260418000004_add_graph_sync.sql        prisma/migrations/20260418000004_add_graph_sync/migration.sql

# Dodaj modele do schema.prisma (patrz patche w migration/)
# Następnie:
npx prisma migrate deploy
npx prisma generate
```

### Krok 2 — Backend modules
Skopiuj katalogi z `backend/src/modules/` do odpowiednich miejsc w repo:
- `modules/reports/` → nowy moduł
- `modules/recommendations/` → nowy moduł
- `modules/insights/` → nowy moduł
- `modules/integrations/` → nowy moduł (@Global)
- `modules/graph-sync/` → nowy moduł
- `modules/auth/` → **podmień** `azure-auth.service.ts` i `auth.module.ts`, **dodaj** `google-auth.service.ts`

### Krok 3 — main.ts + app.module.ts
Zastosuj patche z `backend/src/`:
- `main.ts.patch.ts` — dodaj 4 trasy do exclude list
- `app.module.patch.ts` — dodaj GraphSyncModule, IntegrationsModule

### Krok 4 — Patche serwisów (wklej ręcznie)
```
backend/src/modules/reservations.service.patch.ts    → wklej do reservations.service.ts
backend/src/modules/checkins.service.patch.ts        → wklej do checkins.service.ts
backend/src/modules/inapp-notifications.service.patch.ts → wklej do inapp-notifications.service.ts
backend/src/modules/reservations.module.ts           → podmień plik
backend/src/modules/notifications/notifications.service.patch.ts → wklej do notifications.service.ts
backend/src/modules/locations/locations.service.patch.ts → wklej do locations.service.ts
backend/src/modules/visitors/visitors.service.patch.ts → wklej do visitors.service.ts
```

### Krok 5 — Frontend
Skopiuj do repo:
```
apps/unified/src/pages/IntegrationsPage.tsx
apps/unified/src/pages/ReportsPage.tsx
apps/unified/src/components/**
apps/unified/src/locales/pl/integrations.json  → połącz z istniejącym translation.json
apps/unified/src/locales/en/integrations.json  → połącz z istniejącym translation.json
```

Zastosuj `_patches/api.client.*.patch.ts` — wklej metody do `api/client.ts`.

### Krok 6 — Teams App
```bash
# Skopiuj cały katalog jako nowy app
cp -r apps/teams/ <repo>/apps/teams/
```

Podmień placeholdery w `apps/teams/manifest/manifest.json`:
- `REPLACE-WITH-GUID` → nowe UUID
- `REPLACE-WITH-AZURE-CLIENT-ID` → Azure Client ID

### Krok 7 — Monitoring
```bash
cp -r monitoring/ <repo>/monitoring/
```
Uruchom stack w Coolify jako osobny serwis Docker Compose.

### Krok 8 — Firmware (OTA update)
Skopiuj `firmware/time_utils.h` do `desk-firmware/src/utils/`.
Wdróż przez OTA z panelu provisioning.

### Krok 9 — env vars
Dodaj zmienne z `.env.example.additions` do `.env` backendu:
```
INTEGRATION_ENCRYPTION_KEY=<64 hex chars>
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@reserti.pl
```

---

## Nowe zmienne środowiskowe

| Zmienna | Wymagana | Opis |
|---------|----------|------|
| `INTEGRATION_ENCRYPTION_KEY` | ✅ TAK | AES-256-GCM dla integracji (64 hex) |
| `VAPID_PUBLIC_KEY` | ✅ TAK | Web-push notifications |
| `VAPID_PRIVATE_KEY` | ✅ TAK | Web-push notifications |
| `VAPID_SUBJECT` | ✅ TAK | np. `mailto:admin@reserti.pl` |
| `CORS_ORIGINS` | Aktualizacja | Dodaj `teams.prohalw2026.ovh` |

Generowanie kluczy:
```bash
# VAPID
node backend/generate-vapid-keys.js

# INTEGRATION_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Co jest nowe w tej wersji

| Sprint | Wersja | Co |
|--------|--------|----|
| Tech Debt | v0.12.2 | VAPID, visitor email, Floor Plan CDN, Kiosk link, Playwright E2E, Beacon NTP |
| Sprint C | v0.12.1 | Grafana dashboards (4 szt.), CSV/XLSX export, ReportsPage |
| Sprint K | v0.15.1 | AI desk recommendations (K1), Utilization insights (K2) |
| Sprint F | v0.17.0 | Integration marketplace: Azure, Slack, Google, Teams, Webhooks |
| Patch 4 | v0.17.0 | IntegrationEventService hookup w reservations/checkins/inapp |
| Teams App | v0.17.0 | Nowa aplikacja apps/teams/ — rezerwacje z Microsoft Teams |
| Graph Sync | v0.17.0 | Microsoft Graph Calendar ↔ Outlook synchronizacja (M4) |
| Google Auth | v0.17.0 | Google Workspace SSO per-org (F3) |

# Roadmap — Reserti Desk Management System

> Ostatnia aktualizacja: 2026-04-22 — v0.17.2

---

## Stan aktualny (v0.17.2 — 2026-04-22)

### ✅ Zrealizowane (produkcja)

**Infrastruktura**
- Deploy: Coolify na Proxmox LXC + Cloudflare Tunnel
- PostgreSQL 15 + Mosquitto MQTT + Docker
- Metryki: Prometheus (backend /metrics + gateway :9100)
- Prisma migrate deploy — bezpieczne migracje + auto-resolve failed state

**Backend (NestJS 11 + Prisma 5)**
- JWT auth (15min access / 7d refresh) + rotacja tokenów
- Multi-tenant: Organization → Location → Desk
- Role: OWNER, SUPER_ADMIN, OFFICE_ADMIN, STAFF, END_USER
- Rate limiting + Entra ID SSO + MQTT bridge + LED Event Bus
- Gateway provisioning (tokeny 24h) + Device provisioning (MQTT credentials)
- Rezerwacje: konflikty, QR, cancel + LED FREE, **cykliczne (RRULE parser)**
- Check-in: NFC / QR walkin / ręczny; Checkout; Cron expireOld + autoCheckout
- OTA firmware (4 fazy): GitHub Actions CI, status tracking, org isolation
- Powiadomienia email (8 typów, SMTP per org AES-256-GCM)
- Powiadomienia in-app (dzwoneczek, reguły, ogłoszenia OWNER)
- **Sale/Parking/Equipment — Resource + Booking z conflict detection**
- **PWA Push Notifications (PushService, PushController)**
- **Visitor Management (zaproszenia, check-in/out, QR)**
- **SubscriptionsService — plany, limity, MRR, crony expiry check**
- **Owner module management — enabledModules per org**
- Testy: 178 backend (P1+P2+P3) + 48 frontend (Vitest)

**Unified Panel (React 18 + Vite)**
- PWA (manifest, service worker, ikony, offline cache)
- i18n PL/EN — 427 kluczy, 100% pokrycie, 0 alert()
- **Floor Plan Editor — SVG drag, undo/redo, snap do siatki**
- **Floor Plan View — readonly canvas z DeskPin + DeskInfoCard**
- **Weekly View — siatka Pon-Pt × users, nawigator tygodnia**
- **Zakładki Biurka | Sale | Parking z module guards**
- **SubscriptionPage — PlanBadge, UsageBar, ExpiryBanner**
- **VisitorsPage — invite, checkin, checkout, KPI**
- **KioskPage — fullscreen tablet mode + PIN exit**
- **BottomNav — mobile bottom navigation z badge**
- **Swipe gestures — iOS Mail pattern na MyReservationsPage**
- **RecurringToggle — RRULE picker + preview dat**
- **OwnerPage — zakładki Firmy/Subskrypcje, module toggles**
- **Sprint F** — IntegrationsModule (@Global): Slack, Teams, Azure, Google, Webhook
- **Teams App** — React personal tab w MS Teams, SSO przez Teams SDK
- **Microsoft Graph Calendar Sync** — dwukierunkowa sync Outlook ↔ Reserti
- **Google SSO** — OIDC JIT provisioning
- **AI Rekomendacje (K1)** — `RecommendationBanner`, scoring rule-based
- **Utilization Insights (K2)** — cron codziennie, wzorce zajętości, `InsightsWidget`
- **Web Push (VAPID)** — `PushService` + `PushOptIn`
- **i18n 100%** — zero hardkodowanych stringów PL/EN w kodzie produkcyjnym
- **Lucide React ikony** — ujednolicona biblioteka (`SidebarIcons.tsx`)
- **Brand token** — `#B53578` w jednym miejscu (`index.css` + `tailwind.config.js`)
- **Status colors** — spójne emerald/amber/red/zinc we wszystkich komponentach
- **FloorPlanEditor** — pozycje biurek synchronizują się po zapisie (`useEffect + reset()`)
- **KioskPage PWA install** — przycisk instalacji aplikacji na tablecie (`beforeinstallprompt`)
- **Multi-floor backend** — `LocationFloorPlan` model, endpointy z `?floor=`, backward-compat
- **Security hardening** — privilege escalation w rezerwacjach + IDOR w lokalizacjach naprawione
- **Monitoring** — Grafana + Prometheus, 4 dashboardy

**Gateway Python + Firmware ESP32**
- Cache offline, SyncService, DeviceMonitor, Prometheus exporter
- NFC + LED + OTA_UPDATE + offline NVS queue (TTL 1h)

---

## Co zostało do zrobienia (priorytet malejący)

### Multi-floor frontend editor

- `FloorPlanEditorPage` — zakładki pięter + wybór aktywnego piętra w edytorze
- `FloorPlanView` — selektor piętra; biurka filtrowane per `desk.floor`
- `OrganizationsPage` — zarządzanie piętrami (dodaj/usuń/zmień nazwę)
- Frontend zna API: `GET /locations/:id/floors`, `POST /floor-plan?floor=`

### to_fix_2.md — otwarte błędy UX

- `#1` [USER] Mapa przed rezerwacjami na widoku użytkownika
- `#2` [MOBILE] 3 oddzielne mapy dla biurek/sal/parkingu
- `#3` [MAP] Popup biurka tuż obok klikniętego pina (nie z boku strony)
- `#4` [MAP] Przycisk „Rezerwuj" na mapie nie działa
- `#5` [REZERWACJE] Check-in nadal widoczny po wykonanym check-inie
- `#6` [DASHBOARD] Brak danych mimo check-inów
- `#7` [DASHBOARD] Czytelność na mobile (Super Admin)
- `#12` [BIURO] Multi-floor — frontend editor (backend gotowy)
- `#13` [SUPER ADMIN] Błąd wyboru firmy przy dodawaniu biura (SA powinien dodawać tylko do swojej org)

### Dalszy rozwój

- `#14` [M365] Dwustronna sync kalendarza sal konferencyjnych (rozszerzenie GraphSyncModule)
- `#15` [REJESTRACJA] Pełne flow onboardingu (formularz + email invite flow)
- `#18` [DEMO] Instancja z hardkodowanymi danymi (bez backendu)
- Sprint L — Publiczny booking + Stripe Checkout
- Visitor email invite (TODO w `visitors.service.ts`)
- Playwright E2E testy

---

## Wzorce migracji Prisma (obowiązkowe)

### ALTER TYPE ADD VALUE
```sql
-- This migration requires no transaction.
ALTER TYPE "InAppNotifType" ADD VALUE IF NOT EXISTS 'NOWA_WARTOSC';
```

### CREATE TYPE (bezpieczny, idempotentny)
```sql
DO $$ BEGIN
  CREATE TYPE "MyEnum" AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

### CREATE TABLE
```sql
CREATE TABLE IF NOT EXISTS "MyTable" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  ...
  CONSTRAINT "MyTable_pkey" PRIMARY KEY ("id")
);
```

### INSERT do lookup tables
```sql
INSERT INTO "NotificationRule" ("type", "targetRoles", "enabled")
VALUES ('MY_TYPE', ARRAY['SUPER_ADMIN'], true)
ON CONFLICT ("type") DO NOTHING;
```

---

## Harmonogram wydań

| Wersja | Data | Co zawiera |
|--------|------|-----------|
| 0.11.0 | ✅ 2026-04-15 | i18n + PWA + testy + OTA + notyfikacje |
| **0.12.0** | ✅ **2026-04-17** | **Sprinty A, D, E, G, H, I, J, B + naprawa Prisma** |
| **0.17.0** | ✅ **2026-04-19** | **Sprint F (Integracje) + Teams App + Graph Sync + Google SSO + AI Insights** |
| **0.17.1** | ✅ **2026-04-21** | **Security fixes + status colors + brand token** |
| **0.17.2** | ✅ **2026-04-22** | **Lucide icons + i18n audit + FloorPlan sync fix + KioskPage PWA + multi-floor backend** |
| **0.18.0** | Q2 2026 | Multi-floor frontend editor + UX fixes (to_fix_2: #1-7) |
| **0.19.0** | Q3 2026 | Sprint L (Public Booking + Stripe) |
| **1.0.0** | Q1 2027 | Self-hosted + ISO 27001 |

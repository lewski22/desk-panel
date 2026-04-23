# Roadmap — Reserti Desk Management System

> Ostatnia aktualizacja: 2026-04-23 — v0.17.2+

---

## Stan aktualny (v0.17.2+)

### ✅ Zrealizowane (produkcja)

**Infrastruktura**
- Deploy: Coolify na Proxmox LXC + Cloudflare Tunnel
- PostgreSQL 15 + Mosquitto MQTT + Docker
- Metryki: Prometheus (backend `/metrics` + gateway `:9100`) + Grafana (4 dashboardy)
- `prisma migrate deploy` — bezpieczne migracje + auto-resolve failed state w `entrypoint.sh`

**Backend (NestJS 11 + Prisma 5)**
- JWT auth (15min access / 7d refresh) + rotacja tokenów
- Multi-tenant: Organization → Location → Desk
- Role: OWNER, SUPER_ADMIN, OFFICE_ADMIN, STAFF, END_USER
- Rate limiting + Entra ID SSO + Google SSO + MQTT bridge + LED Event Bus
- Gateway provisioning (tokeny 24h) + Device provisioning (MQTT credentials)
- Rezerwacje: konflikty, QR, cancel + LED FREE, cykliczne (RRULE parser)
- Check-in: NFC / QR walkin / ręczny; Checkout; Cron expireOld + autoCheckout
- OTA firmware (4 fazy): GitHub Actions CI, status tracking, org isolation
- Powiadomienia email (8 typów, SMTP per org AES-256-GCM) + in-app (dzwoneczek, reguły, ogłoszenia)
- Sale/Parking/Equipment — Resource + Booking z conflict detection
- PWA Push Notifications (VAPID)
- Visitor Management (zaproszenia, check-in/out, QR)
- SubscriptionsService — plany, limity, MRR, crony expiry check
- Owner module management — enabledModules per org
- IntegrationsModule: Slack, Teams, Azure AD, Google Workspace, Webhook
- Microsoft Graph Calendar Sync — dwukierunkowa sync Outlook ↔ Reserti
- AI Rekomendacje (K1) + Utilization Insights (K2, cron codziennie)
- Flow rejestracji przez zaproszenie (invitation tokens)
- Testy: 178 backend (P1+P2+P3) + 48 frontend (Vitest)
- Indeksy DB: `Reservation(deskId, date, status)`, `Checkin(deskId, checkedOutAt)`

**Unified Panel (React 18 + Vite)**
- PWA (manifest, service worker, ikony, offline cache)
- i18n PL/EN — 100% pokrycie, 0 hardkodowanych stringów
- Floor Plan Editor — SVG drag, undo/redo, snap do siatki, multi-floor
- Floor Plan View — readonly canvas z DeskPin + DeskInfoCard
- Weekly View — siatka Pon-Pt × users, nawigator tygodnia
- Zakładki Biurka | Sale | Parking z module guards
- SubscriptionPage — PlanBadge, UsageBar, ExpiryBanner
- VisitorsPage — invite, checkin, checkout, KPI
- KioskPage — fullscreen tablet mode + PIN exit + PWA install button
- BottomNav — mobile bottom navigation z badge
- Swipe gestures — iOS Mail pattern na MyReservationsPage
- RecurringToggle — RRULE picker + preview dat
- OwnerPage — zakładki Firmy/Subskrypcje, module toggles
- IntegrationsPage — konfiguracja per provider
- Teams App — React personal tab w MS Teams, SSO przez Teams SDK
- Demo mode — `VITE_DEMO_MODE=true` z mock handlers i fixtures
- Lokalny QR code (biblioteka `qrcode`, bez zewnętrznych serwisów)
- Singleton refresh token (eliminuje race condition przy równoległych 401)

**Gateway Python + Firmware ESP32**
- Cache offline, SyncService, DeviceMonitor, Prometheus exporter
- NFC + LED + OTA_UPDATE + offline NVS queue (TTL 1h)

---

## Co zostało do zrobienia

### Priorytet wysoki

- **Multi-floor frontend editor** — zakładki pięter w FloorPlanEditorPage/FloorPlanView, zarządzanie piętrami w OrganizationsPage. Backend gotowy od v0.17.2.
- **Tokeny w localStorage → httpOnly cookies** — duży zakres (backend Set-Cookie + frontend auth flow). Patrz `docs/security-review.md`.

### Priorytet średni

- **Sprint L** — Publiczny booking + Stripe Checkout
- **M365** — Dwustronna sync kalendarza sal konferencyjnych (rozszerzenie GraphSyncModule)
- **Playwright E2E testy**
- **Visitor email invite** (TODO w `visitors.service.ts`)
- **`as any` cleanup (136x)** — generowanie typów z OpenAPI (`openapi-typescript`)

### Priorytet niski / analiza

- Gateway provisioning przez USB (WebSerial API) — patrz sekcja poniżej
- Cloud MQTT (bez lokalnego Raspberry Pi) — patrz sekcja poniżej
- ISO 27001 przygotowanie

---

## Gateway Provisioning — Plan Rozwoju

Aktualne wdrożenie Gateway na Raspberry Pi wymaga ~30 min pracy technicznej per biuro. Cel: **5 minut lub mniej, zero wiedzy technicznej**.

### Faza 1 — Auto-konfiguracja przez QR kod ← NAJBLIŻSZY KROK

Admin skanuje QR z panelu → Pi samo się konfiguruje przez token instalacyjny (już zaimplementowany: `POST /gateway/setup-tokens`).

**Brakuje:** skrypt `auto-setup.sh` na Pi (cron `@reboot`) który odpytuje `GET /install/gateway/:token` i uruchamia kontenery.

**Czas: 1-2 dni**

### Faza 2 — Dedykowany obraz OS (Raspberry Pi Imager)

Gotowy `.img` budowany przez `pi-gen` z GitHub Actions. Admin wgrywa kartę SD, wpisuje WiFi + token — reszta automatyczna.

**Czas: 3-5 dni**

### Faza 3 — Gateway jako usługa SaaS (cloud MQTT)

Beacony łączą się bezpośrednio przez TLS do `mqtt.reserti.pl:8883` (Mosquitto + Cloudflare Spectrum). Brak Raspberry Pi.

Kiedy warto: liczba biur > 10 lub klienci bez lokalnego IT.

**Czas: 1-2 tygodnie**

---

## Wzorce migracji Prisma (obowiązkowe)

### ALTER TYPE ADD VALUE
```sql
-- This migration requires no transaction.
ALTER TYPE "InAppNotifType" ADD VALUE IF NOT EXISTS 'NOWA_WARTOSC';
```

### CREATE TYPE (idempotentny)
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
| 0.12.0 | ✅ 2026-04-17 | Sprinty A, D, E, G, H, I, J, B + naprawa Prisma |
| 0.17.0 | ✅ 2026-04-19 | Sprint F (Integracje) + Teams App + Graph Sync + Google SSO + AI Insights |
| 0.17.1 | ✅ 2026-04-21 | Security fixes + status colors + brand token |
| 0.17.2 | ✅ 2026-04-22 | Lucide icons + i18n audit + FloorPlan sync fix + KioskPage PWA + multi-floor backend |
| 0.17.3 | ✅ 2026-04-23 | UX fixes + rejestracja + demo mode + code review fixes |
| **0.18.0** | Q2 2026 | Multi-floor frontend editor + public booking (Stripe) |
| **1.0.0** | Q1 2027 | Self-hosted + ISO 27001 |

---

## Batching zmian — zasady

Każdy plik edytowany **raz** — wszystkie potrzebne zmiany z różnych zadań trafiają w jednej sesji.

**Pliki infrastrukturalne (edytować zbiorczo):**

| Plik | Zasada |
|------|--------|
| `backend/prisma/schema.prisma` | Jedna migracja per sprint; nigdy cząstkowe |
| `apps/unified/src/App.tsx` | Wszystkie nowe routy dodawać naraz |
| `apps/unified/src/components/layout/AppLayout.tsx` | Wszystkie nowe nav items naraz |
| `apps/unified/src/api/client.ts` | Wszystkie nowe metody API naraz |
| `apps/unified/src/locales/*/translation.json` | Namespace per sprint, struktura od razu |

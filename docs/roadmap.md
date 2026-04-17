# Roadmap — Reserti Desk Management System

> Ostatnia aktualizacja: 2026-04-17 — v0.12.0

---

## Stan aktualny (v0.12.0 — 2026-04-17)

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

**Gateway Python + Firmware ESP32**
- Cache offline, SyncService, DeviceMonitor, Prometheus exporter
- NFC + LED + OTA_UPDATE + offline NVS queue (TTL 1h)

---

## Co zostało do zrobienia

### Sprint C — Grafana + CSV Export (5 dni) 🔴 Priorytet

- `prometheus.yml` + docker-compose stack (Grafana + Prometheus w Coolify)
- Dashboard 1–4: System Health, Fleet Overview, Desk Analytics, IoT Health
- `GET /reports/export?from=&to=&format=csv|xlsx`
- ReportsPage: date range picker, heatmapa dzień×godzina

### Sprint K — AI Rekomendacje (8 dni)

**K1 — Smart desk recommendations:**
- Algorytm rule-based: ostatnie 20 rezerwacji → ulubione biurko → strefa → beacon uptime
- `GET /desks/recommended?date=&start=&end=`
- Banner nad mapą: `💡 Sugerowane biurko: A-01 (Twoje ulubione)` + `[Zarezerwuj]`

**K2 — Utilization AI insights:**
- Generowane raz dziennie przez cron, cachowane w DB
- Template engine (nie LLM) — wzorce zajętości per biurko/strefa

### Sprint L — Publiczny booking + Stripe (10 dni)

- `Location.isPublic/publicSlug` — publiczna strona `/book/{slug}`
- Rate limiting per email (3 rez/tydzień)
- Stripe Checkout Session → `paymentStatus` na Reservation
- `GET /webhooks/stripe` — obsługa payment.succeeded

### Sprint F — Integracje zewnętrzne (wymaga credentials)

- Teams App (Azure Bot Framework + Teams Manifest)
- Slack Bot (OAuth2 workspace install, slash commands)
- Microsoft Graph Sync (webhook calendarView, dwukierunkowa sync)

### Inne TODO

| # | Temat | Priorytet | Opis |
|---|-------|-----------|------|
| 1 | web-push VAPID keys | Wysoki | `npm install web-push` + `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` w .env |
| 2 | Visitor email invite | Średni | TODO w visitors.service.ts — NotificationsService/SMTP |
| 3 | Floor Plan CDN | Średni | Upload base64 do DB (limit ~2MB) → S3/Cloudflare R2 |
| 4 | Kiosk link w UI | Niski | Brak przycisku `/kiosk?location=...` w OrganizationsPage |
| 5 | Playwright E2E | Niski | Brak konfiguracji i testów |
| 6 | Beacon timestamp RTC | Niski | `millis()/1000` reset przy restarcie |

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
| **0.12.1** | Q2 2026 | Sprint C (Grafana + CSV Export) |
| **0.15.1** | Q3 2026 | Sprint K (AI Rekomendacje) |
| **0.16.0** | Q4 2026 | Sprint L (Public Booking + Stripe) |
| **1.0.0** | Q1 2027 | Self-hosted + ISO 27001 |

# Roadmap — Reserti Desk Management System

> Ostatnia aktualizacja: 2026-04-28

Historia sprintów A-K → `docs/CHANGELOG.md`.

---

## Co zostało do zrobienia

### Priorytet wysoki

- **Tokeny w localStorage → httpOnly cookies** — duży zakres (backend `Set-Cookie` + frontend auth flow). Patrz `docs/BACKLOG.md` #1.
- **Floor Plan CDN (R2)** — zdjęcia pięter przechowywane jako base64 w DB (~2-3 MB/rekord). Migracja do Cloudflare R2 + URL. Patrz `docs/BACKLOG.md` #2.

### Priorytet średni

- **Sprint L** — Publiczny booking + Stripe Checkout
- **M365 calendar sync** — dwustronna sync sal konferencyjnych (rozszerzenie `GraphSyncModule`)
- **Visitor email invite** (TODO w `visitors.service.ts`)
- **`as any` cleanup (136x)** — generowanie typów z OpenAPI (`openapi-typescript`)
- **Playwright E2E testy** — scenariusze golden path (rezerwacja, check-in, admin)

### Priorytet niski

- Gateway auto-setup.sh (Faza 1) — Raspberry Pi `@reboot` cron
- Kiosk link w UI — przycisk otwierający `/kiosk?location=` z `OrganizationsPage`
- Demo mode fixtures — kompletne dane dla wszystkich stron (`VITE_DEMO_MODE=true`)
- Cloud MQTT / Gateway SaaS (Faza 3) — beacony TLS bez lokalnego Pi
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
| 0.17.4 | ✅ 2026-04-25 | Bugfix Sprint (K1–K6) + UX Mapy + Date Picker + Nowe UX (N-F1–N-F10) |
| 0.17.5 | ✅ 2026-04-26 | Floor Plan Portal + Notifications List + Reservations Redesign |
| 0.17.6 | ✅ 2026-04-27 | Walidacje check-in przez web + logika LED RESERVED |
| **0.18.0** | Q2 2026 | Public booking (Stripe) + Sprint L |
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

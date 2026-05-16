# Roadmap — Reserti Desk Management System

> Ostatnia aktualizacja: 2026-05-16

Historia sprintów A-K → `docs/CHANGELOG.md`.

| Wersja | Data | Zakres |
|--------|------|--------|
| 0.21.0 | 2026-05-16 | Sprint FREE TIER + Tech debt (UserContext, QR print, RegisterOrg, free plan) |

---

## Co zostało do zrobienia

### Priorytet wysoki

- **R2 env vars w Coolify** — kod gotowy (`r2.service.ts`), brakuje 5 env vars. Patrz BACKLOG.md #17.

### Priorytet średni

- **M365 calendar sync — sale** — rozszerzenie `GraphSyncModule` o `Booking` model
- **Playwright CI secrets** — `TEST_DATABASE_URL` w GitHub Secrets

### Priorytet niski

- **Gateway Faza 2** — dedykowany obraz Raspberry Pi OS (.img przez pi-gen)
- **ISO 27001** — audyt procesów, dokumentacja kontrolek
- **OpenAPI-typescript** — generowanie typów z Swagger

### FUTURE (nie planować)

- Sprint L (Stripe + publiczny booking) — odłożony na decyzję
- Cloud MQTT / Gateway SaaS (Faza 3) — gdy klientów > 10

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

## ✅ Polityka haseł — ZAIMPLEMENTOWANE (v0.17.9, 2026-05-07)

Część przygotowań do ISO 27001. Dotyczy tylko kont z hasłem lokalnym (konta SSO są wyłączone).

### Schemat (migracja `20260507000002_password_policy`)

```prisma
model Organization {
  passwordExpiryDays  Int?   // null = brak rotacji; 1-365 = dni do wygaśnięcia
}
model User {
  mustChangePassword  Boolean   @default(false)
  passwordChangedAt   DateTime? // null = używaj createdAt jako fallback
}
```

### Endpointy (zaimplementowane)

```
POST /api/v1/organizations/:id/force-password-reset   ← SUPER_ADMIN (własna org) + OWNER
POST /api/v1/owner/organizations/:id/force-password-reset  ← OWNER — per org
POST /api/v1/owner/force-password-reset               ← OWNER — cała platforma
PATCH /api/v1/owner/organizations/:id                 ← passwordExpiryDays w UpdateOrgDto
PATCH /api/v1/auth/change-password                    ← zeruje flagę, zapisuje passwordChangedAt
```

### Flow (zaimplementowany)

- `login()` i `getMe()` wywołują `_checkPasswordExpiry()` — automatyczny reset flagi gdy minęło `passwordExpiryDays` dni
- `MustChangePasswordGate` w `App.tsx` — redirect `/change-password` gdy `mustChangePassword=true`
- Cron `0 7 * * *` w `SubscriptionsModule.checkPasswordExpiry()` — bulk-update wygasłych haseł
- Jawny whitelist ról: `{ in: ['END_USER', 'STAFF', 'OFFICE_ADMIN', 'SUPER_ADMIN'] }` — OWNER i konta SSO wykluczone
- `_assertSameOrg()` — SUPER_ADMIN ograniczony do własnej org
- OwnerPage: przycisk "🔐 Reset haseł" per org + "🔐 Reset haseł (wszystkie)" w toolbarze
- `EditOrgModal`: pole `passwordExpiryDays` (1–365 lub brak)

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
| 0.17.9 | ✅ 2026-05-07 | Polityka haseł + KioskLinkButton + Demo fixtures + code review |
| 0.17.10 | ✅ 2026-05-08 | Code review cleanup — ResourcesPage typy |
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

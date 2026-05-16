# Roadmap — Reserti Desk Management System

> Ostatnia aktualizacja: 2026-05-17

---

## Co zostało do zrobienia

### Priorytet wysoki

- **R2 env vars w Coolify** — kod gotowy (`r2.service.ts`), brakuje 5 env vars w Coolify dla serwisu `desk-backend`. Patrz BACKLOG.md #17.
- **`VITE_DEMO_MODE=true` w `.env.development`** — po gate z v0.21.2 konta testowe zniknęły z dev; dodać do lokalnego env przed kolejną sesją demo.

### Priorytet średni

- **Email verification przy `register-org`** — `POST /auth/register-org` tworzy aktywne konto bez potwierdzenia emaila. Minimalne zabezpieczenie: pole `emailVerified: false`, gate przy logowaniu, email z linkiem aktywacyjnym.
- **M365 calendar sync — sale** — rozszerzenie `GraphSyncModule` o model `Booking`; dwustronna synchronizacja rezerwacji sal konferencyjnych z Outlook (BACKLOG #4/#18).
- **Playwright CI secrets** — `TEST_DATABASE_URL` w GitHub Secrets, żeby workflow `playwright.yml` działał na CI (BACKLOG #20).
- **OpenAPI-typescript** — generowanie typów frontendu z Swagger; eliminacja `as any` (136×) (BACKLOG #6/#19).

### Priorytet niski

- **`isSsoOnly` jako boolean** — zastąpienie hardcoded markera `'AZURE_SSO_ONLY'` w `passwordHash` dedykowanym polem `Boolean` w modelu `User`; wymaga migracji Prisma.
- **`useDirtyGuard` w `EditLocationModal`** — ostatni modal bez ochrony przed przypadkowym zamknięciem (reszta: EditOrgModal, UsersPage, DesksPage, ResourcesPage, VisitorsPage — już ma) (BACKLOG #9).
- **ISO 27001** — audyt procesów, dokumentacja kontrolek (BACKLOG #15).

---

## FUTURE (nie planować teraz)

- **Sprint L — Stripe + publiczny booking** — biurko/sala z flagą `isPublic`, Checkout Session Stripe → webhook → `Reservation`, nowy `PublicBookingModule`. Odłożony do decyzji biznesowej (BACKLOG #3).
- **Gateway Faza 2 — dedykowany obraz OS** — gotowy `.img` przez `pi-gen` + GitHub Actions, admin wgrywa kartę SD. Po Fazie 1 (✅ done).
- **Gateway Faza 3 — Cloud MQTT / SaaS** — beacony TLS → `mqtt.reserti.pl:8883` (Mosquitto + Cloudflare Spectrum), brak lokalnego Pi. Opłacalne gdy biur > 10 (BACKLOG #14).
- **Playwright E2E testy** — scenariusze golden path: rezerwacja, check-in, admin CRUD (BACKLOG #7). Blokuje brak `TEST_DATABASE_URL` w CI.
- **`1.0.0` — self-hosted + ISO 27001** — plan Q1 2027.

---

## Harmonogram wydań

| Wersja | Data | Co zawiera |
|--------|------|-----------|
| 0.11.0 | ✅ 2026-04-15 | i18n + PWA + testy + OTA + notyfikacje |
| 0.12.0 | ✅ 2026-04-17 | Sprinty A, D, E, G, H, I, J, B + naprawa Prisma |
| 0.17.0 | ✅ 2026-04-19 | Sprint F — Teams Bot, Graph Sync, Google SSO, AI Insights, Integracje |
| 0.17.1 | ✅ 2026-04-21 | Security fixes + status colors + brand token |
| 0.17.2 | ✅ 2026-04-22 | Lucide icons + i18n audit + multi-floor backend + KioskPage PWA |
| 0.17.3 | ✅ 2026-04-23 | UX fixes + flow rejestracji + demo mode + code review |
| 0.17.4 | ✅ 2026-04-25 | Bugfix Sprint K1–K6 + mapa UX + date picker + N-F1–N-F10 |
| 0.17.5 | ✅ 2026-04-26 | Floor Plan Portal + lista powiadomień + redesign rezerwacji |
| 0.17.6 | ✅ 2026-04-27 | Walidacje check-in przez web + logika LED RESERVED |
| 0.17.9 | ✅ 2026-05-07 | Polityka haseł + KioskLinkButton + demo fixtures |
| 0.17.10 | ✅ 2026-05-08 | Code review cleanup — ResourcesPage typy |
| 0.17.11 | ✅ 2026-05-12 | Gateway OTA pipeline — `ota_release.py`, Ed25519, `.gitignore` |
| 0.17.12 | ✅ 2026-05-12 | NFC Card Scan Flow — 6 bugów gateway/beacon/backend + DirtyGuard |
| 0.18.0 | ✅ 2026-05-13 | Moduł BEACONS — tryb LITE/FULL, gate IoT nav, DevicesPage/ProvisioningPage |
| 0.19.0 | ✅ 2026-05-14 | Moduł Parking — grupy, blokady, QR check-in, raporty parkingowe |
| 0.19.2 | ✅ 2026-05-14 | Security: org isolation, kiosk PIN per lokalizacja, SearchDropdown UX |
| 0.19.3 | ✅ 2026-05-15 | Security: SSRF, brute-force gateway, OAuth DTO, noImplicitAny |
| 0.19.4 | ✅ 2026-05-16 | Security: open redirect, cross-tenant reservations, demo guard build |
| 0.19.5 | ✅ 2026-05-16 | Security: SSRF IPv6, cross-tenant recurring cancel, Google code → hash |
| 0.19.6 | ✅ 2026-05-16 | Security: timing attack, webhook body DTO, UUID validation, notes MaxLength |
| 0.20.0 | ✅ 2026-05-16 | UI unification — design tokens, Tabler icons, org logo + white-label |
| 0.21.0 | ✅ 2026-05-16 | FREE tier, UserContext, QR sticker print, self-service RegisterOrg |
| 0.21.1 | ✅ 2026-05-16 | Code review fixes — XSS, form submit, UserRole cast, API dedup |
| 0.21.2 | ✅ 2026-05-17 | Security hardening — XSS ×2, bcrypt, throttle, pełna migracja localStorage |

---

## Gateway Provisioning — Plan Rozwoju

Cel: **5 minut lub mniej, zero wiedzy technicznej** (poprzednio ~30 min per biuro).

### ✅ Faza 1 — Auto-konfiguracja przez QR kod (DONE v0.21.0)

Admin skanuje QR z panelu → Pi samo się konfiguruje przez token instalacyjny.

`POST /gateway/setup-tokens` + `GET /install/gateway/:token` → `install.sh` v1.1 (systemd, Mosquitto ACL, auto-start).

### Faza 2 — Dedykowany obraz OS (FUTURE)

Gotowy `.img` budowany przez `pi-gen` z GitHub Actions. Admin wgrywa kartę SD, wpisuje WiFi + token — reszta automatyczna.

**Szacunek: 3–5 dni**

### Faza 3 — Gateway jako usługa SaaS / Cloud MQTT (FUTURE)

Beacony łączą się bezpośrednio przez TLS do `mqtt.reserti.pl:8883` (Mosquitto + Cloudflare Spectrum). Brak Raspberry Pi.

Opłacalne: gdy biur > 10 lub klienci bez lokalnego IT. **Szacunek: 1–2 tygodnie**

---

## ✅ Polityka haseł — ZAIMPLEMENTOWANE (v0.17.9, 2026-05-07)

Część przygotowań do ISO 27001. Dotyczy tylko kont z hasłem lokalnym (konta SSO wykluczone).

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

### Endpointy

```
POST /api/v1/organizations/:id/force-password-reset   ← SUPER_ADMIN (własna org) + OWNER
POST /api/v1/owner/organizations/:id/force-password-reset  ← OWNER — per org
POST /api/v1/owner/force-password-reset               ← OWNER — cała platforma
PATCH /api/v1/owner/organizations/:id                 ← passwordExpiryDays w UpdateOrgDto
PATCH /api/v1/auth/change-password                    ← zeruje flagę, zapisuje passwordChangedAt
```

### Flow

- `login()` i `getMe()` wywołują `_checkPasswordExpiry()` — auto-reset flagi gdy minęło `passwordExpiryDays` dni
- `MustChangePasswordGate` w `App.tsx` — redirect `/change-password` gdy `mustChangePassword=true`
- Cron `0 7 * * *` w `SubscriptionsModule.checkPasswordExpiry()` — bulk-update wygasłych haseł
- Whitelist ról: `{ in: ['END_USER', 'STAFF', 'OFFICE_ADMIN', 'SUPER_ADMIN'] }` — OWNER i SSO wykluczone
- `_assertSameOrg()` — SUPER_ADMIN ograniczony do własnej org

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

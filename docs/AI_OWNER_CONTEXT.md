# Panel Owner — Kontekst dla narzędzi AI

> Kontekst modułu Owner Panel.
> Ostatnia aktualizacja: 2026-04-15 — v0.11.0
> Status: ✅ ZAIMPLEMENTOWANY — backend + frontend w pełni gotowe

---

## Czym jest Owner Panel

Narzędzie operatora platformy Reserti. Umożliwia:
- Zarządzanie wszystkimi firmami-klientami (CRUD organizacji)
- Wchodzenie do panelu każdej firmy bez hasła (impersonacja)
- Monitoring infrastruktury IoT globalnie (gateway + beacony)
- **Zarządzanie subskrypcjami klientów (planowane v0.12.0)**

**Dostęp:** Unified Panel (`app.prohalw2026.ovh`) → rola OWNER

---

## Hierarchia ról

```
OWNER              ← operator platformy Reserti (jeden na platformę)
  └── SUPER_ADMIN  ← admin firmy-klienta (widzi tylko swoją org)
        └── OFFICE_ADMIN  ← admin biura
              └── STAFF   ← recepcja
                    └── END_USER  ← pracownik
```

---

## API — Owner endpoints

```
GET    /owner/organizations              — lista wszystkich org
POST   /owner/organizations              — utwórz org (+ konto SUPER_ADMIN)
PATCH  /owner/organizations/:id          — aktualizuj (plan, isActive, notes)
DELETE /owner/organizations/:id          — dezaktywuj (soft delete)
POST   /owner/organizations/:id/impersonate  — token JWT 30min jako SUPER_ADMIN tej org
GET    /owner/stats                      — metryki globalne platformy
GET    /owner/health                     — health wszystkich gateway + beaconów
GET    /owner/health/:orgId              — health jednej org

# Planowane v0.12.0 — Subskrypcje
GET    /owner/organizations/:id/subscription        — stan subskrypcji org
POST   /owner/organizations/:id/subscription        — zmiana planu / odnowienie
GET    /owner/organizations/:id/subscription/events — historia zmian
GET    /owner/subscription/dashboard                — MRR + wygasające
```

---

## Model Organization — pola Owner

```prisma
model Organization {
  id             String    @id @default(cuid())
  name           String
  slug           String    @unique
  isActive       Boolean   @default(true)

  // Plan i billing
  plan           String    @default("starter")   // starter|pro|enterprise|trial
  planExpiresAt  DateTime?                        // null = bezterminowy
  trialEndsAt    DateTime?                        // null = nie trial
  limitDesks     Int?                             // null = ∞
  limitUsers     Int?
  limitGateways  Int?
  limitLocations Int?
  mrr            Int?      // Monthly Recurring Revenue w groszach PLN
  billingEmail   String?
  billingNotes   String?   @db.Text

  // Metadane Ownera
  notes          String?   @db.Text
  contactEmail   String?
  createdBy      String?   // userId Ownera

  // M365/Entra ID (konfigurowane przez SUPER_ADMIN)
  azureTenantId  String?
  azureEnabled   Boolean   @default(false)
}
```

---

## Plany subskrypcji

| Plan | Biurka | Użytkownicy | Gatewaye | Biura | OTA | SSO |
|------|--------|-------------|----------|-------|-----|-----|
| starter | 10 | 25 | 1 | 1 | ✗ | ✗ |
| pro | 50 | 150 | 3 | 5 | ✓ | ✓ |
| enterprise | ∞ | ∞ | ∞ | ∞ | ✓ | ✓ |
| trial | 10 | 10 | 1 | 1 | ✗ | ✗ |

Limity są miękkie — przekroczenie wyświetla ostrzeżenia, nie blokuje działania.

---

## Impersonacja — flow

```
1. OWNER → OwnerPage → Firmy → [Impersonuj]
2. POST /owner/organizations/:id/impersonate
3. Backend: findFirst SUPER_ADMIN tej org + audit log (OWNER_IMPERSONATION Event)
4. JWT 30min z { impersonated: true } — nieprzedłużalny
5. Redirect: /auth/impersonate?token=...
6. Panel wyświetla baner "Przeglądasz jako: admin@firma.pl [Wróć]"
```

**Audit trail:** `Event.type = 'OWNER_IMPERSONATION'`, `payload: { ownerId, orgId, at }`

---

## Statystyki Owner Dashboard

```typescript
// GET /owner/stats
{
  orgsTotal: number,        // wszystkie org
  orgsActive: number,       // isActive=true
  orgsInactive: number,
  gatewaysTotal: number,
  gatewaysOnline: number,   // isOnline=true
  beaconsTotal: number,
  beaconsOnline: number,
  checkinsToday: number,    // Checkin.createdAt >= dzisiaj
  checkinsWeek: number,
  // Planowane v0.12.0:
  mrrTotal: number,         // suma mrr wszystkich aktywnych org (PLN gr)
  orgsExpiringSoon: number  // planExpiresAt < now + 14dni
}
```

---

## Health monitoring

```typescript
// OwnerHealthService
const GATEWAY_STALE_MINUTES = 5;
const BEACON_STALE_MINUTES = 10;

// Status: 'healthy' | 'stale' | 'offline'
// healthy: lastSeen < stale threshold
// stale:   lastSeen > threshold ale isOnline=true
// offline: isOnline=false lub lastSeen null
```

---

## Frontend — OwnerPage

`src/pages/OwnerPage.tsx` — zakładki:

1. **Dashboard** — KPI cards (statCards), tabela org z akcjami
2. **Subskrypcje (planowane v0.12.0)** — tabela org z planem, ważnością, MRR

**Akcje per organizacja:**
- `Impersonuj` → otwiera nową kartę z tokenem
- `Edytuj` → modal (plan, isActive, notes, billingEmail)
- `Deaktywuj` / `Aktywuj` → toggle isActive

**OwnerGuard** — `src/pages/OwnerPage.tsx` dostępna tylko dla `role === 'OWNER'`.
W AppLayout sidebar wyświetla link "Owner" tylko dla OWNER.

---

## Subskrypcje — planowany moduł (v0.12.0)

Szczegółowa specyfikacja: `docs/subscription.md`

**SUPER_ADMIN widzi** (`/subscription`):
- PlanBadge (Starter/Pro/Enterprise/Trial)
- Ważność planu + liczba dni
- UsageBar per zasób (biurka/users/gateways/locations)
- FeatureList (OTA, SSO, SMTP)
- ExpiryBanner w AppLayout przy < 14 dni

**OWNER zarządza** (zakładka "Subskrypcje" w OwnerPage):
- Tabela org: Firma | Plan | Status | Wygasa | MRR | Akcje
- Modal zmiany planu (plan, planExpiresAt, limity, mrr, billingEmail)
- Historia zmian (SubscriptionEvent per org)
- KPI: MRR total, wygasające, na trialu

**API dla SUPER_ADMIN:**
```
GET /subscription/status
→ { plan, planExpiresAt, daysUntilExpiry, status, usage: { desks, users, gateways, locations }, features, warnings }
```

**Bezpieczeństwo:** `mrr`, `billingNotes` — tylko dla OWNER, nigdy nie zwracane do SUPER_ADMIN.

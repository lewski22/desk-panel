# Moduł Subskrypcji — Reserti

> Dokument specyfikacji. Status: **zaplanowane** (v0.12.0)

---

## Cel

SUPER_ADMIN każdej organizacji widzi aktualny stan swojej subskrypcji:
- do kiedy opłacony abonament,
- ile zasobów jest wykorzystanych vs. ile zawiera plan,
- ostrzeżenia przy zbliżającym się wygaśnięciu.

OWNER zarządza planami klientów z panelu operatora (Owner Panel).

---

## Plany subskrypcji

| Plan | Biurka | Użytkownicy | Gatewaye | Biura | OTA FW | SSO | Wsparcie |
|------|--------|-------------|----------|-------|--------|-----|----------|
| **Starter** | 10 | 25 | 1 | 1 | ✗ | ✗ | Email |
| **Pro** | 50 | 150 | 3 | 5 | ✓ | ✓ | Email 24h |
| **Enterprise** | ∞ | ∞ | ∞ | ∞ | ✓ | ✓ | Dedykowane |
| **Trial** | 10 | 10 | 1 | 1 | ✗ | ✗ | — |

Limity są **miękkie** — przekroczenie nie blokuje działania systemu, ale wyświetla
ostrzeżenia SUPER_ADMINowi i powiadamia OWNERa.

---

## Schemat bazy danych

Rozszerzenie istniejącego modelu `Organization`:

```prisma
model Organization {
  // ... istniejące pola ...

  plan           String    @default("starter") // starter|pro|enterprise|trial
  planExpiresAt  DateTime?                     // null = bezterminowy (Enterprise legacy)
  trialEndsAt    DateTime?                     // null = nie trial

  // Limity per plan (null = nieograniczony)
  limitDesks     Int?      // null = ∞ (Enterprise)
  limitUsers     Int?      // null = ∞
  limitGateways  Int?      // null = ∞
  limitLocations Int?      // null = ∞

  // Billing
  billingEmail   String?
  billingNotes   String?   @db.Text
  nextInvoiceAt  DateTime?
  mrr            Int?      // Monthly Recurring Revenue w groszach PLN

  // ... pozostałe relacje ...
}

model SubscriptionEvent {
  id             String   @id @default(cuid())
  organizationId String
  type           String   // plan_changed | renewed | expired | trial_started | limit_exceeded
  previousPlan   String?
  newPlan        String?
  changedBy      String?  // userId OWNERa
  note           String?  @db.Text
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

Migracja: `20260420000001_subscription_events.sql`

---

## API Endpoints

### Dla SUPER_ADMIN (własna organizacja)

```
GET /subscription/status
```
Zwraca stan subskrypcji własnej organizacji.

**Response:**
```json
{
  "plan": "pro",
  "planExpiresAt": "2026-07-01T00:00:00.000Z",
  "trialEndsAt": null,
  "daysUntilExpiry": 77,
  "status": "active",            // active | expiring_soon | expired | trial | trial_expiring
  "usage": {
    "desks":     { "used": 23, "limit": 50,  "pct": 46 },
    "users":     { "used": 67, "limit": 150, "pct": 45 },
    "gateways":  { "used": 2,  "limit": 3,   "pct": 67 },
    "locations": { "used": 3,  "limit": 5,   "pct": 60 }
  },
  "features": {
    "ota":        true,
    "sso":        true,
    "api_access": true
  },
  "warnings": []
}
```

**Status expiry:**
- `expiring_soon` — < 14 dni do wygaśnięcia
- `trial_expiring` — < 7 dni do końca trialu
- `expired` — plan wygasł (system nadal działa, ale zablokowane nowe zasoby)

---

### Dla OWNER (zarządzanie klientami)

```
GET  /owner/organizations/:id/subscription   — stan subskrypcji org
POST /owner/organizations/:id/subscription   — zmiana planu / odnowienie
GET  /owner/organizations/:id/subscription/events — historia zmian
GET  /owner/subscription/dashboard           — przegląd wszystkich org (MRR, wygasające)
```

**POST body (zmiana planu):**
```json
{
  "plan": "pro",
  "planExpiresAt": "2026-10-01T00:00:00.000Z",
  "limitDesks": 50,
  "limitUsers": 150,
  "limitGateways": 3,
  "limitLocations": 5,
  "mrr": 39900,
  "billingEmail": "finanse@firma.pl",
  "note": "Odnowienie roczne — FV 123/2026"
}
```

---

## Frontend — SUPER_ADMIN

### SubscriptionPage (`/subscription`)

Dostępna z sidebara (nowy element nawigacji, tylko SUPER_ADMIN).

**Layout strony:**

```
┌─────────────────────────────────────────────────────────┐
│  Plan: Pro                              ✓ Aktywny       │
│  Ważny do: 1 lipca 2026 (77 dni)                        │
│  📩 Kontakt: finanse@firma.pl                           │
└─────────────────────────────────────────────────────────┘

┌─ Wykorzystanie zasobów ─────────────────────────────────┐
│  Biurka        ████████░░░░░░  23 / 50   (46%)          │
│  Użytkownicy   █████████░░░░░  67 / 150  (45%)          │
│  Gatewaye      ██████████████  2 / 3     (67%)  ⚠       │
│  Biura         ████████████░░  3 / 5     (60%)          │
└─────────────────────────────────────────────────────────┘

┌─ Funkcje planu ─────────────────────────────────────────┐
│  ✓ Aktualizacje OTA firmware                            │
│  ✓ Logowanie Microsoft (SSO Entra ID)                   │
│  ✓ Własna skrzynka SMTP                                 │
│  ✗ API access (Enterprise)                              │
└─────────────────────────────────────────────────────────┘

  Chcesz rozszerzyć plan? Skontaktuj się z Reserti ↗
```

**Komponenty:**
- `PlanBadge` — kolorowy badge (Starter=zinc, Pro=indigo, Enterprise=gold, Trial=amber)
- `UsageBar` — pasek postępu z procentem i kolorem (zielony < 70%, żółty 70–89%, czerwony ≥ 90%)
- `FeatureList` — lista funkcji planu (✓/✗)
- `ExpiryBanner` — żółty/czerwony baner przy < 14 dni do wygaśnięcia

### Baner w AppLayout

Przy zbliżającym się wygaśnięciu (< 14 dni) i po wygaśnięciu:

```
⚠ Twój plan wygasa za 6 dni (1 lipca 2026). Skontaktuj się z administratorem.
                                                              [Szczegóły →]
```

Baner pojawia się pod headerem sidebara, sticky, z możliwością dismiss (cookie 24h).

---

## Frontend — OWNER Panel

Rozszerzenie istniejącego `OwnerPage`:

### Zakładka "Subskrypcje"

Tabela wszystkich org z kolumnami: Firma | Plan | Status | Wygasa | MRR | Akcje.

**Filtry:**
- Status: Aktywne / Wygasające (< 14 dni) / Wygasłe / Trial
- Plan: Starter / Pro / Enterprise

**Akcje:**
- `Odnów` — modal z datą odnowienia i kwotą
- `Zmień plan` — pełny formularz edycji subskrypcji
- `Historia` — lista `SubscriptionEvent` per org

### Statystyki MRR (Owner Dashboard)

Nowe KPI na Owner Dashboard:
- **MRR** — suma `mrr` wszystkich aktywnych org (w PLN)
- **Wygasające** — liczba org z `daysUntilExpiry < 14`
- **Trial** — liczba org na trial
- **Churn risk** — org z utilization > 85% (mogą odejść lub potrzebują upgrade)

---

## Powiadomienia automatyczne

### Dla SUPER_ADMIN (email + in-app)

| Trigger | Kiedy | Typ |
|---------|-------|-----|
| Plan wygasa | 30, 14, 7, 1 dzień przed | email |
| Trial wygasa | 7, 3, 1 dzień przed | email + in-app |
| Plan wygasł | w dniu wygaśnięcia | email + in-app |
| Limit > 80% | przy każdym przekroczeniu | in-app |
| Limit > 95% | co 24h | email + in-app |

### Dla OWNER

| Trigger | Kiedy | Kanał |
|---------|-------|-------|
| Klient wygasa | 7 dni przed | in-app (Owner bell) |
| Plan wygasł | w dniu wygaśnięcia | in-app |

---

## Implementacja — etapy

### Etap 1 — Schema + API (2 dni)

- Migracja Prisma: `SubscriptionEvent` model
- `SubscriptionsService` — `getStatus(orgId)`, `updatePlan(orgId, dto)`, `getEvents(orgId)`
- `GET /subscription/status` — chroniony JwtAuthGuard + rola SUPER_ADMIN
- `POST /owner/organizations/:id/subscription` — chroniony RolesGuard(OWNER)
- `GET /owner/subscription/dashboard` — agregacja MRR + wygasające

### Etap 2 — Frontend SUPER_ADMIN (2 dni)

- `SubscriptionPage.tsx` — pełna strona z komponentami
- `PlanBadge`, `UsageBar`, `FeatureList`, `ExpiryBanner` — reusable components
- `AppLayout` — baner przy zbliżającym się wygaśnięciu (polling co 5min)
- `api/client.ts` — `appApi.subscription.getStatus()`
- i18n klucze: `subscription.*` (PL + EN)

### Etap 3 — Owner Panel (1 dzień)

- Zakładka "Subskrypcje" w OwnerPage
- Modal edycji planu z walidacją
- Historia SubscriptionEvent per org
- MRR KPI w Owner Dashboard

### Etap 4 — Notyfikacje (1 dzień)

- Cron `checkExpiringSubscriptions()` co 24h — wysyła email + in-app
- Cron `checkResourceLimits()` co 6h — sprawdza utilization > 80%/95%
- Nowe typy notyfikacji: `SUBSCRIPTION_EXPIRING`, `SUBSCRIPTION_EXPIRED`, `LIMIT_WARNING`

**Łączny szacunek: 6 dni**

---

## i18n — nowe klucze

```json
// pl/translation.json — nowe klucze
{
  "subscription": {
    "title": "Subskrypcja",
    "plan": "Plan",
    "status": {
      "active": "Aktywny",
      "expiring_soon": "Wygasa wkrótce",
      "expired": "Wygasły",
      "trial": "Okres próbny",
      "trial_expiring": "Trial wygasa"
    },
    "valid_until": "Ważny do",
    "days_left": "{{count}} dni",
    "trial_ends": "Koniec trialu",
    "usage": {
      "title": "Wykorzystanie zasobów",
      "desks": "Biurka",
      "users": "Użytkownicy",
      "gateways": "Gatewaye",
      "locations": "Biura",
      "unlimited": "∞",
      "of": "z"
    },
    "features": {
      "title": "Funkcje planu",
      "ota": "Aktualizacje OTA firmware",
      "sso": "Logowanie Microsoft (SSO)",
      "smtp": "Własna skrzynka SMTP",
      "api": "API access"
    },
    "expiry_banner": "Twój plan wygasa za {{days}} dni ({{date}}). Skontaktuj się z administratorem.",
    "expired_banner": "Twój plan wygasł {{date}}. Nowe zasoby są zablokowane.",
    "contact_cta": "Chcesz rozszerzyć plan? Skontaktuj się z Reserti"
  }
}
```

---

## Env vars (nowe)

```env
# Brak nowych zmiennych środowiskowych — wszystko w DB
# Opcjonalnie dla przyszłych płatności automatycznych:
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Bezpieczeństwo

- `GET /subscription/status` — tylko SUPER_ADMIN własnej org (filtrowany przez JWT `organizationId`)
- `POST /owner/organizations/:id/subscription` — tylko OWNER (RolesGuard)
- `mrr` i `billingNotes` nigdy nie zwracane do SUPER_ADMIN — tylko OWNER widzi dane finansowe
- `planExpiresAt` i `trialEndsAt` są zwracane do SUPER_ADMIN (potrzebne do wyświetlenia w UI)

---

## Powiązania z innymi modułami

| Moduł | Powiązanie |
|-------|-----------|
| NotificationsService | Wysyła emaile o wygasaniu subskrypcji |
| InAppNotificationsService | Tworzy powiadomienia in-app dla SUPER_ADMIN |
| OwnerModule | Endpoint zarządzania planami |
| OrganizationsModule | Rozszerzenie modelu Organization |
| AppLayout | Baner ExpiryBanner |

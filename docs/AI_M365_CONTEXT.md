# Moduł M365 / Entra ID — Kontekst dla narzędzi AI

> Szczegółowy kontekst modułu Microsoft 365.
> Uzupełnienie do `AI_CONTEXT.md` i `AI_BACKEND_CONTEXT.md`.
> Ostatnia aktualizacja: 2026-03-31
> Status: PLANOWANY — żaden z poniższych plików jeszcze nie istnieje

---

## Zasada nadrzędna

**Backend Reserti = jedyne źródło prawdy.**
Teams App i Outlook Add-in tylko wyświetlają i synchronizują dane z backendu.
Żadna logika biznesowa nie żyje po stronie M365.

---

## Kluczowe decyzje projektowe

### Enterprise App, nie per-firma App Registration

Reserti ma **jedną globalną App Registration** w swoim własnym Entra ID tenant.
Każda firma-klient **nie tworzy własnej App Registration** — zamiast tego IT Admin
firmy zatwierdza Reserti jako **Enterprise Application** w swoim tenant.

```
Reserti Entra ID tenant:
  App Registration "Reserti"
    Client ID: (globalny, jeden dla wszystkich)
    Client Secret: (tylko Reserti zna)
    Redirect URIs: api.*/auth/azure/callback

Firma ABC Entra ID tenant:
  Enterprise Application "Reserti"  ← IT Admin zatwierdził consent
    Tenant ID: xxxxxxxx (ten Reserti zapisuje w DB)
    Uprawnienia: User.Read, Calendars.ReadWrite
    Widoczność: pojawia się w myapps.microsoft.com dla pracowników
```

**Korzyści modelu Enterprise App:**
- IT Admin firmy ma pełną kontrolę (Conditional Access, User Assignment, MFA)
- Reserti nie zarządza sekretami per-firma — tylko jednym globalnym
- Onboarding klienta = wklejenie jednego Tenant ID (zamiast 3 wartości)
- Enterprise App pojawia się natywnie w portalu myapps.microsoft.com

### SSO jest opcjonalne — logowanie hasłem pozostaje w Fazie 1

Strona logowania ma DWA niezależne sposoby logowania:

```
┌────────────────────────────────────┐
│  Email:    [________________]      │
│  Hasło:    [________________]      │
│                                    │
│  [    Zaloguj się    ]             │
│                                    │
│  ─────────── lub ───────────       │
│                                    │
│  [🔷 Zaloguj przez Microsoft ]    │
└────────────────────────────────────┘
```

- Przycisk Microsoft pojawia się tylko jeśli `org.azureEnabled = true`
- Jeśli firma nie skonfigurowała M365 → przycisk niewidoczny
- Email/password działa zawsze, dla wszystkich
- Wyłączenie hasła (enforce SSO) → osobna funkcja, nie w Fazie 1

---

## Przegląd faz

| Faza | Co | Pliki do stworzenia | Status |
|---|---|---|---|
| M1 | Entra ID SSO | azure-ad.strategy.ts, azure-auth.service.ts, login UI | ❌ TODO |
| M2 | Teams App | apps/teams/ (cały katalog) | ❌ TODO |
| M3 | Outlook Add-in | apps/outlook/ (cały katalog) | ❌ TODO |
| M4 | Graph Sync | src/modules/integrations/microsoft/ | ❌ TODO |
| M5 | Auto resource mailbox | rozszerzenie graph.service.ts | ❌ TODO |

---

## Architektura po pełnym wdrożeniu M365

```
┌──────────────────────────────────────────────────────────┐
│  Admin Panel (admin.prohalw2026.ovh)                     │
│  + przycisk "Zaloguj przez Microsoft"                    │
│  + sekcja "Integracja M365" w ustawieniach org           │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────┐
│  Teams App               │  Outlook Add-in               │
│  (teams.prohalw2026.ovh) │  (outlook.prohalw2026.ovh)    │
│  + manifest.json         │  + manifest.xml               │
└──────────┬───────────────┴──────────────┬────────────────┘
           │  JWT (po SSO przez Entra ID)  │
           ▼                              ▼
┌──────────────────────────────────────────────────────────┐
│  Backend NestJS (api.prohalw2026.ovh/api/v1)             │
│  + POST /auth/azure          ← wymiana tokenu Azure→JWT  │
│  + GET  /auth/azure/redirect ← start OAuth2 flow         │
│  + GET  /auth/azure/callback ← odbiór kodu od Azure      │
│  + GET  /desks/available     ← wolne biurka na slot       │
│  + GET  /locations/my        ← lokalizacje usera          │
│  + GET  /reservations/my     ← rezerwacje usera           │
│  + POST /integrations/graph/notify ← webhook od MS       │
└────────┬────────────────────────────┬────────────────────┘
         │                            │
         ▼                            ▼
    PostgreSQL               Microsoft Graph API
    (źródło prawdy)          (sync kalendarza)
```

---

## M1 — Entra ID SSO — szczegóły implementacji

### Model: jeden Client ID, per-firma Tenant ID

Nie ma Client Secret per firma. Reserti ma jedną App Registration:

```env
# .env backendu — globalne, niezmienne
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   # Client ID Reserti App Registration
AZURE_CLIENT_SECRET=...                                 # Secret tylko Reserti zna
AZURE_REDIRECT_URI=https://api.prohalw2026.ovh/auth/azure/callback
```

W bazie danych per firma przechowywany jest tylko `azureTenantId`:

```prisma
model Organization {
  azureTenantId  String?   # Tenant ID firmy (jedyne co IT Admin podaje)
  azureEnabled   Boolean   @default(false)
}
```

### Nowe pliki do stworzenia

#### `backend/src/modules/auth/strategies/azure-ad.strategy.ts`

```typescript
// Passport BearerStrategy dla tokenów Azure AD
// Weryfikuje podpis tokenu używając JWKS endpoint Azure
// Wyciąga: oid (Azure object ID), email, name, tid (tenant ID)
// JIT: jeśli User nie istnieje → tworzy z rolą END_USER
```

#### `backend/src/modules/auth/azure-auth.service.ts`

```typescript
// validateAzureToken(idToken, tenantId)
//   → weryfikuje przez MSAL lub jwks-rsa
//   → zwraca { oid, email, name, tenantId }

// getOrCreateUserFromAzure(oid, email, name, tenantId)
//   → findFirst({ azureObjectId: oid }) || create(...)
//   → mapuje tenantId → Organization (przez org.azureTenantId)

// findOrgByTenantId(tenantId)
//   → zwraca Organization z azureClientId/Secret
```

#### `backend/src/modules/auth/dto/azure-login.dto.ts`

```typescript
class AzureLoginDto {
  @IsString() idToken: string;
  @IsString() tenantId: string;
}
```

### Zmiany w istniejących plikach

#### `backend/prisma/schema.prisma`

```prisma
model Organization {
  azureTenantId  String?   // Tenant ID firmy — jedyne co IT Admin konfiguruje
  azureEnabled   Boolean   @default(false)
  // NIE ma azureClientId/Secret — używamy globalnego App Registration
}

model User {
  azureObjectId   String?  @unique  // oid z tokenu Azure
  azureTenantId   String?           // weryfikacja że user należy do właściwego tenant
}
```

#### `backend/src/modules/auth/auth.controller.ts`

Dodaj:
```typescript
@Post('azure')
loginAzure(@Body() dto: AzureLoginDto) {
  return this.azureAuthService.login(dto.idToken, dto.tenantId);
}

@Get('azure/redirect')
redirectToAzure(@Query('tenantId') tenantId: string, @Res() res: Response) {
  // redirect to Azure OAuth2 authorize endpoint
}

@Get('azure/callback')
handleAzureCallback(@Query() query: any, @Res() res: Response) {
  // wymień code na tokens, wydaj JWT Reserti
}
```

#### `apps/admin/src/pages/LoginPage.tsx`

Dodaj przycisk pod formularzem email/password — widoczny tylko gdy `azureEnabled`:

```tsx
{/* Przycisk widoczny tylko jeśli org ma azureEnabled = true */}
{azureEnabled && (
  <>
    <div className="flex items-center gap-2 my-3">
      <hr className="flex-1 border-zinc-200" />
      <span className="text-xs text-zinc-400">lub</span>
      <hr className="flex-1 border-zinc-200" />
    </div>
    <button onClick={handleMicrosoftLogin}
      className="w-full flex items-center justify-center gap-2 border border-zinc-200 rounded-lg px-4 py-2 text-sm hover:bg-zinc-50">
      <img src="/ms-logo.svg" className="w-4 h-4" />
      Zaloguj przez Microsoft
    </button>
  </>
)}
```

`handleMicrosoftLogin` → redirect do `GET /auth/azure/redirect?tenantId=orgTenantId`

### Zmienne środowiskowe (backend)

```env
# Globalne — jedna App Registration dla wszystkich firm
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=...
AZURE_REDIRECT_URI=https://api.prohalw2026.ovh/auth/azure/callback

# Nie ma zmiennych per firma — Tenant ID przechowywany w DB (Organization.azureTenantId)
```

---

## M2 — Teams App — szczegóły implementacji

### Struktura katalogu

```
apps/teams/
├── package.json         (React + Vite + @microsoft/teams-js)
├── vite.config.ts       (base: '/', port: 3003)
├── tsconfig.json
├── manifest/
│   ├── manifest.json    (Teams App manifest v1.17)
│   ├── color.png        (192x192 — ikona kolorowa)
│   └── outline.png      (32x32 — ikona monochromatyczna)
└── src/
    ├── main.tsx
    ├── App.tsx          (TeamsProvider + router)
    ├── auth/
    │   └── teamsAuth.ts (microsoftTeams.authentication.getAuthToken)
    ├── pages/
    │   ├── HomePage.tsx       (moje rezerwacje dziś + skrót do BookPage)
    │   ├── BookPage.tsx       (wybierz biurko + czas + potwierdź)
    │   └── MyBookingsPage.tsx (aktywne rezerwacje + anulowanie)
    ├── components/
    │   ├── DeskGrid.tsx       (siatka N×M z kolorami statusu)
    │   ├── TimeSlotPicker.tsx (godzina od–do, 15-min sloty)
    │   └── FloorSelector.tsx  (switcher pięter)
    └── api/
        └── client.ts          (axios + Bearer token z Teams SDK)
```

### Kluczowe: Teams SSO flow

```typescript
// src/auth/teamsAuth.ts
import * as microsoftTeams from '@microsoft/teams-js';

export async function getResertiToken(): Promise<string> {
  // 1. Pobierz token Azure od Teams SDK (bez popup)
  const azureToken = await microsoftTeams.authentication.getAuthToken();

  // 2. Wymień na JWT Reserti
  const resp = await fetch('/api/v1/auth/azure', {
    method: 'POST',
    body: JSON.stringify({ idToken: azureToken, tenantId: /* z context */ }),
  });
  return resp.json().accessToken;
}
```

### Nowe endpointy backend (M2)

```typescript
// desks.controller.ts
@Get('available')
@UseGuards(JwtAuthGuard)
findAvailable(
  @Query('locationId') locationId: string,
  @Query('date') date: string,        // YYYY-MM-DD
  @Query('startTime') startTime: string, // HH:MM
  @Query('endTime') endTime: string,
) → Desk[]  // tylko biurka bez rezerwacji w tym oknie

// locations.controller.ts
@Get('my')
@UseGuards(JwtAuthGuard)
findMyLocations(@Request() req) → Location[]
// Zwraca lokalizacje z org usera (END_USER widzi swoje biuro)

// reservations.controller.ts
@Get('my')
@UseGuards(JwtAuthGuard)
findMy(@Query('date') date: string, @Request() req) → Reservation[]
```

---

## M3 — Outlook Add-in — szczegóły implementacji

### Struktura katalogu

```
apps/outlook/
├── package.json         (React + Vite + @microsoft/office-js)
├── vite.config.ts       (base: '/', port: 3004, https: true)
├── tsconfig.json
├── manifest.xml         (Outlook Add-in manifest)
└── src/
    ├── main.tsx         (Office.onReady(() => render(<App/>)))
    ├── App.tsx          (router: login | taskpane)
    ├── utils/
    │   └── office.ts    (helpery Office.js: getItemDates, setLocation)
    ├── pages/
    │   ├── LoginPage.tsx       (MSAL popup/redirect jeśli nie zalogowany)
    │   └── TaskpaneApp.tsx     (główny widok przy tworzeniu spotkania)
    └── components/
        ├── DeskPicker.tsx      (lista wolnych biurek + filtr)
        ├── BookingForm.tsx     (daty auto-fill z event, przycisk Zarezerwuj)
        └── BookingSuccess.tsx  (potwierdzenie, biurko dodane do lokalizacji)
```

### office.ts — helpery

```typescript
// Pobierz daty spotkania z Outlooka
export function getEventDates(): { start: Date; end: Date } {
  return {
    start: Office.context.mailbox.item.start.getAsync(),
    end:   Office.context.mailbox.item.end.getAsync(),
  };
}

// Ustaw pole "Lokalizacja" w spotkaniu
export function setEventLocation(location: string) {
  Office.context.mailbox.item.location.setAsync(location);
}
```

### Ważne: HTTPS wymagane lokalnie

Outlook Add-in wymaga HTTPS nawet na localhost.
Vite config:

```typescript
// apps/outlook/vite.config.ts
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: { port: 3004, https: true },
});
```

---

## M4 — Graph Sync — szczegóły implementacji

### Nowe pliki backend

#### `src/modules/integrations/microsoft/graph.service.ts`

```typescript
// Klient Graph API per user (nie per app — używa Delegated permissions)
// Token odświeżany automatycznie przez GraphTokenService

// createCalendarEvent(userId, reservation)
//   POST /me/events
//   subject: "Reserti: Biurko A-01"
//   start/end: z reservation
//   location: { displayName: "A-01, Piętro 2" }
//   extensions: [{ id: 'reserti.deskId', value: deskId }]

// registerWebhook(userId)
//   POST /subscriptions
//   { resource: '/me/events', changeTypes: 'created,updated,deleted',
//     expirationDateTime: +72h, notificationUrl: WEBHOOK_URL }
```

#### `src/modules/integrations/microsoft/graph-webhook.controller.ts`

```typescript
// POST /integrations/graph/notify
// Dwa typy requestów od Microsoft:
// 1. Validation (GET z validationToken) → echo token z powrotem
// 2. Notification (POST z body) → process change

// Walidacja podpisu (X-Ms-Signature header)
// Obsługa changeType:
//   'updated' → znajdź rezerwację po outlookEventId → zaktualizuj godziny
//   'deleted' → anuluj rezerwację → MQTT → LED zielony
```

#### `src/modules/integrations/microsoft/graph-sync.service.ts`

```typescript
// @Cron('0 */5 * * * *')  — co 5 minut
// syncRecentEvents(): delta query od ostatniego sync

// @Cron('0 0 */3 * * *')  — co 3 dni
// renewExpiringWebhooks(): odnów subskrypcje wygasające w ciągu 24h
```

### Zabezpieczenie tokenów użytkowników w DB

Tokeny OAuth2 Graph (access token, refresh token) przechowywane w tabeli `GraphToken`
**muszą być szyfrowane** — to tokeny delegowane do kalendarzy użytkowników.

```typescript
// src/common/utils/encrypt.ts
// encrypt(token, key): string  → base64(iv + ciphertext + tag)
// decrypt(encrypted, key): string  → plaintext
// Klucz: process.env.AZURE_SECRET_ENCRYPTION_KEY (32 bajty hex)
```

```env
AZURE_SECRET_ENCRYPTION_KEY=32-byte-hex  # do szyfrowania GraphToken w DB
```

---

## Nowe domeny do skonfigurowania w Coolify + Cloudflare

| Serwis | Domena | Port |
|---|---|---|
| Teams App | teams.prohalw2026.ovh | 3003 |
| Outlook Add-in | outlook.prohalw2026.ovh | 3004 |

Oba wymagają HTTPS (Cloudflare Tunnel zapewnia automatycznie).

---

## Czego NIE zmieniać przy implementacji M365

- `jwt.strategy.ts` — nie modyfikuj istniejącej walidacji JWT
- Endpointy `/auth/login`, `/auth/refresh`, `/auth/logout` — bez zmian
- Struktura modułów NestJS — dodaj `IntegrationsModule`, nie modyfikuj innych
- Firmware ESP32 i gateway — brak zmian
- Staff Panel (apps/staff) — brak zmian (Teams App to osobna aplikacja)
- MQTT topics i LED komendy — brak zmian

---

## Kolejność implementacji (rekomendowana)

```
Tydzień 1: M1 (SSO)
  - Prisma: dodaj azureObjectId, azureTenantId do User; azure* do Organization
  - backend: azure-ad.strategy.ts + azure-auth.service.ts
  - backend: POST /auth/azure + GET /auth/azure/redirect + callback
  - admin panel: przycisk "Zaloguj przez Microsoft"
  - admin panel: formularz konfiguracji Azure w ustawieniach org

Tydzień 2-3: M3 (Outlook Add-in) — wyższy priorytet niż M2
  - apps/outlook/: kompletny scaffold
  - backend: GET /desks/available
  - Testowanie na OWA (office.com)

Tydzień 4-5: M4 (Graph Sync)
  - GraphToken, GraphSubscription w Prisma
  - graph.service.ts + webhook controller
  - Integracja z reservations.service.ts (create/cancel → Graph)

Tydzień 5-6: M2 (Teams App)
  - apps/teams/: kompletny scaffold
  - manifest.json + sideloading w Teams developer sandbox

Opcjonalnie: M5 (Auto resource mailbox)
  - Tylko jeśli klient ma Exchange Online i potrzebuje resource mailbox
```

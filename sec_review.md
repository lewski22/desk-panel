# Security Review — Desk Panel

**Branch:** `main` (clean, no uncommitted changes)  
**Date:** 2026-04-23  
**Reviewer:** Claude Sonnet 4.6 (automated)

---

## Część 1 — Audyt podatności bezpieczeństwa

### Wynik audytu

Po przeprowadzeniu pełnego audytu bezpieczeństwa i równoległej weryfikacji każdego znaleziska przez dedykowany filtr fałszywych pozytywów — **żadne znalezisko nie uzyskało confidence ≥ 8/10** wymaganego do zakwalifikowania jako exploitable vulnerability.

### Ocenione znaleziska

| # | Znalezisko | Plik | Confidence | Werdykt |
|---|-----------|------|------------|---------|
| 1 | CSRF State Fixation (Graph OAuth) | `backend/src/modules/graph-sync/graph.controller.ts:76` | 2/10 | ODRZUCONE |
| 2 | OAuth Nonce Store (Google) | `backend/src/modules/auth/google-auth.service.ts:21` | 1/10 | ODRZUCONE |
| 3 | Webhook Header Injection | `backend/src/modules/integrations/providers/webhook.provider.ts:128` | 2/10 | ODRZUCONE |
| 4 | Impersonation Token w URL | `backend/src/modules/owner/owner.service.ts:181` | 2/10 | ODRZUCONE |
| 5 | Kiosk PIN Timing Attack | `backend/src/modules/locations/locations.service.ts:61` | 3/10 | ODRZUCONE |
| 6 | Bash Script Template Injection | `backend/src/modules/gateways/install.controller.ts:56` | 3/10 | ODRZUCONE |
| 7 | SSO Field Prisma Injection | `backend/src/modules/auth/auth.service.ts:88` | 2/10 | ODRZUCONE |

### Uzasadnienia odrzuceń

- **OAuth in-memory stores** (#1, #2): Deployment jest single-instance (docker-compose, jeden kontener). Theoretical multi-instance concern nie ma zastosowania. State/nonce są prawidłowo walidowane i kasowane po użyciu.
- **Webhook headers** (#3): Feature by design — tylko OWNER/SUPER_ADMIN może ustawić konfigurację webhooka; admin kontroluje też URL docelowy. Brak ścieżki eskalacji uprawnień.
- **Impersonation token w URL** (#4): Endpoint wymaga roli OWNER (już pełny dostęp systemowy). Token scoped do jednej org, TTL 30 min, ślad audytowy obecny.
- **Kiosk PIN timing** (#5): Global rate limit 30 req/min + latencja sieciowa całkowicie maskują timing. Brute-force nierealne w praktyce.
- **Bash script injection** (#6): `GATEWAY_INSTALL_SCRIPT_URL` pochodzi z env var (zaufane źródło). User input z HTTP jest prawidłowo sanitizowany.
- **SSO field injection** (#7): `ssoIdField` jest hardcoded w serwisach (`'azureObjectId'`), nigdy z HTTP input. Prisma waliduje klucze względem schematu.

---

## Część 2 — Code Review (jakość i tech debt)

### Przegląd architektury

Solidny monorepo (NestJS 11 + Prisma 5 / React 18 + Vite). Dobre rozdzielenie odpowiedzialności, modułowa struktura backendowa. Kilka obszarów wymaga uwagi.

---

### Krytyczne / Wysokie

#### 1. Race condition w autoryzacji
**Plik:** `apps/unified/src/api/client.ts:54-60`

Wiele równoległych requestów zwracających 401 może wywołać wielokrotny refresh tokena i wielokrotny redirect `window.location.href = '/login'`. Potrzebny singleton promise dla refresh.

```typescript
// Problem:
if (res.status === 401 && _retry) {
  const refreshed = await tryRefresh();
  if (refreshed) return req<T>(path, opts, false);
  window.location.href = '/login';  // może być wywołane N razy równolegle
}
```

#### 2. Tokeny w localStorage
**Plik:** `apps/unified/src/api/client.ts:16, 29-30, 74-76, 81-83`

Access token i refresh token przechowywane w `localStorage` — podatne na XSS. Dodatkowo `accessToken` zapisywany razem z obiektem usera (`line 76`).

#### 3. QR kody przez zewnętrzny serwis
**Plik:** `apps/unified/src/pages/DesksPage.tsx:18`

```typescript
const imgSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUrl)}...`;
```
URL-e check-in desków wysyłane do zewnętrznego serwisu. Privacy concern + brak fallbacku offline.

---

### Średnie

#### 4. Silent catch handlers (39 wystąpień)
Błędy sieciowe połykane w ciszy — utrudnia debugging produkcyjny.

**Top lokalizacje:**
- `apps/unified/src/pages/DashboardPage.tsx:46, 203`
- `apps/unified/src/pages/DeskMapPage.tsx:123, 133`
- `apps/unified/src/pages/DesksPage.tsx:75`
- `apps/unified/src/pages/FloorPlanEditorPage.tsx:126`
- `apps/unified/src/pages/KioskPage.tsx:185`
- `apps/unified/src/pages/ReservationsPage.tsx:16`
- `apps/unified/src/api/client.ts:91`
- `apps/unified/src/pages/ProvisioningPage.tsx:43`

#### 5. Brakujące indeksy w Prismie
**Plik:** `backend/prisma/schema.prisma`

Brakuje indeksów kompozytowych dla najczęstszych zapytań:

```prisma
model Reservation {
  @@index([deskId, date, status])   // brak
}
model Checkin {
  @@index([deskId, checkedOutAt])   // brak
}
model Device {
  @@index([deskId, isOnline])       // brak (deskId jest @unique, ale nie composite)
}
```

#### 6. Timezone-unsafe date parsing
**Plik:** `apps/unified/src/pages/MyReservationsPage.tsx:89, 229`

```typescript
new Date(r.date.slice(0,10)+'T12:00:00').toLocaleDateString(locale, ...)
```
Zakłada strefę lokalną zamiast UTC. Schemat ma `timezone String @default("Europe/Warsaw")` ale jest ignorowany przy parsowaniu.

#### 7. getMe() bez debouncingu na visibilitychange
**Plik:** `apps/unified/src/App.tsx:78-86`

Szybkie przełączanie kart (Alt+Tab) wywołuje wiele równoległych requestów do `/auth/me`.

---

### Niskie / Tech debt

#### 8. `as any` w error handlingu
**Plik:** `apps/unified/src/api/client.ts:64`

```typescript
throw new Error((e as any).message ?? res.statusText);
```

#### 9. 136 wystąpień `as any` w całym projekcie
Utrata typowania — uniemożliwia IDE assistance i statyczną analizę. Priorytet: API client i typy odpowiedzi.

#### 10. `scrollTo({ behavior: 'instant' })`
**Plik:** `apps/unified/src/components/layout/AppLayout.tsx:150`

`'instant'` nie jest prawidłową wartością `ScrollBehavior` — powinno być `'auto'`.

---

## Podsumowanie priorytetów

| # | Problem | Plik(i) | Pilność |
|---|---------|---------|---------|
| 1 | Race condition refresh tokena | `client.ts:54` | Wysoka |
| 2 | Tokeny w localStorage | `client.ts:16,29,74` | Wysoka |
| 3 | QR przez zewnętrzny serwis | `DesksPage.tsx:18` | Średnia |
| 4 | Silent catch handlers (39x) | Wiele plików | Średnia |
| 5 | Brakujące DB indeksy | `schema.prisma` | Średnia |
| 6 | Timezone-unsafe dates | `MyReservationsPage.tsx:89,229` | Średnia |
| 7 | getMe() bez debounce | `App.tsx:82` | Średnia |
| 8 | `as any` w error handlingu | `client.ts:64` | Niska |
| 9 | `scrollTo 'instant'` | `AppLayout.tsx:150` | Niska |

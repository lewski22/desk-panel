# Panel Owner — Kontekst dla narzędzi AI

> Kontekst modułu Owner Panel — aplikacja do zarządzania wszystkimi klientami platformy Reserti.
> Uzupełnienie do `AI_CONTEXT.md` i `AI_BACKEND_CONTEXT.md`.
> Ostatnia aktualizacja: 2026-03-31
> Status: ✅ ZAIMPLEMENTOWANY — backend + frontend w pełni gotowe

---

## Czym jest Owner Panel

Owner Panel to narzędzie operatora platformy Reserti (właściciela SaaS).
Umożliwia zarządzanie wszystkimi firmami-klientami, monitorowanie infrastruktury
IoT (gateway + beacony) we wszystkich biurach, tworzenie nowych klientów
i wchodzenie w ich panel (impersonation) bez znajomości hasła.

**Domena:** `owner.prohalw2026.ovh`
**Osobna aplikacja React** — nie łączyć z Admin Panel.
**Nowy prefix API:** `/owner/*` z dedykowanym guardem.

---

## Hierarchia ról (po dodaniu OWNER)

```
OWNER              ← operator platformy Reserti (Ty)
  └── SUPER_ADMIN  ← admin firmy-klienta (widzi swoją org)
        └── OFFICE_ADMIN  ← admin konkretnego biura
              └── STAFF   ← pracownik biura
                    └── END_USER  ← zwykły pracownik
```

Zmiana w `schema.prisma`:
```prisma
enum UserRole {
  OWNER        // ← NOWE (dodać na początku enum)
  SUPER_ADMIN
  OFFICE_ADMIN
  STAFF
  END_USER
}
```

---

## Nowe pola w Organization

```prisma
model Organization {
  // ...istniejące pola (id, name, slug, isActive, createdAt, updatedAt)...

  // NOWE — dodać przez prisma db push:
  plan           String    @default("starter")  // starter | pro | enterprise
  planExpiresAt  DateTime?
  trialEndsAt    DateTime?
  notes          String?   @db.Text              // notatki wewnętrzne Ownera
  contactEmail   String?
  createdBy      String?                         // userId Ownera który stworzył
}
```

---

## Nowy moduł backend

### Struktura plików

```
backend/src/modules/owner/
  owner.module.ts
  owner.controller.ts        ← /owner/* endpoints, tylko OWNER
  owner.service.ts           ← CRUD organizacji, tworzenie klientów
  owner-health.service.ts    ← agregacja stanu gateway + beaconów
  guards/
    owner.guard.ts           ← sprawdza user.role === 'OWNER'
  dto/
    create-org.dto.ts        ← { name, slug, plan, contactEmail, adminEmail, adminName }
    update-org.dto.ts        ← { plan?, isActive?, planExpiresAt?, notes?, contactEmail? }
```

### owner.guard.ts

```typescript
@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    return req.user?.role === 'OWNER';
  }
}
// Używaj zamiast @Roles(UserRole.OWNER) — prostsze, jawniejsze
```

### owner.controller.ts — pełna lista endpointów

```typescript
@Controller('owner')
@UseGuards(JwtAuthGuard, OwnerGuard)
export class OwnerController {

  // Lista firm
  GET  /owner/organizations
    query: ?isActive=bool, ?plan=string, ?search=string
    return: OrgSummary[] (z metrykami: gateway online/total, beacony online/total)

  // Utwórz nową firmę + pierwszego SUPER_ADMIN
  POST /owner/organizations
    body: { name, slug, plan, contactEmail, adminEmail, adminName, trialDays? }
    return: { org, adminUser, temporaryPassword }

  // Szczegóły firmy
  GET  /owner/organizations/:id
    return: pełne dane + biura + gateway + beacony + ostatnia aktywność

  // Edytuj firmę (plan, status, notatki)
  PATCH /owner/organizations/:id
    body: UpdateOrgDto
    return: zaktualizowana org

  // Dezaktywuj firmę (soft delete)
  DELETE /owner/organizations/:id
    → ustawia isActive=false (nie usuwa danych)

  // Globalny stan infrastruktury
  GET /owner/health
    query: ?status=offline|problem|healthy, ?orgId=string
    return: { orgs: [{ org, gateways: [], beacons: [] }] }

  // Stan infrastruktury jednej firmy
  GET /owner/health/:orgId
    return: { gateways: GatewayHealth[], beacons: BeaconHealth[] }

  // Metryki całej platformy
  GET /owner/stats
    return: { orgsTotal, orgsActive, gatewaysOnline, gatewaysTotal,
              beaconsOnline, beaconsTotal, checkinsToday, checkinsWeek,
              inactiveOrgs: OrgSummary[] }

  // Wejście w panel klienta jako SUPER_ADMIN (impersonation)
  POST /owner/organizations/:id/impersonate
    return: { token, expiresAt, adminUrl }
    side-effect: tworzy Event(OWNER_IMPERSONATION, { ownerId, orgId, ip, at })
}
```

### owner.service.ts — kluczowe metody

```typescript
// Tworzy org + SUPER_ADMIN jednocześnie w transakcji
async createOrganization(dto: CreateOrgDto, ownerId: string): Promise<{org, user, password}>

// Generuje JWT z rolą SUPER_ADMIN + organizationId, ważny 30 min
// Payload: { sub: userId, role: 'SUPER_ADMIN', orgId, impersonated: true }
async impersonate(orgId: string, ownerId: string): Promise<string>

// Agreguje metryki dla listy orgów (N+1 prevention: batch queries)
async getOrgSummaries(filter: OrgFilter): Promise<OrgSummary[]>
```

### owner-health.service.ts — kluczowe metody

```typescript
// Zwraca stan wszystkich gateway i beaconów grupowany per org
// Używa: ostatni heartbeat, isOnline, lastSeen
async getGlobalHealth(filter?: HealthFilter): Promise<OrgHealthGroup[]>

// Stan jednej firmy — szybszy query
async getOrgHealth(orgId: string): Promise<OrgHealth>

// Czy gateway jest zdrowy? Kryterium: isOnline = true AND lastSeen < 5 min temu
isGatewayHealthy(gw: Gateway): 'healthy' | 'stale' | 'offline'

// Czy beacon jest zdrowy?
isBeaconHealthy(device: Device): 'healthy' | 'stale' | 'offline'
```

---

## Frontend: apps/owner/

### Struktura

```
apps/owner/
├── package.json
├── vite.config.ts        (port 3005)
├── tsconfig.json
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx            (BrowserRouter + OwnerLayout + routes)
    ├── components/
    │   ├── OwnerLayout.tsx    (sidebar + topbar + baner impersonation)
    │   ├── StatusDot.tsx      (● zielony/żółty/czerwony + label)
    │   ├── MetricCard.tsx     (karta z liczbą i etykietą)
    │   └── ui.tsx             (Btn, Modal, Input, Card — takie same jak Admin)
    ├── pages/
    │   ├── LoginPage.tsx          (formularz email/password)
    │   ├── ClientsPage.tsx        (tabela firm z filtrami)
    │   ├── ClientDetailPage.tsx   (4 sekcje: info | biura+gateways | beacony | aktywność)
    │   ├── NewClientPage.tsx      (wizard 2-krokowy)
    │   ├── HealthPage.tsx         (globalny monitoring, auto-refresh 30s)
    │   └── StatsPage.tsx          (metryki + wykresy Recharts)
    └── api/
        └── client.ts              (axios do /owner/* endpoints)
```

### Routing

```typescript
// App.tsx
<Routes>
  <Route path="/login"   element={<LoginPage />} />
  <Route path="/*" element={<OwnerLayout />}>
    <Route path="clients"          element={<ClientsPage />} />
    <Route path="clients/new"      element={<NewClientPage />} />
    <Route path="clients/:id"      element={<ClientDetailPage />} />
    <Route path="health"           element={<HealthPage />} />
    <Route path="stats"            element={<StatsPage />} />
    <Route path="*"                element={<Navigate to="clients" />} />
  </Route>
</Routes>
```

### OwnerLayout.tsx — ważne elementy

```typescript
// Baner impersonation — widoczny gdy localStorage.getItem('owner_impersonating')
{impersonating && (
  <div className="bg-amber-500 text-white text-xs px-4 py-1 flex justify-between">
    <span>Zalogowany jako SUPER_ADMIN: {impersonating.orgName}</span>
    <button onClick={exitImpersonation}>Wróć do Owner Panel</button>
  </div>
)}

// Sidebar links
const links = [
  { to: '/clients', icon: '🏢', label: 'Klienci' },
  { to: '/health',  icon: '📡', label: 'Health' },
  { to: '/stats',   icon: '📊', label: 'Statystyki' },
]
```

---

## Funkcja impersonation — pełny flow

### Backend

```typescript
// owner.service.ts
async impersonate(orgId: string, ownerId: string, ip: string) {
  const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

  // Znajdź SUPER_ADMIN tej organizacji (pierwszy aktywny)
  const admin = await this.prisma.user.findFirst({
    where: { organizationId: orgId, role: 'SUPER_ADMIN', isActive: true },
  });

  // Zaloguj zdarzenie (audit trail)
  await this.prisma.event.create({
    data: {
      type: EventType.OWNER_IMPERSONATION,
      entityType: 'organization',
      entityId: orgId,
      payload: { ownerId, orgName: org.name, ip, at: new Date() },
    },
  });

  // Generuj tymczasowy JWT (30 min, impersonated: true)
  const token = this.jwtService.sign(
    { sub: admin.id, role: 'SUPER_ADMIN', orgId, impersonated: true },
    { expiresIn: '30m' },
  );

  return {
    token,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    adminUrl: `${process.env.ADMIN_URL}/auth/impersonate?token=${token}`,
  };
}
```

### Frontend Admin Panel (zmiana przy imporsonation)

```typescript
// apps/admin/src/App.tsx — nowa route
<Route path="/auth/impersonate" element={<ImpersonatePage />} />

// apps/admin/src/pages/ImpersonatePage.tsx
// Odczytuje ?token=..., zapisuje w localStorage jako admin_access
// Przekierowuje na /dashboard
// Ustawia localStorage.setItem('impersonated_by', 'owner') → pokazuje baner
```

### Frontend Owner Panel — przycisk impersonation

```typescript
// ClientDetailPage.tsx lub ClientsPage.tsx
const impersonate = async (orgId: string, orgName: string) => {
  const { adminUrl } = await ownerApi.impersonate(orgId);
  // Zapisz info o impersonation w Owner Panel (żeby wyświetlić baner po powrocie)
  localStorage.setItem('owner_impersonating', JSON.stringify({ orgId, orgName }));
  window.open(adminUrl, '_blank');
};
```

---

## HealthPage — szczegóły implementacji

```typescript
// Odświeżanie co 30s
useEffect(() => {
  const load = () => ownerApi.health.getGlobal().then(setData);
  load();
  const t = setInterval(load, 30_000);
  return () => clearInterval(t);
}, []);

// Stan firmy = najgorszy stan z jej gateway
function orgStatus(org: OrgHealthGroup): 'healthy' | 'problem' | 'critical' {
  const gwStatuses = org.gateways.map(g => g.status);
  if (gwStatuses.every(s => s === 'healthy')) return 'healthy';
  if (gwStatuses.some(s => s === 'offline')) return 'critical';
  return 'problem';
}
```

**Kolorowanie:**
- 🟢 Wszystkie gateway healthy → zielona lewa ramka karty firmy
- 🟡 Problem (stale heartbeat) → żółta ramka
- 🔴 Offline → czerwona ramka

---

## Deploy w Coolify

Nowy serwis `front-owner`:
- Build source: `apps/owner/`
- Dockerfile: identyczny jak `apps/admin/` (nginx + SPA)
- Domena: `owner.prohalw2026.ovh`
- Zmienna: `VITE_API_URL=https://api.prohalw2026.ovh/api/v1`

Ważne: Cloudflare Tunnel automatycznie doda HTTPS dla nowej subdomeny.

---

## Czego NIE zmieniać przy implementacji

- Istniejące endpointy `/api/v1/*` — bez zmian
- Logika JWT (`jwt.strategy.ts`) — bez zmian (OWNER to kolejna rola, sprawdzana przez OwnerGuard)
- Admin Panel, Staff Panel — bez zmian (poza `ImpersonatePage`)
- MQTT, gateway, firmware — bez zmian
- Istniejące organizacje w bazie — schema migration additive (tylko nowe pola, nullable)

---

## Kolejność implementacji (zalecana)

```
Dzień 1 (backend):
  1. Dodaj OWNER do enum UserRole w schema.prisma + nowe pola Organization
  2. prisma db push + seed konto OWNER
  3. owner.guard.ts
  4. owner.module.ts + owner.controller.ts + owner.service.ts (CRUD org)
  5. Endpoint impersonation

Dzień 2 (backend + frontend scaffold):
  6. owner-health.service.ts + /owner/health endpoints
  7. /owner/stats endpoint
  8. apps/owner/ scaffold (package.json, vite, router, OwnerLayout, LoginPage)

Dzień 3 (frontend pages):
  9. ClientsPage + ownerApi.client.ts
  10. NewClientPage (wizard)
  11. ClientDetailPage

Dzień 4 (monitoring + deploy):
  12. HealthPage z auto-refresh
  13. StatsPage z Recharts
  14. ImpersonatePage w Admin Panel
  15. Deploy Coolify + testy
```

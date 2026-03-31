# Backend — Kontekst dla narzędzi AI

> Szczegółowy kontekst `desk-panel/backend`.
> Ostatnia aktualizacja: 2026-03-31

---

## Stack

- **NestJS** 10 + TypeScript (strict)
- **Prisma** 5 + PostgreSQL 15
- **Passport.js** — JWT (15min) + Local strategy
- **@nestjs/throttler** — rate limiting globalny + per endpoint
- **@nestjs/schedule** — cron: `expireOld()` co 15 min
- **jwks-rsa** + **jsonwebtoken** — weryfikacja Azure JWKS
- **bcrypt** — hasła, secrety
- **crypto.randomBytes** — generowanie haseł MQTT, secretów gateway
- **ConfigService** — wszystkie env vars (nie `process.env`)

---

## Struktura modułów

```
src/
├── main.ts
├── app.module.ts              # imports: wszystkie moduły + ThrottlerModule
├── database/
│   ├── db.module.ts
│   └── prisma.service.ts      # PrismaClient singleton
│   └── seeds/seed.ts          # Upsert kont testowych — uruchamiany przez CMD
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts        # POST /auth/login|refresh|logout|azure
│   │   │                             # GET /auth/azure/check (publiczny, 20/min)
│   │   ├── auth.service.ts           # validateUser, login, refresh, logout
│   │   ├── azure-auth.service.ts     # verifyIdToken (JWKS), JIT provisioning
│   │   ├── strategies/jwt.strategy.ts  # ⚠ odpytuje DB przy każdym request
│   │   └── guards/jwt-auth.guard.ts, roles.guard.ts
│   │
│   ├── owner/                 ← NOWY MODUŁ
│   │   ├── owner.module.ts
│   │   ├── owner.controller.ts       # GET|POST|PATCH|DELETE /owner/organizations
│   │   │                             # POST /owner/organizations/:id/impersonate
│   │   │                             # GET /owner/health|health/:id|stats
│   │   ├── owner.service.ts          # CRUD org (transakcja), impersonate (JWT 30min + audit)
│   │   │                             # getStats (metryki platformy)
│   │   ├── owner-health.service.ts   # getGlobalHealth, getOrgHealth
│   │   │                             # statusy: healthy / stale / offline
│   │   │                             # kryterium: gateway > 5min, beacon > 10min
│   │   ├── guards/owner.guard.ts     # role === 'OWNER'
│   │   └── dto/create-org.dto.ts, update-org.dto.ts
│   │
│   ├── organizations/
│   │   └── organizations.service.ts  # getAzureConfig, updateAzureConfig
│   │
│   ├── locations/
│   │   ├── locations.service.ts      # findAll scoped do org dla OFFICE_ADMIN
│   │   └── locations.controller.ts
│   │
│   ├── desks/
│   │   ├── desks.service.ts          # findAvailable (walidacja startTime<endTime)
│   │   └── desks.controller.ts       # GET /desks/available (Outlook Add-in)
│   │
│   ├── devices/
│   │   └── devices.service.ts        # provision() + ConfigService (nie process.env)
│   │
│   ├── gateways/
│   │   ├── gateways.service.ts
│   │   ├── gateway-setup.service.ts  # createToken, redeemToken (jednorazowy, 24h)
│   │   ├── gateways.controller.ts
│   │   └── install.controller.ts     # GET /install/gateway/:token (POZA /api/v1)
│   │                                 # GATEWAY_INSTALL_SCRIPT_URL z ConfigService
│   │
│   ├── reservations/
│   │   ├── reservations.service.ts   # @Cron('0 */15 * * * *') expireOld()
│   │   │                             # findMy: paginacja take=50 (max 100)
│   │   │                             # ReservationStatus enum (nie string literals)
│   │   └── reservations.controller.ts
│   │
│   └── checkins/
│       └── checkins.service.ts       # walkinQr: sprawdza openTime/closeTime (lokalny TZ)
```

---

## Prisma Schema — pełny stan

### Enums

```prisma
enum UserRole {
  OWNER           ← operator platformy
  SUPER_ADMIN
  OFFICE_ADMIN
  STAFF
  END_USER
}

enum EventType {
  DESK_CREATED | DESK_UPDATED | DESK_STATUS_CHANGED
  RESERVATION_CREATED | RESERVATION_CANCELLED | RESERVATION_EXPIRED
  CHECKIN_NFC | CHECKIN_QR | CHECKIN_MANUAL | CHECKOUT
  DEVICE_ONLINE | DEVICE_OFFLINE | DEVICE_PROVISIONED
  GATEWAY_ONLINE | GATEWAY_OFFLINE
  UNAUTHORIZED_SCAN
  USER_CREATED | USER_UPDATED
  OWNER_IMPERSONATION   ← audit trail impersonacji
}

enum ReservationStatus {
  PENDING | CONFIRMED | CANCELLED | EXPIRED
}
```

### Organization — nowe pola (Owner Panel)
```prisma
model Organization {
  // ...istniejące...
  plan           String    @default("starter")
  planExpiresAt  DateTime?
  trialEndsAt    DateTime?
  notes          String?   @db.Text
  contactEmail   String?
  createdBy      String?   // userId Ownera
  // M365:
  azureTenantId  String?
  azureEnabled   Boolean   @default(false)
}
```

### User — pola M365
```prisma
model User {
  // ...istniejące...
  azureObjectId  String?  @unique
  azureTenantId  String?
}
```

### GatewaySetupToken
```prisma
model GatewaySetupToken {
  // ...
  @@index([locationId])   ← wydajność przy listTokens(locationId)
}
```

---

## Wzorce autoryzacji

### JwtAuthGuard + OwnerGuard (nowy)
```typescript
// OwnerGuard — prostszy niż @Roles, jawny
@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return context.switchToHttp().getRequest().user?.role === 'OWNER';
  }
}

// Użycie w OwnerController:
@UseGuards(JwtAuthGuard, OwnerGuard)
```

### Scoping OFFICE_ADMIN
```typescript
const where = user.role === 'SUPER_ADMIN'
  ? {}
  : { organizationId: user.organizationId };
```

### Rate limiting (ThrottlerModule)
```typescript
// Globalne: 100 req / 60s
// Auth endpoints: 5 req/min (login), 10 req/min (azure)
@Throttle({ default: { limit: 5, ttl: 60000 } })
async login(...)
```

---

## Impersonation — implementacja

```typescript
// owner.service.ts
async impersonate(orgId: string, ownerId: string, ip: string) {
  const admin = await prisma.user.findFirst({
    where: { organizationId: orgId, role: 'SUPER_ADMIN', isActive: true }
  });
  // Audit log
  await prisma.event.create({
    data: {
      type: EventType.OWNER_IMPERSONATION,
      payload: { ownerId, orgId, orgName, ip, at: new Date().toISOString() }
    }
  });
  // JWT 30 min, nieprzedłużalny
  const token = jwtService.sign(
    { sub: admin.id, email: admin.email, role: 'SUPER_ADMIN', orgId, impersonated: true },
    { secret: config.get('JWT_SECRET'), expiresIn: '30m' }
  );
  return { token, expiresAt, adminUrl: `${ADMIN_URL}/auth/impersonate?token=${token}` };
}
```

---

## Azure SSO — flow (M1)

```
POST /auth/azure { idToken }
  → azure-auth.service.verifyIdToken(idToken)
    → jwks-rsa pobiera klucze z https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys
    → jsonwebtoken.verify(idToken, getKey, { algorithms: ['RS256'] })
    → sprawdź aud === AZURE_CLIENT_ID
  → JIT provisioning:
    prisma.user.upsert({ where: { azureObjectId: oid }, ... })
    → nowy user: passwordHash = 'AZURE_SSO_ONLY' (nie może się zalogować hasłem)
  → generuj JWT jak przy normalnym login
```

---

## Seed — CMD przy starcie

```
Dockerfile CMD:
  prisma db push --accept-data-loss
  → node dist/database/seeds/seed.js
    → node dist/main

Seed tworzy przez upsert (idempotentny):
  owner@reserti.pl       / Owner1234!  / OWNER    (bez organizationId)
  superadmin@reserti.pl  / Admin1234!  / SUPER_ADMIN
  admin@demo-corp.pl     / Admin1234!  / OFFICE_ADMIN
  staff@demo-corp.pl     / Staff1234!  / STAFF
  user@demo-corp.pl      / User1234!   / END_USER
```

---

## Zmienne środowiskowe

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
MQTT_BROKER_URL=mqtt://mosquitto-NAME:1883
CORS_ORIGINS=https://admin.prohalw2026.ovh,https://staff.prohalw2026.ovh
GATEWAY_PROVISION_KEY=...
PUBLIC_API_URL=https://api.prohalw2026.ovh/api/v1
ADMIN_URL=https://admin.prohalw2026.ovh
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_REDIRECT_URI=https://api.prohalw2026.ovh/auth/azure/callback
GATEWAY_INSTALL_SCRIPT_URL=https://raw.githubusercontent.com/lewski22/desk-gateway-python/main/install.sh
```

---

## Typowe błędy i naprawki

| Błąd | Przyczyna | Rozwiązanie |
|---|---|---|
| `Cannot find module './seed.ts'` | ts-node w production bez src/ | Uruchom `node dist/database/seeds/seed.js` |
| `Failed to fetch` przy logowaniu | `checkSso` wywoływany przy keystroke | Usunięty — SSO tylko przez osobny modal |
| Internal Error przy logowaniu | Brak kolumn Azure w bazie | `prisma db push` w terminalu kontenera |
| `property X should not exist` | forbidNonWhitelisted=true | Usuń nieznane pola z body requestu |
| `ENOTFOUND mosquitto` | Race condition Docker | Healthcheck na mosquitto w docker-compose |
| `0700` Mosquitto passwd | Zły chmod | `chmod 0600 + chown mosquitto:mosquitto` |
| `ECONNRESET better-sqlite3` | Kompilacja native na ARM | Kopiuj node_modules z builder stage |

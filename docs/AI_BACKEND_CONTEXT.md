# Backend — Kontekst dla narzędzi AI

> Szczegółowy kontekst backendu `desk-panel/backend`.
> Uzupełnienie do `AI_CONTEXT.md` (kontekst całego systemu).
> Ostatnia aktualizacja: 2026-03-30

---

## Stack

- **NestJS** 10 + TypeScript (strict)
- **Prisma** 5 + PostgreSQL 15
- **Passport.js** — JWT (15min) + Local strategy
- **mqtt** lib — połączenie z Mosquitto
- `class-validator` + `forbidNonWhitelisted: true` — walidacja DTO
- `bcrypt` — hasła, secrety
- `crypto.randomBytes` — generowanie haseł MQTT, secretów gateway

---

## Struktura modułów

```
src/
├── main.ts                    # Bootstrap, Swagger, CORS, ValidationPipe
├── app.module.ts              # Root module — importuje wszystkie moduły
├── database/
│   ├── db.module.ts           # DatabaseModule — eksportuje PrismaService
│   └── prisma.service.ts      # PrismaClient singleton
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts  # POST /auth/login, /refresh, /logout
│   │   ├── auth.service.ts     # validateUser, login, refresh, logout
│   │   ├── auth.module.ts      # imports: DatabaseModule, JwtModule, UsersModule
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts    # ⚠ WAŻNE: odpytuje DB przy każdym request
│   │   │   │                      # sprawdza isActive + deletedAt
│   │   │   └── local.strategy.ts  # email/password validation
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── decorators/
│   │       └── roles.decorator.ts  # @Roles(UserRole.SUPER_ADMIN, ...)
│   │
│   ├── users/
│   │   ├── users.service.ts    # CRUD + soft-delete (retencja min 30 dni)
│   │   └── users.controller.ts # GET /users, PATCH, DELETE, restore
│   │
│   ├── organizations/          # Firmy (warstwa nadrzędna nad Location)
│   │   └── organizations.service.ts
│   │
│   ├── locations/              # "Biura" — podstawowa jednostka w UI
│   │   ├── locations.service.ts  # findAll, create, update, analytics
│   │   │                         # getOccupancyAnalytics: 4x count() parallel
│   │   │                         # getAnalyticsExtended: 1 query 30d + JS aggregation
│   │   └── locations.controller.ts  # OFFICE_ADMIN: auto-scope do własnej org
│   │
│   ├── desks/
│   │   ├── desks.service.ts    # CRUD + getCurrentStatus + getByQrToken
│   │   └── desks.controller.ts # GET /locations/:id/desks, /desks/qr/:token (public)
│   │
│   ├── devices/                # Beacony ESP32
│   │   ├── devices.service.ts  # provision() + _notifyGateway() + heartbeat()
│   │   │                       # ⚠ provision() automatycznie wywołuje gateway HTTP API
│   │   └── devices.controller.ts
│   │
│   ├── gateways/
│   │   ├── gateways.service.ts       # register, authenticate, heartbeat, getSync
│   │   ├── gateway-setup.service.ts  # ⭐ NOWY: tokeny instalacyjne
│   │   │                             # createToken, redeemToken, listTokens, revokeToken
│   │   ├── gateways.controller.ts    # + setup-tokens endpoints
│   │   └── gateways.module.ts        # imports: DatabaseModule
│   │
│   ├── reservations/
│   │   ├── reservations.service.ts  # findAll (includes checkin), create, cancel, expireOld
│   │   └── reservations.controller.ts
│   │
│   └── checkins/
│       ├── checkins.service.ts  # checkinNfc, checkinQr, walkinQr, checkinManual, checkout
│       │                        # ⚠ walkinQr: sprawdza godziny biura (openTime/closeTime)
│       └── checkins.controller.ts
│
└── mqtt/
    ├── mqtt.service.ts    # Połączenie z Mosquitto, publish, registerHandlers
    ├── mqtt.handlers.ts   # handleCheckin, handleStatus (merged heartbeat), handleGatewayHello
    └── topics.ts          # Definicje topic stringów
```

---

## Kluczowe wzorce

### Autoryzacja

Każdy chroniony endpoint wymaga:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
```

`JwtStrategy.validate()` **odpytuje DB przy każdym request** — weryfikuje
`isActive` i `deletedAt`. Inaczej dezaktywowani użytkownicy mogliby używać
stale tokenów przez 15 minut.

`JwtStrategy` wymaga `PrismaService` → `DatabaseModule` musi być w `AuthModule`.

### Scoping OFFICE_ADMIN do swojej organizacji

W `LocationsController.findAll`:
```typescript
const effectiveOrgId = req.user.role === UserRole.OFFICE_ADMIN
  ? req.user.organizationId  // zawsze tylko swoja org
  : orgId;                   // SUPER_ADMIN może filtrować
```

### Transakcje przy check-in

Każdy check-in zapisuje `checkin` + `reservation.checkedInAt` w jednej transakcji:
```typescript
await this.prisma.$transaction([
  this.prisma.checkin.create({...}),
  this.prisma.reservation.update({ data: { checkedInAt: now, checkedInMethod: 'QR' } }),
]);
```

### ValidationPipe — forbidNonWhitelisted

`main.ts` ma `forbidNonWhitelisted: true`. Każde pole niewymienione w DTO
powoduje HTTP 400. Przy wysyłaniu requestów z frontendu:
- Nie wysyłaj pól wewnętrznych (np. `locId` przy tworzeniu biurka)
- Używaj destrukturyzacji: `(({ locId, ...rest }) => rest)(form)`

---

## Model GatewaySetupToken (NOWY — Faza A)

```prisma
model GatewaySetupToken {
  id         String    @id @default(cuid())
  token      String    @unique @default(cuid())
  locationId String
  gatewayId  String?   # uzupełniane po pomyślnej instalacji
  createdBy  String    # userId admina
  expiresAt  DateTime  # teraz + 24h
  usedAt     DateTime? # jednorazowy — po użyciu ustawiane
  createdAt  DateTime  @default(now())
}
```

### Flow token instalacyjny

```
1. Admin klika "Dodaj gateway" przy biurze w panelu
   → POST /gateway/setup-tokens { locationId }
   → Backend: unieważnia stare tokeny dla tej lokalizacji,
     tworzy nowy token (24h), zwraca installCmd

2. installCmd: curl -fsSL https://api.domain.pl/install/gateway/TOKEN | bash

3. Skrypt instalacyjny na Raspberry Pi:
   → POST /gateway/setup/:token { gatewayName }
   → Backend: waliduje token (exists? used? expired?),
     tworzy Gateway w DB (auto-name + secret),
     oznacza token jako usedAt=now,
     zwraca: { gatewayId, gatewaySecret, locationId,
               mqttUsername, mqttPassword, serverUrl, provisionKey }

4. Skrypt konfiguruje Mosquitto + Python gateway z tymi danymi
   → Zero ręcznej edycji .env
```

### Nowe endpointy

```
POST   /gateway/setup-tokens              JWT: OFFICE_ADMIN+  → { token, installCmd, expiresAt }
GET    /gateway/setup-tokens/:locationId  JWT: OFFICE_ADMIN+  → lista tokenów
DELETE /gateway/setup-tokens/:tokenId    JWT: OFFICE_ADMIN+  → { revoked: true }
POST   /gateway/setup/:token             PUBLIC (jednorazowy) → { gatewayId, gatewaySecret, ... }
```

---

## Zmienne środowiskowe backendu

```env
# Wymagane
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=min-32-chars-random
JWT_REFRESH_SECRET=min-32-chars-random-different

# MQTT
MQTT_BROKER_URL=mqtt://mosquitto-SERVICE:1883

# CORS
CORS_ORIGINS=https://admin.domain.pl,https://staff.domain.pl

# Gateway provisioning
GATEWAY_PROVISION_KEY=random-32-chars  # musi być identyczny w gateway .env
PUBLIC_API_URL=https://api.domain.pl/api/v1  # używane w installCmd

# Opcjonalne
PORT=3000
SWAGGER_ENABLED=true  # włącz Swagger w produkcji
NODE_ENV=production
```

---

## Wydajność — kluczowe decyzje

| Problem | Rozwiązanie |
|---|---|
| 7 zapytań per dzień w analytics | 1 zapytanie 30d + agregacja JS |
| 2 DB write'y na heartbeat beacona | Merged w jedno: `heartbeat(id, rssi, fwVersion)` |
| `findOne()` przed `update()` | Usunięte — Prisma rzuca P2025 jeśli nie istnieje |
| Rezerwacje bez limitu | Domyślny `take: 500` |
| `mousemove` setki razy/s | Debounce 500ms w AdminLayout |

---

## Typowe błędy i gotowe naprawki

### `property X should not exist`
`forbidNonWhitelisted: true` — usuń pole z requestu lub dodaj do DTO.

### `nvs_open failed: NOT_FOUND` (ESP32 log)
Normalne po `pio run -t erase`. NVS partition tworzy się przy pierwszym zapisie.

### Gateway `ENOTFOUND mosquitto`
`MQTT_BROKER_URL` wskazuje na zewnętrzny host. Musi być `mqtt://mosquitto:1883`
(nazwa serwisu Docker Compose).

### `plan does not exist in type OrganizationCreateInput`
Pole `plan` zostało usunięte ze schematu Organization. Usuń z seed i queries.

### Token setup wygasł
`POST /gateway/setup-tokens` — wygeneruj nowy. Stary jest automatycznie unieważniany.

# Backend — Kontekst dla narzędzi AI

> Szczegółowy kontekst `desk-panel/backend`.
> Ostatnia aktualizacja: 2026-04-15 — v0.11.0

---

## Stack

- **NestJS** 10 + TypeScript (strict)
- **Prisma** 5 + PostgreSQL 15
- **Passport.js** — JWT (15min) + Local strategy
- **@nestjs/throttler** — rate limiting globalny + per endpoint
- **@nestjs/schedule** — cron: `expireOld()` co 15min, `autoCheckout()` co 15min, `timeoutStaleOta()` co 5min
- **jwks-rsa** + **jsonwebtoken** — weryfikacja Azure JWKS
- **bcrypt** — hasła, secrety gateway
- **crypto.randomBytes** — hasła MQTT, secrety gateway, QR tokeny
- **nodemailer** — wysyłka email (per-org SMTP lub globalny fallback)
- **prom-client** + **@willsoto/nestjs-prometheus** — metryki Prometheus

---

## Struktura modułów

```
src/
├── main.ts
├── app.module.ts
├── database/
│   ├── prisma.service.ts
│   └── seeds/seed.ts               # upsert idempotentny — konta testowe
├── metrics/                         # Prometheus (poza /api/v1)
│   ├── metrics.controller.ts        # GET /metrics (IP whitelist)
│   ├── metrics.service.ts
│   ├── metrics.interceptor.ts       # request duration histogram
│   └── metrics.module.ts
├── shared/
│   └── led-events.service.ts        # rxjs Subject — LED event bus
├── mqtt/
│   ├── mqtt.service.ts              # MQTT client (publish, subscribe)
│   ├── mqtt.handlers.ts             # NFC events + LED events subscription
│   └── topics.ts                    # topic strings + LED payload builders
└── modules/
    ├── auth/
    │   ├── auth.controller.ts        # /auth/login|refresh|logout|azure|azure/check
    │   ├── auth.service.ts           # validateUser, login, refresh, changePassword, logout
    │   ├── azure-auth.service.ts     # verifyIdToken (JWKS), JIT provisioning
    │   └── guards/                   # JwtAuthGuard, RolesGuard
    │
    ├── owner/
    │   ├── owner.controller.ts       # /owner/organizations CRUD + impersonate + stats + health
    │   ├── owner.service.ts          # CRUD org, impersonate (JWT 30min + OWNER_IMPERSONATION audit)
    │   ├── owner-health.service.ts   # getGlobalHealth, getOrgHealth (stale/offline)
    │   └── guards/owner.guard.ts     # role === 'OWNER'
    │
    ├── organizations/
    │   └── organizations.service.ts  # getAzureConfig, updateAzureConfig
    │                                 # (planowane: SubscriptionsService)
    │
    ├── locations/
    │   └── locations.service.ts      # findAll scoped do org, occupancy, extended (dashboard)
    │
    ├── desks/
    │   ├── desks.service.ts          # CRUD, getCurrentStatus (live mapa), QR tokeny
    │   └── desks.controller.ts       # GET /desks/available (Outlook Add-in)
    │
    ├── devices/
    │   ├── devices.service.ts        # provision, triggerOta, timeoutStaleOta, heartbeat
    │   │                             # findAll (filtr orgId dla non-OWNER)
    │   └── devices.controller.ts     # command, assign, ota, ota-all, firmware/latest
    │
    ├── gateways/
    │   ├── gateways.service.ts       # sendBeaconCommand (HTTP → Pi Mosquitto → beacon)
    │   ├── gateway-setup.service.ts  # createToken, redeemToken (jednorazowy 24h)
    │   └── install.controller.ts     # GET /install/gateway/:token (POZA /api/v1)
    │
    ├── reservations/
    │   ├── reservations.service.ts   # create (konflikt check), cancel (LED FREE), expireOld cron
    │   │                             # getQrToken, findMy (take max 100), findAll (filtry)
    │   └── reservations.controller.ts
    │
    ├── checkins/
    │   └── checkins.service.ts       # nfcCheckin, checkinQr, walkinQr, checkout, autoCheckout
    │                                 # endOfWorkInTz() — Intl.DateTimeFormat, pure TS
    │
    └── notifications/
        ├── notifications.service.ts  # sendEmail per org (SMTP AES-256-GCM → fallback global)
        │                             # 8 typów, 24h dedup, NotificationLog
        ├── notifications.controller.ts # settings, log, test, smtp config
        ├── inapp.service.ts          # createNotification, getForUser, markRead, announce
        ├── inapp.controller.ts       # polling, rules, announce
        └── smtp.service.ts           # AES-256-GCM encrypt/decrypt haseł SMTP
```

---

## Prisma Schema — pełny stan

### Enums

```prisma
enum UserRole { OWNER | SUPER_ADMIN | OFFICE_ADMIN | STAFF | END_USER }

enum ReservationStatus { PENDING | CONFIRMED | CANCELLED | EXPIRED }

enum EventType {
  DESK_CREATED | DESK_UPDATED | DESK_STATUS_CHANGED
  RESERVATION_CREATED | RESERVATION_CANCELLED | RESERVATION_EXPIRED
  CHECKIN_NFC | CHECKIN_QR | CHECKIN_MANUAL | CHECKOUT
  DEVICE_ONLINE | DEVICE_OFFLINE | DEVICE_PROVISIONED | DEVICE_OTA_SUCCESS | DEVICE_OTA_FAILED
  GATEWAY_ONLINE | GATEWAY_OFFLINE | GATEWAY_RESET
  UNAUTHORIZED_SCAN
  USER_CREATED | USER_UPDATED
  OWNER_IMPERSONATION
}
```

### Organization — kluczowe pola

```prisma
model Organization {
  id             String    @id @default(cuid())
  name           String
  slug           String    @unique
  isActive       Boolean   @default(true)
  plan           String    @default("starter")   // starter|pro|enterprise|trial
  planExpiresAt  DateTime?                        // null = bezterminowy
  trialEndsAt    DateTime?
  limitDesks     Int?                             // null = ∞ (Enterprise)
  limitUsers     Int?
  limitGateways  Int?
  limitLocations Int?
  billingEmail   String?
  mrr            Int?      // MRR w groszach PLN (dla OWNERa)
  notes          String?   @db.Text
  contactEmail   String?
  createdBy      String?
  azureTenantId  String?
  azureEnabled   Boolean   @default(false)
  // relacje: locations[], users[], OrganizationSmtpConfig, SubscriptionEvent[] (planowane)
}
```

### Device — OTA tracking

```prisma
model Device {
  // ...istniejące pola...
  firmwareVersion String?
  otaStatus       String?   // null | in_progress | success | failed
  otaStartedAt    DateTime?
  otaVersion      String?   // wersja do której aktualizujemy
  isOnline        Boolean   @default(false)
  rssi            Int?
  lastSeen        DateTime?
}
```

### SubscriptionEvent (planowane v0.12.0)

```prisma
model SubscriptionEvent {
  id             String   @id @default(cuid())
  organizationId String
  type           String   // plan_changed|renewed|expired|trial_started|limit_exceeded
  previousPlan   String?
  newPlan        String?
  changedBy      String?
  note           String?  @db.Text
  createdAt      DateTime @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id])
}
```

---

## Wzorce autoryzacji

### OwnerGuard

```typescript
@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    return ctx.switchToHttp().getRequest().user?.role === 'OWNER';
  }
}
// Użycie: @UseGuards(JwtAuthGuard, OwnerGuard)
```

### Org isolation (SUPER_ADMIN vs OFFICE_ADMIN)

```typescript
const orgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
// undefined = brak filtra (OWNER widzi wszystko)
```

### Rate limiting

```typescript
// Globalne: 100 req / 60s
// Auth: @Throttle({ default: { limit: 5, ttl: 60000 } }) na login
// Azure check: @Throttle({ default: { limit: 20, ttl: 60000 } })
```

---

## OTA Firmware — flow

```typescript
// devices.service.ts
async triggerOta(id: string, actorOrgId?: string) {
  const device = await this.assertBelongsToOrg(id, actorOrgId);
  if (device.otaStatus === 'in_progress') throw new ConflictException();
  const fw = await this.getLatestFirmware();
  if (!fw) throw new BadRequestException('Brak wydania firmware na GitHub');

  await prisma.device.update({ where: { id }, data: {
    otaStatus: 'in_progress', otaStartedAt: new Date(), otaVersion: fw.version
  }});

  return {
    triggered: true, deskId: device.desk?.id, gatewayId: device.gatewayId,
    oldVersion: device.firmwareVersion, newVersion: fw.version,
    _ota_payload: { command: 'OTA_UPDATE', params: { url: fw.url, version: fw.version } }
  };
}

// Cron: timeout stale OTA
@Cron('0 */5 * * * *')
async timeoutStaleOta() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.device.updateMany({
    where: { otaStatus: 'in_progress', otaStartedAt: { lt: cutoff } },
    data: { otaStatus: 'failed' }
  });
}
```

---

## Powiadomienia email — architektura

```typescript
// notifications.service.ts
async send(orgId: string, type: string, payload: EmailPayload) {
  const setting = await getNotificationSetting(orgId, type);
  if (!setting?.enabled) return;

  // 24h deduplikacja
  const recentLog = await prisma.notificationLog.findFirst({
    where: { organizationId: orgId, type, createdAt: { gte: new Date(Date.now() - 86400000) } }
  });
  if (recentLog) return;

  // Per-org SMTP lub globalny fallback
  const smtp = await getOrgSmtp(orgId);
  const transport = smtp ? smtpFromOrgConfig(smtp) : globalSmtp;
  await transport.sendMail({ to: setting.recipients, subject, html });
  await prisma.notificationLog.create({ data: { organizationId: orgId, type, ... } });
}
```

---

## Impersonation

```typescript
// owner.service.ts
async impersonate(orgId: string, ownerId: string) {
  const admin = await prisma.user.findFirst({
    where: { organizationId: orgId, role: 'SUPER_ADMIN', isActive: true }
  });
  // Audit log
  await prisma.event.create({
    data: { type: 'OWNER_IMPERSONATION', payload: { ownerId, orgId } }
  });
  // JWT 30min, nieprzedłużalny, impersonated: true
  const token = jwtService.sign(
    { sub: admin.id, email: admin.email, role: 'SUPER_ADMIN', impersonated: true },
    { expiresIn: '30m' }
  );
  return { token, adminUrl: `${APP_URL}/auth/impersonate?token=${token}` };
}
```

---

## Seed — konta testowe

```
CMD: prisma db push → node dist/database/seeds/seed.js → node dist/main

Upsert idempotentny:
  owner@reserti.pl       Owner1234!   OWNER (bez organizationId)
  superadmin@reserti.pl  Admin1234!   SUPER_ADMIN
  admin@demo-corp.pl     Admin1234!   OFFICE_ADMIN
  staff@demo-corp.pl     Staff1234!   STAFF
  user@demo-corp.pl      User1234!    END_USER
```

---

## Zmienne środowiskowe

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...                        # access token (15min)
JWT_REFRESH_SECRET=...                # refresh token (7d)
MQTT_BROKER_URL=mqtt://mosquitto-NAME:1883
CORS_ORIGINS=https://app.prohalw2026.ovh
GATEWAY_PROVISION_KEY=...             # x-gateway-provision-key header
PUBLIC_API_URL=https://api.prohalw2026.ovh/api/v1
AZURE_CLIENT_ID=...                   # Entra ID / Azure AD app
FIRMWARE_REPO=lewski22/desk-firmware  # GitHub owner/repo dla Releases API
SMTP_ENCRYPTION_KEY=...               # 64 hex chars (AES-256-GCM dla haseł SMTP)
SMTP_HOST=smtp.example.com            # globalny fallback SMTP
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=...
SMTP_FROM=Reserti <noreply@reserti.pl>
METRICS_ALLOWED_IPS=127.0.0.1         # comma-separated IP whitelist dla /metrics
GATEWAY_INSTALL_SCRIPT_URL=https://raw.githubusercontent.com/.../install.sh
```

---

## Typowe błędy i naprawki

| Błąd | Przyczyna | Rozwiązanie |
|------|-----------|-------------|
| `ENOTFOUND mosquitto` | Race condition Docker | healthcheck na mosquitto w docker-compose |
| `0700 passwd file` | Zły chmod Mosquitto | `chmod 0600 + chown mosquitto:mosquitto` |
| `ECONNRESET better-sqlite3` | Native ARM compile | Kopiuj node_modules z builder stage |
| `property X should not exist` | forbidNonWhitelisted | Usuń nieznane pola z body |
| Internal Error przy logowaniu | Brak kolumn Azure | `prisma db push` w kontenerze |
| OTA stuck in_progress | Beacon nie odpowiedział | cron timeoutStaleOta() po 10min → failed |
| Email nie wysłany | SMTP_ENCRYPTION_KEY brak | Ustaw 64-znakowy hex w env |

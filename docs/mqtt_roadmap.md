# Roadmap komunikacji backend ↔ gateway — Reserti (desk-panel)

> Główny dokument: `desk-gateway-python/docs/mqtt_roadmap.md`
> Ten plik zawiera sekcje specyficzne dla backendu NestJS.
> Ostatnia aktualizacja: 2026-05-05
> Status: planowanie → implementacja

---

## Poprzedni plan (cloud MQTT) — odrzucony

Poprzedni roadmap zakładał cloud Mosquitto broker i MQTT publish/subscribe.
Odrzucony z powodu braku skalowalności przy 20+ gateway w różnych LAN,
dodatkowego SPOF i kosztów zarządzania certyfikatami.
Szczegóły: `desk-gateway-python/docs/mqtt_roadmap.md`.

---

## Nowa architektura — SSE + HTTPS przez Cloudflare Tunnel

Gateway inicjuje outbound HTTPS do backendu i utrzymuje trwałe połączenie SSE.
Backend nigdy nie łączy się bezpośrednio do RPi — żaden port nie jest wystawiony
do internetu. Cloudflare Tunnel obsługuje long-lived connections bez dodatkowej
konfiguracji ($0 dodatkowego kosztu).

---

## Nowe pliki do stworzenia

### `gateway-auth.service.ts`

Weryfikacja HMAC i wydawanie JWT dla gateway.

```typescript
// backend/src/modules/gateways/gateway-auth.service.ts
@Injectable()
export class GatewayAuthService {
  constructor(
    private prisma:  PrismaService,
    private jwt:     JwtService,
    private config:  ConfigService,
  ) {}

  async exchange(gatewayId: string, ts: number, sig: string): Promise<string> {
    if (Math.abs(Date.now() / 1000 - ts) > 30) {
      throw new UnauthorizedException('timestamp out of window');
    }
    const gw = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gw) throw new UnauthorizedException();

    const expected = createHmac('sha256', gw.secretRaw)
      .update(`${gatewayId}:${ts}`)
      .digest();
    const actual = Buffer.from(sig, 'hex');

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException();
    }

    return this.jwt.sign(
      { sub: gatewayId, scope: 'gateway' },
      { expiresIn: '60m', secret: this.config.get('JWT_GATEWAY_SECRET') },
    );
  }
}
```

**Uwaga dot. `secretRaw`:** HMAC wymaga dostępu do plain-text sekretu (nie bcrypt hash).
Opcje:
- Przechowywać sekret w postaci zaszyfrowanej (AES-256-GCM kluczem z env), nie bcrypt.
- Lub przechowywać zarówno `secretHash` (bcrypt, do obecnego flow) jak i `secretEncrypted`
  (AES, do HMAC). Należy podjąć decyzję architektoniczną przed implementacją.

---

### `gateway-commands.service.ts`

SSE stream per gateway + store pending commands.

```typescript
// backend/src/modules/gateways/gateway-commands.service.ts
@Injectable()
export class GatewayCommandsService {
  // Map: gatewayId → Subject<SseEvent>
  private streams = new Map<string, Subject<SseCommandEvent>>();
  // Map: nonce → { resolve, reject, timer }
  private pending = new Map<string, PendingAck>();

  /** Subskrybuj stream zdarzeń dla danego gateway (wywoływane przez SSE endpoint). */
  getStream(gatewayId: string): Observable<SseCommandEvent> {
    if (!this.streams.has(gatewayId)) {
      this.streams.set(gatewayId, new Subject());
    }
    return this.streams.get(gatewayId)!.asObservable();
  }

  /**
   * Wyślij komendę do gateway przez SSE i opcjonalnie czekaj na ACK.
   * timeoutMs = 0 → fire-and-forget.
   */
  async send(
    gatewayId: string,
    event:     string,
    data:      object,
    timeoutMs  = 10_000,
  ): Promise<any> {
    const nonce     = randomBytes(16).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + Math.max(timeoutMs / 1000 * 2, 60);

    const subject = this.streams.get(gatewayId);
    if (!subject) {
      throw new Error(`Gateway ${gatewayId} nie jest podłączony (brak SSE stream)`);
    }
    subject.next({ event, data: { ...data, nonce, expiresAt } });

    if (timeoutMs === 0) return { nonce, sent: true };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(nonce);
        reject(new Error(`Gateway ${gatewayId} ack timeout — event: ${event}`));
      }, timeoutMs);
      this.pending.set(nonce, { resolve, reject, timer });
    });
  }

  /** Wywoływane przez POST /gateway/:id/ack */
  resolveAck(nonce: string, ok: boolean, data: object) {
    const p = this.pending.get(nonce);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(nonce);
    if (ok) p.resolve(data);
    else    p.reject(new Error((data as any).error ?? 'gateway ack error'));
  }

  isConnected(gatewayId: string): boolean {
    return this.streams.has(gatewayId);
  }

  disconnect(gatewayId: string) {
    this.streams.get(gatewayId)?.complete();
    this.streams.delete(gatewayId);
  }
}
```

---

## Zmiany w istniejących plikach

### `gateways.controller.ts` — nowe endpointy

```typescript
// GET /gateway/:id/commands — SSE stream
@Sse(':id/commands')
@UseGuards(GatewayJwtGuard)   // weryfikuje scope: 'gateway'
commands(@Param('id') id: string): Observable<SseCommandEvent> {
  return this.commands.getStream(id).pipe(
    finalize(() => this.commands.disconnect(id)),
  );
}

// POST /gateway/:id/ack — potwierdzenie komendy
@Post(':id/ack')
@UseGuards(GatewayJwtGuard)
ack(@Param('id') id: string, @Body() body: AckDto) {
  this.commands.resolveAck(body.nonce, body.ok, body);
  return { ok: true };
}

// POST /gateway/auth — wymiana HMAC na JWT
@Post('auth')
@HttpCode(200)
auth(@Body() body: GatewayAuthDto) {
  return this.gatewayAuth.exchange(body.gatewayId, body.ts, body.sig);
}
```

### `gateways.service.ts` — refaktor 4 metod

| Metoda | Przed | Po |
|---|---|---|
| `addBeaconCredentials()` | `POST http://{ip}:3001/beacon/add` | `commands.send(id, 'beacon_add', {...}, 10_000)` |
| `sendBeaconCommand()` | `POST http://{ip}:3001/command` | `commands.send(id, 'command', {...}, 0)` fire-and-forget |
| `triggerUpdate()` | `POST http://{ip}:3001/update` | `commands.send(id, 'ota_update', {manifestUrl, ...}, 30_000)` |
| `rotateSecret()` | `_pushRotateSecret()` HTTP | `commands.send(id, 'rotate_secret_prepare', {...}, 15_000)` + commit |

Metody `_pushRotateSecret()` i `addBeaconCredentials()` zostają usunięte.
`ipAddress` przestaje być wymagane dla operacji komendowych — tylko heartbeat
i provisioning informacyjny je używają.

---

## Nowe zmienne środowiskowe

```env
# JWT dla gateway (osobny secret od użytkowników aplikacji)
JWT_GATEWAY_SECRET=<64-char-hex>

# TTL oczekiwania na ACK od gateway (ms)
SSE_COMMAND_TIMEOUT_MS=10000

# Klucz do szyfrowania GATEWAY_SECRET w DB (AES-256-GCM) — patrz uwaga o secretRaw
GATEWAY_SECRET_ENCRYPTION_KEY=<32-byte-hex>
```

Usunąć (nie będą potrzebne):
```env
# CLOUD_MQTT_URL         — odrzucone
# CLOUD_MQTT_USERNAME    — odrzucone
# CLOUD_MQTT_PASSWORD    — odrzucone
```

---

## Kwestia `secretRaw` — decyzja architektoniczna

Obecny model przechowuje `secretHash` (bcrypt) — nie można z niego odtworzyć sekretu
do obliczenia HMAC. Dwie opcje:

**Opcja A — dwa pola w `Gateway`:**
- `secretHash` (bcrypt) — do istniejącego legacy auth przez nagłówek
- `secretEncrypted` (AES-256-GCM) — do HMAC exchange

**Opcja B — tylko AES-256-GCM:**
- Usunąć bcrypt entirely; cały auth przez HMAC→JWT
- Wymaga migracji Prisma + usunięcia starego flow

Rekomendacja: **Opcja A** w kroku 1 (niedestrukcyjna), migracja do Opcji B
po potwierdzeniu stabilności nowego auth.

---

## `GatewayJwtGuard` — nowy guard

```typescript
// backend/src/common/guards/gateway-jwt.guard.ts
@Injectable()
export class GatewayJwtGuard implements CanActivate {
  constructor(private jwt: JwtService, private config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException();
    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.get('JWT_GATEWAY_SECRET'),
      });
      if (payload.scope !== 'gateway') throw new UnauthorizedException();
      req.gatewayId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

---

## Harmonogram (backend)

| Krok | Zadanie | Szacunek |
|---|---|---|
| 1a | `GatewayAuthService` + `POST /gateway/auth` | 0.5 dnia |
| 1b | Decyzja i migracja `secretRaw` (Prisma schema) | 0.5 dnia |
| 2 | `GatewayCommandsService` + SSE endpoint + `GatewayJwtGuard` | 1 dzień |
| 3 | Refaktor `GatewaysService` (4 metody) | 0.5 dnia |
| 4 | `rotate-secret` dwufazowy commit (Prepare + Commit + Verify) | 1 dzień |
| 5 | Testy jednostkowe + integracyjne | 0.5 dnia |

Szczegóły po stronie gateway: `desk-gateway-python/docs/mqtt_roadmap.md`.

# Izolacja danych multi-tenant — Reserti

> Status: ✅ Wdrożone (2026-04-15, commit d2abcca)

---

## Model danych

Każdy zasób w systemie należy do dokładnie jednej organizacji przez łańcuch:

```
Organization
  └── Location
        ├── Desk ─── Reservation ─── Checkin
        │      └── Device (Beacon)
        └── Gateway
              └── GatewaySetupToken

Organization
  └── User ─── InAppNotification
         └── RefreshToken
```

---

## Wzorzec izolacji (stosowany wszędzie)

### Kontroler — zawsze z JWT, nigdy z parametru HTTP

```typescript
// ✅ POPRAWNIE — orgId z JWT
const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;

// ❌ BŁĘDNIE — orgId z query param (możliwy do sfałszowania)
const actorOrgId = req.query.organizationId; // NIE UŻYWAĆ
```

### Serwis — guard na początku każdej mutacji

```typescript
// ✅ POPRAWNIE — sprawdź przed operacją
if (actorOrgId && resource.location.organizationId !== actorOrgId) {
  throw new ForbiddenException('Zasób nie należy do Twojej organizacji');
}
```

### OWNER — brak ograniczeń (widzi wszystko)

```typescript
const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
// undefined = OWNER → brak filtra org
```

---

## Pokrycie per moduł

| Moduł | Operacje | Guard | Metoda |
|-------|----------|-------|--------|
| **Reservations** | findAll, findOne, create, cancel | ✅ | actorOrgId filtr + org guard |
| **Users** | findAll, findDeactivated, findOne, update, updateCardUid, softDelete, restore | ✅ | findOne(id, actorOrgId) |
| **Desks** | update, remove, hardDelete, activate | ✅ | `assertDeskInOrg(id, actorOrgId)` |
| **Locations** | update, getOccupancy, getExtended | ✅ | inline ForbiddenException |
| **Gateways** | findAll, remove, rotateSecret | ✅ | `assertGatewayInOrg(id, actorOrgId)` |
| **GatewaySetup** | createToken | ✅ | org guard na locationId |
| **Devices** | command, assign, remove | ✅ | `assertBelongsToOrg(id, actorOrgId)` |
| **Devices OTA** | triggerOta, triggerOtaAll | ✅ | (istniejący guard) |
| **Notifications** | getSettings, upsertSetting, getLog | ✅ | req.user.organizationId z JWT |
| **InApp** | findForUser, markRead | ✅ | filtr po userId |
| **Organizations** | wszystkie | ✅ | @Roles(SUPER_ADMIN) — tylko operator |
| **Auth** | login, refresh, changePassword | ✅ | nie dotyczy (per-user) |

---

## Luki które były — naprawione

### 1. `GET /reservations` — OFFICE_ADMIN czyta cudze rezerwacje
**Przed:** `?locationId=<obca_lokalizacja>` zwracało rezerwacje innej org.
**Po:** `actorOrgId` zawsze z JWT. `findAll()` filtruje przez `desk.location.organizationId`.

### 2. `GET /reservations/:id` — read cudzej rezerwacji przez UUID
**Przed:** Każdy OFFICE_ADMIN mógł odczytać rezerwację dowolnej org przez UUID.
**Po:** `findOne(id, actorOrgId)` — ForbiddenException gdy org nie pasuje.

### 3. `POST /reservations` — rezerwacja biurka z innej org
**Przed:** `deskId` mógł wskazywać na biurko innej organizacji.
**Po:** `create()` sprawdza `desk.location.organizationId === actorOrgId`.

### 4. `GET /users?organizationId=<obca>` — odczyt użytkowników innej org
**Przed:** Query param `organizationId` był akceptowany dowolny.
**Po:** `@Query('organizationId')` usunięty. `findAll()` zawsze używa `req.user.organizationId`.

### 5. `PATCH /users/:id` — edycja usera z innej org
**Przed:** UUID wystarczył do edycji dowolnego użytkownika.
**Po:** `update(id, dto, actorRole, actorOrgId)` wywołuje `findOne(id, actorOrgId)`.

### 6. `PATCH /desks/:id` — edycja biurka z innej org
**Przed:** Brak sprawdzenia przynależności biurka do org aktora.
**Po:** `assertDeskInOrg(id, actorOrgId)` — Desk → Location → Organization.

### 7. `DELETE /gateways/:id` — usunięcie gateway innej org
**Przed:** Brak org check przed usunięciem.
**Po:** `assertGatewayInOrg(id, actorOrgId)`.

### 8. `POST /devices/:id/command` — komenda do beacona z innej org
**Przed:** REBOOT/IDENTIFY/SET_LED bez weryfikacji org.
**Po:** `assertBelongsToOrg(id, actorOrgId)` przed wysłaniem komendy.

### 9. `PATCH /locations/:id` — edycja lokalizacji innej org
**Przed:** Brak org check dla OFFICE_ADMIN.
**Po:** Inline guard: `loc.organizationId !== req.user.organizationId → 403`.

### 10. `POST /gateways/setup-tokens` — token dla lokalizacji innej org
**Przed:** `locationId` nie był weryfikowany pod kątem org.
**Po:** `createToken(locationId, userId, actorOrgId)` — sprawdza `location.organizationId`.

---

## Co jest poprawnie zabezpieczone od początku

- **JWT Strategy** (`jwt.strategy.ts`) — zawsze odpytuje DB (`findUnique`) i zwraca
  `organizationId` z bazy. Nie ufa zawartości tokenu.
- **OTA** (`devices.service.ts`) — `assertBelongsToOrg()` istniało przed tą sesją.
- **Checkins manual** (`checkins.service.ts`) — `actorOrgId` był przekazywany.
- **Locations findAll** (`locations.service.ts`) — `OFFICE_ADMIN` zawsze dostaje własną org.
- **Organizations** (`organizations.controller.ts`) — `@Roles(SUPER_ADMIN)` blokuje OFFICE_ADMIN.
- **Azure SSO config** (`organizations.controller.ts`) — `_assertOrgAccess()` istniało.
- **Notifications** — `organizationId` zawsze z `req.user`, nie z params.

---

## Zasady dla nowych endpointów

Każdy nowy endpoint który dotyka zasobów per-org **musi**:

1. Odczytać `actorOrgId` z JWT — nie z request body ani query params:
   ```typescript
   const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
   ```

2. Przekazać `actorOrgId` do serwisu jako ostatni parametr.

3. W serwisie — zweryfikować przed operacją przez łańcuch:
   `Zasób → Location → Organization → actorOrgId`

4. Nie ujawniać danych org w error messages (nie pisz "Org ABC nie ma biurka X").
   Zawsze generyczny: `ForbiddenException('Brak dostępu do zasobu')`.

---

## Testy bezpieczeństwa (do dodania w Sprint I)

```typescript
// Przykładowy test izolacji — do dodania w P4/P5

describe('Multi-tenant isolation', () => {
  it('OFFICE_ADMIN org A nie może odczytać rezerwacji org B', async () => {
    const reservationOrgB = await createReservationForOrg('org-b');
    const response = await request(app)
      .get(`/api/v1/reservations/${reservationOrgB.id}`)
      .set('Authorization', `Bearer ${tokenOrgA}`);
    expect(response.status).toBe(403);
  });

  it('OFFICE_ADMIN nie może użyć ?organizationId do filtrowania innej org', async () => {
    const response = await request(app)
      .get('/api/v1/users?organizationId=org-b-id')
      .set('Authorization', `Bearer ${tokenOrgA}`);
    // Powinno zwrócić tylko użytkowników org A, ignorując query param
    expect(response.body.every(u => u.organizationId === 'org-a-id')).toBe(true);
  });

  it('OFFICE_ADMIN nie może zarezerwować biurka z innej org', async () => {
    const deskOrgB = await getDeskFromOrg('org-b');
    const response = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenOrgA}`)
      .send({ deskId: deskOrgB.id, date: '2026-05-01', ... });
    expect(response.status).toBe(403);
  });
});
```

---

## Izolacja IoT — Beacon i Gateway

### Architektura MQTT (dwa oddzielne brokery)

```
Firma A — Raspberry Pi                    Cloud (Coolify)
┌──────────────────────────┐             ┌─────────────────────────┐
│ Mosquitto Pi (port 1883) │             │ Mosquitto Backend       │
│ ← beacon_esp32_A01       │             │ (expose only — NIE port)│
│ ← beacon_esp32_A02       │             │ ← tylko backend NestJS  │
│ → gateway.py             │─── HTTPS ──→│ POST /checkins/nfc      │
└──────────────────────────┘             │ POST /gateway/:id/sync  │
                                         └─────────────────────────┘
Firma B — Raspberry Pi
┌──────────────────────────┐
│ Mosquitto Pi (port 1883) │
│ ← beacon_esp32_B01       │ (oddzielna sieć lokalna — brak kontaktu z Pi firmy A)
│ → gateway.py             │
└──────────────────────────┘
```

Kluczowe: beacony **nigdy** nie łączą się z backend Mosquitto bezpośrednio.
Każde Pi ma własny izolowany broker. Backend Mosquitto jest wewnętrzny (Docker network).

---

### Luki IoT które były — naprawione (commit ffde555 + 276db43)

#### 1. `POST /checkins/nfc` — błędna autentykacja i brak org check
**Przed:** `@UseGuards(JwtAuthGuard, RolesGuard)` — gateway nie ma JWT, ale każdy
OFFICE_ADMIN mógł wywołać check-in z dowolnym `deskId` (z innej org).

**Po:** Autentykacja przez `x-gateway-secret` (bcrypt, jak `/gateway/:id/sync`).
Org check: `desk.locationId === gw.locationId` — ForbiddenException przy rozbieżności.

#### 2. Brak weryfikacji `device_id → deskId` w `checkinNfc()`
**Przed:** Beacon `esp32-abc` mógł publishować `desk/{cudzy_deskId}/checkin`.
Nikt nie sprawdzał czy beacon jest przypisany do tego biurka.

**Po:** `checkinNfc(deskId, cardUid, gatewayId, deviceId?)`:
```typescript
if (device.deskId && device.deskId !== deskId) {
  throw UNAUTHORIZED_SCAN — reason: 'device_desk_mismatch'
}
```

#### 3. Backend Mosquitto port 1883 wystawiony publicznie
**Przed:** `ports: ["1883:1883"]` — dostępny z internetu. Ktoś z hasłem `backend`
mógł publishować fake NFC scany bezpośrednio na `desk/+/checkin`.

**Po:** `expose: ["1883"]` — broker dostępny tylko wewnątrz sieci Docker.

#### 4. ACL Pi Mosquitto za szerokie (`desk/#` dla każdego beacona)
**Przed:** `MqttAdmin.add_beacon()` dawał `topic readwrite desk/#`.
Beacon firmy A mógł publishować na `desk/{biurko-firmy-B}/checkin`.

**Po:** Wąski ACL per-desk_id:
```
topic write desk/{deskId}/checkin
topic write desk/{deskId}/status
topic write desk/{deskId}/qr_scan
topic read  desk/{deskId}/command
topic read  desk/{deskId}/config
```
`update_beacon_acl()` wywoływana po `SET_DESK_ID` — ACL aktualizowany atomowo.

#### 5. `desk_id` nie był przekazywany przy provisioning
**Przed:** Gateway tworzył użytkownika MQTT bez informacji o biurku → szeroki ACL.

**Po:** Łańcuch provisioning przekazuje `desk_id`:
```
backend: provision() → addBeaconCredentials(gwId, user, pass, deskId)
               ↓ HTTP POST /beacon/add {username, password, desk_id}
gateway: add_beacon(username, password, desk_id) → wąski ACL
```

---

### Zabezpieczenia IoT które działały od początku

- **Autentykacja gateway → backend:** `x-gateway-secret` (bcrypt) na `/sync`, `/heartbeat`
- **Autentykacja beacon → Pi Mosquitto:** username/password per-beacon (generowane losowo)
- **`getSync()` filtruje per-gateway:** zwraca tylko rezerwacje z `gw.locationId`
- **Oddzielne brokery:** Pi Mosquitto ≠ Backend Mosquitto — fizyczna izolacja sieci
- **MQTT credentials jednokierunkowe:** beacon nie zna hasła gateway, gateway nie zna hasła beacona

---

### Zasady dla nowych funkcji IoT

1. **Każdy endpoint wywoływany przez gateway** musi używać `x-gateway-secret` (nie JWT).
2. **Każdy payload NFC/QR** musi zawierać `device_id` — weryfikowany po stronie serwera.
3. **ACL Pi Mosquitto** musi być wąski per-`deskId` — nigdy `topic readwrite desk/#` permanentnie.
4. **Backend Mosquitto** — nigdy nie mapować portów publicznych. Tylko `expose:`.
5. **Sync endpoint** zawsze filtruje przez `gw.locationId` — gateway dostaje tylko własne dane.

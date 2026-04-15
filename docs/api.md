# REST API Reference — Reserti Desk Management

**Base URL:** `https://api.prohalw2026.ovh/api/v1`
**Auth:** Bearer JWT (access token, 15min TTL)
**Swagger UI:** `https://api.prohalw2026.ovh/api/docs`
**Aktualizacja:** 2026-04-15 — v0.11.0

---

## Autentykacja

### `POST /auth/login`
```json
// Request
{ "email": "admin@demo-corp.pl", "password": "Admin1234!" }
// Response 200
{ "accessToken": "eyJ...", "refreshToken": "eyJ...",
  "user": { "id": "...", "email": "...", "role": "OFFICE_ADMIN", "organizationId": "..." } }
```

### `POST /auth/refresh`
```json
{ "refreshToken": "eyJ..." }
// Response 200 — nowa para tokenów (stary refresh unieważniony)
```

### `POST /auth/logout`
```json
{ "refreshToken": "eyJ..." }
// Response 204
```

### `POST /auth/azure` — logowanie SSO Entra ID
```json
{ "idToken": "eyJ..." }
// Response 200 — jak przy /auth/login
```

### `GET /auth/azure/check?email=user@firma.pl` — publiczny
```json
{ "available": true, "tenantId": "xxx-yyy-zzz" }
// Rate limit: 20 req/min
```

### `POST /auth/change-password` `[JWT]`
```json
{ "currentPassword": "stare", "newPassword": "nowe" }
// Response 204 — unieważnia wszystkie refresh tokeny
```

---

## Organizacje `[SUPER_ADMIN, OWNER]`

| Metoda | Ścieżka | Opis | Role |
|--------|---------|------|------|
| `GET` | `/organizations` | Lista wszystkich | SUPER_ADMIN |
| `POST` | `/organizations` | Utwórz | SUPER_ADMIN |
| `PATCH` | `/organizations/:id` | Aktualizuj | SUPER_ADMIN |
| `GET` | `/organizations/:id/azure` | Konfiguracja Entra ID | SUPER_ADMIN |
| `PATCH` | `/organizations/:id/azure` | Zapisz Entra ID config | SUPER_ADMIN |

---

## Lokalizacje

| Metoda | Ścieżka | Opis | Role |
|--------|---------|------|------|
| `GET` | `/locations` | Lista biur własnej org | OFFICE_ADMIN+ |
| `POST` | `/organizations/:orgId/locations` | Utwórz biuro | SUPER_ADMIN |
| `PATCH` | `/locations/:id` | Aktualizuj (godziny, limity) | OFFICE_ADMIN+ |
| `GET` | `/locations/:id/analytics/occupancy` | Zajętość live | OFFICE_ADMIN+ |
| `GET` | `/locations/:id/analytics/extended` | Rozszerzony dashboard | OFFICE_ADMIN+ |

```json
// GET /locations/:id/analytics/extended
{
  "occupancyPct": 45,
  "weekData": [{ "day": "Pon", "checkins": 12 }, ...],
  "weekTrend": 8,
  "hourly": [{ "hour": "9:00", "count": 5 }, ...],
  "topDesks": [{ "id": "...", "name": "A-01", "_count": { "checkins": 42 } }],
  "methods": [{ "method": "NFC", "_count": 28 }, ...]
}
```

---

## Biurka

| Metoda | Ścieżka | Opis | Role |
|--------|---------|------|------|
| `GET` | `/locations/:locId/desks` | Lista biurek | Wszyscy |
| `GET` | `/locations/:locId/desks/status` | Mapa zajętości live | Wszyscy |
| `POST` | `/locations/:locId/desks` | Utwórz biurko | OFFICE_ADMIN+ |
| `PATCH` | `/desks/:id` | Aktualizuj (name, floor, zone, status) | OFFICE_ADMIN+ |
| `DELETE` | `/desks/:id` | Dezaktywuj (soft) | OFFICE_ADMIN+ |
| `DELETE` | `/desks/:id/permanent` | Usuń trwale (tylko INACTIVE) | OFFICE_ADMIN+ |
| `POST` | `/desks/:id/activate` | Reaktywuj | OFFICE_ADMIN+ |
| `DELETE` | `/desks/:id/unpair` | Odparuj beacon | OFFICE_ADMIN+ |

```json
// GET /locations/:locId/desks/status — przykład jednego biurka
{
  "id": "desk-uuid",
  "name": "A-01",
  "code": "A-01",
  "floor": "1",
  "zone": "Open Space",
  "status": "ACTIVE",
  "isOccupied": false,
  "isOnline": true,
  "qrToken": "token-dla-qr-link",
  "currentReservation": null,
  "checkin": null,
  "device": { "hardwareId": "esp32-abc", "isOnline": true, "rssi": -65, "firmwareVersion": "1.2.0" }
}
```

---

## Rezerwacje

| Metoda | Ścieżka | Opis | Role |
|--------|---------|------|------|
| `GET` | `/reservations/my` | Moje rezerwacje | JWT |
| `GET` | `/reservations` | Wszystkie (filtry) | STAFF+ |
| `GET` | `/reservations/:id` | Szczegóły | STAFF+ |
| `GET` | `/reservations/:id/qr` | QR token | właściciel |
| `POST` | `/reservations` | Utwórz | JWT |
| `DELETE` | `/reservations/:id` | Anuluj | właściciel/ADMIN |

```json
// POST /reservations
{
  "deskId": "desk-uuid",
  "date": "2026-05-15",
  "startTime": "2026-05-15T08:00:00.000",
  "endTime": "2026-05-15T16:00:00.000",
  "targetUserId": "user-uuid"  // opcjonalne, tylko STAFF+
}
// ConflictException gdy nakładające się rezerwacje lub przekroczenie limitów lokalizacji
```

---

## Check-in / Check-out

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/checkins/qr` | Check-in przez QR (z rezerwacją) |
| `POST` | `/checkins/qr/walkin` | Walk-in przez QR (bez rezerwacji) |
| `POST` | `/checkins/manual` | Ręczny check-in `[STAFF+]` |
| `PATCH` | `/checkins/:id/checkout` | Check-out |

---

## Urządzenia (beacony)

| Metoda | Ścieżka | Opis | Role |
|--------|---------|------|------|
| `GET` | `/devices` | Lista beaconów (filtr org) | OFFICE_ADMIN+ |
| `GET` | `/devices/:id` | Szczegóły | OFFICE_ADMIN+ |
| `POST` | `/devices/provision` | Provisioning beacona | OFFICE_ADMIN+ |
| `POST` | `/devices/:id/command` | Wyślij komendę (REBOOT/IDENTIFY/SET_LED) | OFFICE_ADMIN+ |
| `PATCH` | `/devices/:id/assign` | Przypisz do biurka | OFFICE_ADMIN+ |
| `GET` | `/devices/firmware/latest` | Najnowsza wersja FW | OFFICE_ADMIN+ |
| `POST` | `/devices/:id/ota` | Wyzwól OTA update | OFFICE_ADMIN+ |
| `POST` | `/devices/ota-all` | OTA dla całej org/lokalizacji | OFFICE_ADMIN+ |
| `DELETE` | `/devices/:id` | Usuń beacon | OFFICE_ADMIN+ |

```json
// POST /devices/:id/ota → response (org-isolated)
{
  "triggered": true,
  "oldVersion": "1.0.0",
  "newVersion": "1.2.0",
  "deskId": "desk-uuid",
  "gatewayId": "gw-uuid"
  // _ota_payload NIE jest zwracany klientowi
}
```

---

## Gateway

| Metoda | Ścieżka | Opis | Role |
|--------|---------|------|------|
| `GET` | `/gateways` | Lista gateway org | OFFICE_ADMIN+ |
| `POST` | `/gateways/setup-tokens` | Generuj token instalacji (24h) | OFFICE_ADMIN+ |
| `DELETE` | `/gateways/:id` | Usuń gateway | OFFICE_ADMIN+ |
| `PATCH` | `/gateways/:id/rotate-secret` | Rotacja klucza | OFFICE_ADMIN+ |

**Endpointy wewnętrzne (gateway → backend):**
```
POST /gateways/:id/sync             x-gateway-secret header
POST /gateways/:id/heartbeat        x-gateway-secret
PATCH /devices/:hwId/heartbeat      x-gateway-provision-key
GET  /install/gateway/:token        publiczny — bash script z tokenem
```

---

## Użytkownicy

| Metoda | Ścieżka | Opis | Role |
|--------|---------|------|------|
| `GET` | `/users` | Lista aktywnych | OFFICE_ADMIN+ |
| `GET` | `/users/deactivated` | Lista dezaktywowanych | OFFICE_ADMIN+ |
| `POST` | `/users` | Utwórz | OFFICE_ADMIN+ |
| `PATCH` | `/users/:id` | Aktualizuj | OFFICE_ADMIN+ |
| `DELETE` | `/users/:id` | Dezaktywuj (retention) | OFFICE_ADMIN+ |
| `POST` | `/users/:id/restore` | Przywróć | OFFICE_ADMIN+ |
| `DELETE` | `/users/:id/permanent` | Trwałe usunięcie | OFFICE_ADMIN+ |
| `POST` | `/users/:id/nfc-scan/start` | Rozpocznij sesję skanowania NFC (60s) | OFFICE_ADMIN+ |
| `GET` | `/users/:id/nfc-scan/status` | Status skanowania | OFFICE_ADMIN+ |
| `POST` | `/users/:id/card` | Ręczne przypisanie karty NFC | OFFICE_ADMIN+ |

---

## Subskrypcja (planowane v0.12.0)

| Metoda | Ścieżka | Opis | Role |
|--------|---------|------|------|
| `GET` | `/subscription/status` | Stan subskrypcji własnej org | SUPER_ADMIN |
| `GET` | `/owner/organizations/:id/subscription` | Stan subskrypcji org | OWNER |
| `POST` | `/owner/organizations/:id/subscription` | Zmień plan | OWNER |
| `GET` | `/owner/organizations/:id/subscription/events` | Historia | OWNER |
| `GET` | `/owner/subscription/dashboard` | MRR + wygasające | OWNER |

```json
// GET /subscription/status
{
  "plan": "pro",
  "planExpiresAt": "2026-07-01T00:00:00.000Z",
  "daysUntilExpiry": 77,
  "status": "active",  // active|expiring_soon|expired|trial|trial_expiring
  "usage": {
    "desks":     { "used": 23, "limit": 50,  "pct": 46 },
    "users":     { "used": 67, "limit": 150, "pct": 45 },
    "gateways":  { "used": 2,  "limit": 3,   "pct": 67 },
    "locations": { "used": 3,  "limit": 5,   "pct": 60 }
  },
  "features": { "ota": true, "sso": true }
}
```

---

## Powiadomienia

| Metoda | Ścieżka | Opis | Role |
|--------|---------|------|------|
| `GET` | `/notifications/settings` | Ustawienia email | SUPER_ADMIN |
| `PATCH` | `/notifications/settings` | Zapisz ustawienia | SUPER_ADMIN |
| `GET` | `/notifications/log` | Historia wysyłki | SUPER_ADMIN |
| `POST` | `/notifications/settings/test` | Wyślij testowy email | SUPER_ADMIN |
| `GET` | `/notifications/smtp` | Konfiguracja SMTP org | SUPER_ADMIN |
| `PATCH` | `/notifications/smtp` | Zapisz SMTP | SUPER_ADMIN |
| `DELETE` | `/notifications/smtp` | Usuń własne SMTP | SUPER_ADMIN |
| `POST` | `/notifications/smtp/test` | Test SMTP | SUPER_ADMIN |
| `GET` | `/notifications/inapp` | Moje in-app notyfikacje | JWT |
| `POST` | `/notifications/inapp/mark-read` | Oznacz jako przeczytane | JWT |
| `GET` | `/notifications/rules` | Reguły per rola | OWNER |
| `POST` | `/notifications/rules` | Zapisz reguły | OWNER |
| `POST` | `/notifications/inapp/announce` | Ogłoszenie systemowe | OWNER |

---

## Owner API `[OWNER]`

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/owner/organizations` | Lista wszystkich org |
| `POST` | `/owner/organizations` | Utwórz org (+ konto SUPER_ADMIN) |
| `PATCH` | `/owner/organizations/:id` | Aktualizuj (plan, isActive, notes) |
| `DELETE` | `/owner/organizations/:id` | Dezaktywuj |
| `POST` | `/owner/organizations/:id/impersonate` | Token JWT 30min |
| `GET` | `/owner/stats` | Globalne statystyki platformy |
| `GET` | `/owner/health` | Health wszystkich gateway + beaconów |
| `GET` | `/owner/health/:orgId` | Health jednej organizacji |

---

## Monitoring

```
GET /metrics           poza /api/v1, tylko z whitelisted IPs (METRICS_ALLOWED_IPS)
                       format: Prometheus text
```

---

## Błędy

| Kod | Znaczenie |
|-----|-----------|
| 400 | Bad Request — walidacja (class-validator) |
| 401 | Unauthorized — brak/wygasły token |
| 403 | Forbidden — brak uprawnień do zasobu |
| 404 | Not Found — zasób nie istnieje |
| 409 | Conflict — nakładające się rezerwacje, OTA in_progress |
| 429 | Too Many Requests — rate limit (ThrottlerException) |
| 503 | Service Unavailable — gateway offline |

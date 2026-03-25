# REST API Reference — Desk Beacon System

**Base URL:** `https://api.twoja-domena.pl/api/v1`  
**Auth:** Bearer JWT (access token, 15 min TTL)  
**Swagger UI:** `https://api.twoja-domena.pl/api/docs`

---

## Autentykacja

### `POST /auth/login`
```json
// Request
{ "email": "admin@demo-corp.pl", "password": "Admin1234!" }

// Response 200
{
  "accessToken":  "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "...", "email": "...", "role": "OFFICE_ADMIN" }
}
```

### `POST /auth/refresh`
```json
// Request
{ "refreshToken": "eyJ..." }
// Response 200 — nowa para tokenów (stary refresh unieważniony)
```

### `POST /auth/logout`
```json
{ "refreshToken": "eyJ..." }
// Response 204
```

---

## Organizacje `[SUPER_ADMIN]`

| Metoda | Ścieżka | Opis |
|---|---|---|
| `GET` | `/organizations` | Lista wszystkich |
| `POST` | `/organizations` | Utwórz |
| `PATCH` | `/organizations/:id` | Aktualizuj |

---

## Lokalizacje

| Metoda | Ścieżka | Opis | Role |
|---|---|---|---|
| `GET` | `/organizations/:orgId/locations` | Lista lokalizacji | Admin+ |
| `POST` | `/organizations/:orgId/locations` | Utwórz lokalizację | Admin+ |
| `PATCH` | `/locations/:id` | Aktualizuj | Admin+ |
| `GET` | `/locations/:id/analytics/occupancy` | Statystyki zajętości | Admin+ |

### `GET /locations/:id/analytics/occupancy`
```json
{
  "totalDesks":       20,
  "occupiedDesks":    8,
  "occupancyPct":     40,
  "todayCheckins":    15,
  "reservationsToday": 18
}
```

---

## Biurka

| Metoda | Ścieżka | Opis | Role |
|---|---|---|---|
| `GET` | `/locations/:locId/desks` | Wszystkie biurka | Wszyscy |
| `GET` | `/locations/:locId/desks/status` | Mapa zajętości live | Wszyscy |
| `GET` | `/desks/:id` | Szczegóły + rezerwacje | Wszyscy |
| `GET` | `/desks/:id/availability?date=YYYY-MM-DD` | Wolne sloty | Wszyscy |
| `POST` | `/locations/:locId/desks` | Utwórz biurko | Admin+ |
| `PATCH` | `/desks/:id` | Aktualizuj | Admin+ |
| `DELETE` | `/desks/:id` | Dezaktywuj | Admin+ |

---

## Urządzenia (Beacony)

| Metoda | Ścieżka | Opis | Role |
|---|---|---|---|
| `GET` | `/devices` | Lista urządzeń | Admin+ |
| `POST` | `/devices/provision` | Zarejestruj beacon | Admin+ |
| `PATCH` | `/devices/:id/assign` | Przypisz do biurka | Admin+ |
| `POST` | `/devices/:id/command` | Wyślij komendę MQTT | Admin+ |

### `POST /devices/provision`
```json
// Request
{ "hardwareId": "d-abc123", "gatewayId": "gw-warsaw-1", "deskId": "clxxx" }

// Response 201
{
  "device": { "id": "...", "hardwareId": "d-abc123", ... },
  "mqttUsername": "beacon-d-abc123",
  "mqttPassword": "generated-secret"  // jednorazowo — zapisz!
}
```

### `POST /devices/:id/command`
```json
// Komendy:
{ "command": "SET_LED",   "params": { "color": "#00C800", "animation": "solid" } }
{ "command": "REBOOT",    "params": {} }
{ "command": "IDENTIFY",  "params": {} }
```

---

## Gateway

| Metoda | Ścieżka | Opis | Role |
|---|---|---|---|
| `GET` | `/gateway` | Lista gateway | Admin+ |
| `POST` | `/gateway/register` | Rejestracja | Admin+ |
| `POST` | `/gateway/:id/sync` | Wymuszenie sync | Admin+ |

---

## Rezerwacje

| Metoda | Ścieżka | Opis | Role |
|---|---|---|---|
| `GET` | `/reservations` | Lista z filtrami | Admin+ |
| `POST` | `/reservations` | Utwórz rezerwację | Wszyscy |
| `DELETE` | `/reservations/:id` | Anuluj | Owner/Admin |

### `POST /reservations`
```json
{
  "deskId":    "clxxxxxxxxxxxxxxxxxx",
  "date":      "2025-01-20",
  "startTime": "2025-01-20T09:00:00.000Z",
  "endTime":   "2025-01-20T17:00:00.000Z",
  "notes":     "opcjonalnie"
}
```

---

## Check-iny

| Metoda | Ścieżka | Opis | Role |
|---|---|---|---|
| `POST` | `/checkins/nfc` | Check-in przez NFC (gateway) | System |
| `POST` | `/checkins/qr` | Check-in przez QR | Użytkownik |
| `POST` | `/checkins/manual` | Ręczny check-in | Staff+ |
| `PATCH` | `/checkins/:id/checkout` | Check-out | Staff+ |

### `POST /checkins/manual`
```json
{ "deskId": "clxxx", "userId": "clxxx", "reservationId": "clxxx" }
```

---

## Użytkownicy

| Metoda | Ścieżka | Opis | Role |
|---|---|---|---|
| `GET` | `/users` | Lista użytkowników | Admin+ |
| `POST` | `/users` | Utwórz konto | Admin+ |
| `PATCH` | `/users/:id/card` | Przypisz kartę NFC | Admin+ |
| `DELETE` | `/users/:id` | Dezaktywuj | Admin+ |

### `POST /users`
```json
{
  "email":          "user@firma.pl",
  "password":       "Haslo1234!",
  "firstName":      "Jan",
  "lastName":       "Kowalski",
  "role":           "END_USER",
  "organizationId": "clxxx"
}
```

---

## Kody błędów

| Kod | Opis |
|---|---|
| `400` | Błędne dane wejściowe (walidacja) |
| `401` | Brak lub wygasły token |
| `403` | Brak uprawnień dla tej roli |
| `404` | Zasób nie istnieje |
| `409` | Konflikt (np. rezerwacja nakłada się) |
| `422` | Błąd biznesowy (np. biurko zajęte) |

---

## Role i uprawnienia

| Rola | Skrót | Uprawnienia |
|---|---|---|
| `SUPER_ADMIN` | SA | Pełny dostęp — wszystkie organizacje |
| `OFFICE_ADMIN` | OA | Jedna organizacja — pełny zarząd |
| `STAFF` | S | Podgląd + ręczny check-in/out |
| `END_USER` | U | Własne rezerwacje + QR check-in |

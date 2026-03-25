# MQTT Specification — Desk Beacon System

## Broker

| Property | Value |
|---|---|
| Implementation | Eclipse Mosquitto 2.x |
| Protocol | MQTT 3.1.1 |
| Port (plain) | 1883 |
| Port (WebSocket) | 9001 |
| QoS domyślne | 1 (at least once) |
| Auth | Username/password per klient |
| ACL | Per-topic per-klient (`infra/docker/mosquitto/acl`) |

---

## Identyfikatory klientów

| Klient | Username | Kto |
|---|---|---|
| Backend (NestJS) | `backend` | Subskrybuje `desk/#`, `gateway/#`, `user/#` |
| Gateway | `gateway-{gatewayId}` | Proces Node.js per biuro |
| Beacon | `beacon-{hardwareId}` | Firmware ESP32 |

---

## Drzewo tematów

```
desk/
  {deskId}/
    checkin       beacon → gateway → server   (QoS 1)
    status        beacon → server              (QoS 1, co 30s)
    qr_scan       beacon → gateway             (QoS 1)
    command       server → gateway → beacon   (QoS 1)
    config        server → beacon             (QoS 1, retained)

gateway/
  {gatewayId}/
    hello         gateway → server            (QoS 1, retained)
    heartbeat     gateway → server            (QoS 1)
    status        LWT gateway                 (QoS 1, retained)

user/
  {userId}/
    event         server → PWA/mobile         (QoS 1)

system/
  broadcast       server → wszyscy            (QoS 0)
```

---

## Schematy payloadów

### `desk/{deskId}/checkin` — beacon publikuje

```json
{
  "event_id":  "550e8400-e29b-41d4-a716-446655440000",
  "type":      "checkin",
  "device_id": "d-abc123",
  "desk_id":   "clxxxxxxxxxxxxxxxxxx",
  "timestamp": 1710000000,
  "method":    "nfc",
  "offline":   false,
  "card_uid":  "AA:BB:CC:DD",
  "rssi":      -62
}
```

Gateway uzupełnia `gateway_id` przed forwardingiem do serwera.

### `desk/{deskId}/status` — beacon publikuje co 30s (heartbeat)

```json
{
  "device_id":  "d-abc123",
  "desk_id":    "clxxxxxxxxxxxxxxxxxx",
  "status":     "FREE",
  "uptime":     3600,
  "rssi":       -58,
  "fw_version": "1.0.0"
}
```

### `desk/{deskId}/command` — serwer publikuje

```json
{
  "command": "SET_LED",
  "params": {
    "color":     "#00C800",
    "animation": "solid",
    "duration":  0
  }
}
```

**Dostępne komendy:**

| Komenda | Params | Efekt |
|---|---|---|
| `SET_LED` | `color` (#RRGGBB), `animation`, `duration?` | Zmień stan LED |
| `REBOOT` | — | Restart ESP32 |
| `IDENTIFY` | — | Błysk biały 3× — lokalizacja fizyczna |

### Kolory LED (hex)

| Hex | Stan | Animacja |
|---|---|---|
| `#00C800` | Wolne | solid |
| `#0050DC` | Zarezerwowane | solid |
| `#DC0000` | Zajęte / błąd / denied | solid / blink |
| `#C8A000` | Łączenie / provisioning | pulse |
| `#C8C8C8` | IDENTIFY flash | solid (tymczasowy) |

### `user/{userId}/event` — serwer do użytkownika

```json
{
  "type":     "checkin_confirmed",
  "userId":   "clxxxxxxxxxxxxxxxxxx",
  "deskId":   "clxxxxxxxxxxxxxxxxxx",
  "deskName": "Desk A-01",
  "ts":       1710000000000
}
```

**Typy eventów:** `checkin_confirmed`, `checkin_denied`, `reservation_reminder`, `reservation_cancelled`

### `system/broadcast` — globalny komunikat

```json
{
  "type":    "maintenance",
  "message": "System niedostępny 22:00–23:00",
  "ts":      1710000000000
}
```

---

## Mapowanie stanu → kolor LED

| Kolor | Stan biurka | Wyzwalacz |
|---|---|---|
| 🟢 `#00C800` solid | Wolne | Serwer potwierdza dostępność |
| 🔵 `#0050DC` solid | Zarezerwowane | Rezerwacja aktywna |
| 🔴 `#DC0000` solid | Zajęte (check-in) | Check-in autoryzowany |
| 🔴 `#DC0000` blink | Odmowa / błąd | NFC/QR nieautoryzowany |
| 🟡 `#C8A000` pulse | Łączenie / provisioning | Boot firmware |

---

## Flow check-in NFC — ścieżka MQTT

```
1. Beacon      → desk/{deskId}/checkin         (card_uid, event_id)
2. Gateway     → weryfikuje w SQLite cache
3a. Match      → desk/{deskId}/command         (SET_LED #DC0000 solid)
               → POST /checkins/nfc            (async do serwera)
               → user/{userId}/event           (checkin_confirmed)
3b. Brak match → desk/{deskId}/command         (SET_LED #DC0000 blink 3s)
               → logi UNAUTHORIZED_SCAN
```

Gateway odpowiada beaconowi **natychmiast** z lokalnego cache. Serwer jest powiadamiany asynchronicznie — latencja LED: ~15 ms.

---

## Strategia QoS

| Temat | QoS | Uzasadnienie |
|---|---|---|
| `desk/+/checkin` | 1 | Check-in nie może zaginąć |
| `desk/+/status` | 0 | Heartbeat — best effort, częsty |
| `desk/+/command` | 1 | Komenda LED musi dotrzeć |
| `desk/+/config` | 1 + retain | Config przeżywa restarty |
| `gateway/+/hello` | 1 + retain | Serwer widzi nawet po późnym połączeniu |
| `user/+/event` | 1 | Powiadomienie do użytkownika |

---

## Bezpieczeństwo

- Każdy klient ma unikalny login/hasło (brak anonymous)
- Konta beaconów tworzone przez `scripts/provision-beacon.sh`
- ACL ogranicza każdy beacon do własnych tematów `desk/{deskId}/*`
- Konto gateway może czytać/pisać wszystkie `desk/#`
- Konto backend ma pełny dostęp do wszystkich tematów
- Produkcja: TLS port 8883, wyłącz plain 1883

# Roadmap komunikacji backend ↔ gateway — Reserti (desk-panel)

> Główny dokument: `desk-gateway-python/docs/mqtt_roadmap.md`
> Ten plik zawiera sekcje specyficzne dla backendu NestJS oraz plan wdrożenia.
> Ostatnia aktualizacja: 2026-05-06
> Status: **implementacja zakończona (firmware + backend) — gotowe do wdrożenia**

---

## Stan implementacji (desk-panel)

Wszystkie moduły SSE zostały zaimplementowane. Poniżej stan faktyczny kodu:

| Plik | Status | Opis |
|------|--------|------|
| `gateway-auth.service.ts` | ✅ | HMAC-SHA256 verify + JWT issue (TTL 60min) |
| `gateway-commands.service.ts` | ✅ | SSE per-gateway, pending ACK map, timeout |
| `gateway-commands.service.spec.ts` | ✅ | 15 testów jednostkowych |
| `guards/gateway-jwt.guard.ts` | ✅ | JWT verify + scope: 'gateway' check |
| `dto/gateway-auth.dto.ts` | ✅ | gatewayId, ts, sig |
| `dto/gateway-ack.dto.ts` | ✅ | nonce, ok, ts, error? |
| `gateways.controller.ts` | ✅ | POST /auth, GET /:id/commands, POST /:id/ack |
| `gateways.service.ts` | ✅ | rotateSecret() dwufazowy, triggerUpdate() SSE |

### Zmienne środowiskowe (wymagane w Coolify)

```env
JWT_GATEWAY_SECRET=<openssl rand -hex 48>   # NOWE — wymagane
GATEWAY_PROVISION_KEY=<hex>                 # istniejące — sprawdź czy ustawione
```

---

## Wyniki code review firmware + stan po poprawkach (2026-05-06)

### Status po implementacji poprawek

| # | Problem | Status |
|---|---------|--------|
| F1 | OTA bez weryfikacji SHA256 | ✅ Naprawione — `mbedTLS` SHA-256 + `manifest.json` z GitHub Release |
| F3 | `/config` topic ignorowany | ✅ Naprawione — `ConfigCallback` + `applyConfig()` w LedService |
| — | Brak hardware watchdog | ✅ Naprawione — `esp_task_wdt_init(30)` + reset w loop() |
| — | Provisioning bez timeoutu | ✅ Naprawione — 10 min timeout |
| — | MQTT reconnect bez jitter | ✅ Naprawione — `esp_random() % 3000` per backoff interval |
| — | OTA timeout 60s za krótki | ✅ Naprawione — 300s |
| — | Offline queue: brak walidacji JSON | ✅ Naprawione — `deserializeJson` przed wysłaniem |
| — | `SET_RESERVATION`: brak walidacji expiry | ✅ Naprawione |
| F4 | TLS dla MQTT | 🟡 Otwarte — nie blokuje wdrożenia |

### Niespójności gateway ↔ firmware (aktualne)

#### ✅ QR Scan — wyjaśnione (nie dotyczy firmware)

QR scan w systemie Reserti działa przez aplikację mobilną (telefon → backend API).
Beacon nie jest zaangażowany — ACL Mosquitto dla `desk/{deskId}/qr_scan` dotyczy
potencjalnych przyszłych urządzeń z wbudowanym skanerem, nie obecnego beacona ESP32.

#### ⚠️ Pole `brightness` w SET_LED

Firmware odczytuje `params["brightness"]` (default 100), ale gateway nigdy
tego pola nie wysyła. Beacon zawsze działa z brightness=100. Nie jest to błąd —
brakująca funkcjonalność, jeśli będzie potrzebna.

#### ✅ Spójność protokołu

| Przepływ | Status |
|----------|--------|
| SSE `beacon_add` → gateway → `add_beacon()` | ✅ pola username/password/deskId zgodne |
| SSE `command` → gateway → MQTT publish | ✅ deskId/command/params zgodne |
| Firmware checkin payload → gateway `_handle_checkin()` | ✅ 100% |
| Firmware status payload → gateway `_handle_status()` | ✅ 100% |
| Gateway ACK → backend `GatewayAckDto` | ✅ nonce/ok/ts/error zgodne |
| OTA_UPDATE params (`url`, `version`, `sha256`) | ✅ backend wysyła sha256 z manifest.json |
| `/config` (`ledColorFree`, `ledColorOccupied`, `ledColorReserved`) | ✅ firmware obsługuje |

---

## Plan wdrożenia

### Założenia

- Środowisko produkcyjne: Coolify na Proxmox, Cloudflare Tunnel
- Gateway: RPi (różne modele) w sieciach biurowych za NATem, **bez publicznego IP, bez SSH z zewnątrz**
- Jedyna droga aktualizacji gateway: OTA przez SSE (`ota_update` command z panelu Admin)
- Liczba gateway: 1–2 per biuro
- Rollback: przez OTA do poprzedniej wersji (stary `gateway.py.bak` tworzony automatycznie)

### Krok 1 — Przygotowanie infrastruktury (jednorazowo)

**1.1 Wygeneruj klucze Ed25519 dla OTA gateway**

```bash
python3 -c "
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding, PublicFormat, PrivateFormat, NoEncryption
)
priv = Ed25519PrivateKey.generate()
pub  = priv.public_key()
print('=== KLUCZ PRYWATNY → GitHub Secret OTA_SIGNING_KEY ===')
print(priv.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()).decode())
print('=== KLUCZ PUBLICZNY → gateway.py OTA_PUBLIC_KEY_PEM ===')
print(pub.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo).decode())
"
```

- Klucz prywatny → `desk-gateway-python` repo → Settings → Secrets → `OTA_SIGNING_KEY`
- Klucz publiczny → wklej do `OTA_PUBLIC_KEY_PEM` w `gateway.py` i zrób commit

**1.2 Wygeneruj klucze Ed25519 dla OTA firmware (osobna para)**

Analogicznie dla `desk-firmware` — inny keypair, bo to oddzielny mechanizm:
- Klucz prywatny → `desk-firmware` repo → Settings → Secrets → `OTA_SIGNING_KEY`
- SHA256 jest obliczane przez `release.yml` automatycznie — klucz publiczny **nie jest potrzebny** w firmware (weryfikacja SHA256, nie podpisu Ed25519)

**1.3 `GATEWAY_PROVISION_KEY` — weryfikacja spójności**

`GATEWAY_PROVISION_KEY` to jeden wspólny sekret używany przez **wszystkie** gateway do:
- `GET /gateway/config` — pobieranie LED config per lokalizacja
- `PATCH /gateway/device/:id/heartbeat` — heartbeat beaconów

**Musi być identyczny** w Coolify i w `.env` na każdym RPi. Nie jest rotowany per-gateway.

```bash
# Sprawdź wartość w Coolify → desk-panel → Environment Variables
# Sprawdź wartość na RPi:
cat /opt/reserti-gateway/.env | grep GATEWAY_PROVISION_KEY
```

Jeśli nie istnieje w Coolify — wygeneruj i ustaw na wszystkich RPi jednocześnie:
```env
GATEWAY_PROVISION_KEY=<openssl rand -hex 32>
```

**1.4 `JWT_GATEWAY_SECRET` w Coolify** ✅ (już ustawione)

**1.5 Utwórz tag `v*` w `desk-gateway-python` żeby wyzwolić `release.yml`**

```bash
git tag v$(python3 -c "import re; v=re.search(r\"GATEWAY_VERSION\s*=\s*'([^']+)'\", open('gateway.py').read()); print(v.group(1))")
git push origin --tags
```

Workflow stworzy `manifest.json` z podpisem Ed25519 i GitHub Release.

**1.6 Utwórz tag `v1.0.1` w `desk-firmware`**

```bash
git tag v1.0.1
git push origin --tags
```

Workflow stworzy `manifest.json` z SHA256 i GitHub Release z binarką firmware.

**1.7 Zrób redeploy backendu** po upewnieniu się że wszystkie env vars są ustawione.

---

### Krok 2 — Wdrożenie gateway pilotażowego (1 biuro)

> **Uwaga:** RPi nie mają SSH z zewnątrz. Jedyna droga wdrożenia to OTA przez SSE
> z panelu Admin lub przez stary mechanizm `/update` (port 3001, dostępny lokalnie w biurze).

**2.1 Wyślij OTA update do gateway pilotażowego**

Panel Admin → Gateways → wybierz gateway → Aktualizuj → wpisz URL manifestu z GitHub Release.

Gateway pobierze nowy `gateway.py`, zweryfikuje podpis Ed25519 i zrestartuje się.

Alternatywnie — jeśli ktoś jest fizycznie w biurze, może przez laptop w sieci lokalnej:
```bash
curl -X POST http://GATEWAY_LOCAL_IP:3001/update \
  -H "x-gateway-secret: <aktualny sekret>" \
  -d '{"url": "<URL do release asset>"}'
```

**2.2 Weryfikacja — logi backendu** (przez Coolify log viewer)

```
Gateway auth: token issued — gatewayId=<id>
CommandListener: SSE connected — gatewayId=<id>
```

**2.3 Test provisioning beacona**

Sprowisionuj beacon przez panel Admin. Sprawdź w logach gateway (przez Coolify):
```
CommandListener: dispatching beacon_add nonce=<...>
Provisioning add OK: username=beacon-<hwid>
```

**2.4 Monitoring przez 24-48h**

Obserwuj w logach backendu:
- Czy SSE reconnectuje się po restarcie backendu?
- Czy heartbeaty beaconów docierają normalnie?
- Czy `410 Gone` pojawia się (oznacza że coś wciąż woła stary endpoint)?

---

### Krok 3 — Rolling update pozostałych gateway

Po potwierdzeniu działania pilotażowego — zaktualizuj pozostałe przez OTA:

Panel Admin → Gateways → dla każdego gateway → Aktualizuj → URL manifestu.

Weryfikacja po każdym:
```
Gateway auth: token issued — gatewayId=<id>
```

---

### Krok 4 — Weryfikacja końcowa

**4.1 Sprawdź że żaden gateway nie woła starych endpointów**

```bash
# W logach backendu lub gateway szukaj 410
grep "410" /var/log/... # lub przez Coolify log viewer
```

Jeśli 410 się pojawia — ten gateway jeszcze nie został zaktualizowany.

**4.2 Sprawdź rotację sekretu na jednym gateway**

Panel Admin → gateway → Rotuj sekret. Obserwuj logi:
```
rotate_secret: phase 1 (prepare) — gatewayId=<id>
rotate_secret: prepare ACK received
rotate_secret: new secretHash saved in DB
rotate_secret: verify OK — gateway reconnected with new secret
```

**4.3 Sprawdź OTA na jednym gateway** (po skonfigurowaniu kluczy Ed25519)

Panel Admin → gateway → Aktualizuj → wpisz URL manifestu.
Sprawdź że gateway pobrał, zweryfikował podpis i zrestartował się do nowej wersji.

---

### Krok 5 — Po zakończeniu rollout

**5.1 Decyzja: kiedy usunąć `do_POST()` 410 Gone**

Gdy wszystkie gateway zwracają logi z SSE (brak 410 w logach przez 7 dni)
— usuń logikę `do_POST()` z `GatewayApiHandler` i zwolnij kod.

**5.2 Decyzje biznesowe — podjęte**

| # | Decyzja | Decyzja |
|---|---------|---------|
| D1 | Polityka VERIFY FAILED przy rotacji sekretu | ✅ Alert + ręczna interwencja |
| D2 | RBAC dla OTA trigger beaconów | ✅ SUPER_ADMIN + OFFICE_ADMIN |
| D3 | Stack monitoringu | ✅ Grafana, metryki z rozróżnieniem na organizacje |
| D4 | Polityka retencji offline_events | ✅ 4h filtr w `_flush_queue()` |
| D5 | Trigger usunięcia 410 Gone | ✅ Brak 410 przez 7 dni w logach |
| D6 | TLS dla MQTT (beacon ↔ Mosquitto) | 🟡 Długoterminowo, nie blokuje wdrożenia |

---

### Harmonogram wdrożenia (szacunkowy)

| Dzień | Zadanie | Odpowiedzialny |
|-------|---------|----------------|
| D0 | Generowanie kluczy Ed25519, konfiguracja Coolify, redeploy backendu | DevOps |
| D0 | GitHub Release z podpisanym manifestem (tag v*) | DevOps |
| D1 | Wdrożenie na biuro pilotażowe, weryfikacja 24h | DevOps |
| D2 | Analiza logów pilotażu, ewentualne poprawki | Dev |
| D3–D5 | Rolling update pozostałych biur (po 2-3 dziennie) | DevOps |
| D6 | Weryfikacja końcowa — brak 410 w logach | DevOps |
| D7 | Test rotacji sekretu na produkcji | Dev + DevOps |
| D7+ | Decyzje biznesowe D1–D6, firmware roadmap | Produkt + Dev |

---

### Rollback plan

Jeśli gateway po aktualizacji nie łączy się przez SSE:

**Opcja A — OTA powrót do poprzedniej wersji** (zalecana):

Panel Admin → gateway → Aktualizuj → URL poprzedniego GitHub Release asset.

Gateway wykonuje OTA do starej wersji (backup `gateway.py.bak` tworzony automatycznie,
ale OTA do konkretnego tagu jest czystsze).

**Opcja B — lokalnie w biurze** (jeśli ktoś jest na miejscu):

```bash
# Z laptopa podłączonego do sieci biurowej
curl -X POST http://GATEWAY_LOCAL_IP:3001/update \
  -H "x-gateway-secret: <sekret>" \
  -d '{"url": "<URL poprzedniej wersji>"}'
```

Backend nadal akceptuje stary sekret przez `secretHashPending` (15-min okno).

---

## Firmware roadmap (pozostałe)

### F4 — TLS dla MQTT 🟡 Niski priorytet

Self-signed cert na Mosquitto + CA cert zakompilowany w firmware.
Nie blokuje wdrożenia — lokalna sieć biurowa jest akceptowalnym kompromisem
na start. Warunek konieczny: WPA2-Enterprise lub izolacja klientów na WiFi biurowym.

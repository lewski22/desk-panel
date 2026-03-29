# Gateway Provisioning — Plan Rozwoju

## Problem

Aktualne wdrożenie Gateway na Raspberry Pi wymaga:
1. Ręcznej instalacji OS
2. Ręcznej instalacji Docker
3. Ręcznego klonowania repo
4. Ręcznej edycji `.env`
5. Ręcznego uruchomienia `setup.sh`

Dla każdego biura to ~30 min pracy technicznej. Cel: **5 minut lub mniej, zero wiedzy technicznej**.

---

## Faza 1 — Auto-konfiguracja przez QR kod (NAJBLIŻSZY KROK)

### Cel
Admin skanuje QR kodem z panelu → Pi samo się konfiguruje.

### Jak działa
1. Super Admin w panelu: **Biura → + Nowe biuro → Generuj token instalacyjny**
2. Panel generuje jednorazowy token (ważny 24h) i wyświetla QR kod
3. Admin drukuje QR i dołącza do Pi
4. Pi po starcie (skrypt w cron @reboot) odpytuje:
   ```
   GET https://api.reserti.pl/api/v1/gateway/setup-token/{token}
   ```
5. Backend zwraca gotowy `.env` z GATEWAY_ID, GATEWAY_SECRET, SERVER_URL
6. Pi automatycznie uruchamia kontenery

### Co trzeba zbudować
- Backend: `POST /gateway/setup-tokens` — generuje token
- Backend: `GET /gateway/setup-token/:token` — zwraca config (jednorazowo)
- Admin Panel: przycisk "Generuj token instalacyjny" na stronie Biur
- Script na Pi: `auto-setup.sh` w cron

**Czas implementacji: 1-2 dni**

---

## Faza 2 — Dedykowany obraz OS (Raspberry Pi Imager)

### Cel
Admin pobiera gotowy `.img`, wgrywa na kartę SD przez Raspberry Pi Imager,
wpisuje tylko nazwę WiFi i hasło — reszta automatyczna.

### Jak działa
1. Pobierz `reserti-gateway-1.0.img` ze strony
2. Wgraj przez Raspberry Pi Imager (tak jak zwykły OS)
3. W Imager wpisz: WiFi SSID + hasło + URL backendu + token instalacyjny
4. Włóż kartę, włącz Pi → po 3 minutach gateway działa

### Techniczne
- Bazowy OS: **Raspberry Pi OS Lite 64-bit**
- Customize z `pi-gen` (narzędzie Raspberry Pi do budowania obrazów)
- Pre-instalowane: Docker, docker-compose, skrypt auto-setup
- `firstboot.sh` przy pierwszym uruchomieniu:
  - Łączy się z WiFi
  - Pobiera config przez token z API
  - Uruchamia `docker compose up -d`
  - Ustawia hostname na `reserti-gw-{ID}`

### Dystrybucja
- GitHub Releases: gotowe obrazy `.img.gz`
- Automatyczny build przez GitHub Actions przy każdym release

**Czas implementacji: 3-5 dni**

---

## Faza 3 — Gateway jako usługa SaaS (cloud-hosted)

### Cel
Brak potrzeby własnego hardware w biurze.
Beacony łączą się przez VPN/TLS do cloud MQTT.

### Jak działa
```
Beacony ESP32 → MQTT over TLS (port 8883)
                     ↓
              Cloud MQTT (reserti.pl)
                     ↓
              Backend + Dashboard
```

### Techniczne
- Mosquitto z TLS na `mqtt.reserti.pl:8883`
- Certyfikaty per-biuro (Let's Encrypt wildcard)
- Cloudflare Spectrum dla MQTT TCP (proxy + DDoS protection)
- Brak Raspberry Pi — beacony łączą się bezpośrednio

### Kiedy warto
Gdy liczba biur > 10 lub klienci nie chcą lokalnego hardware.

**Czas implementacji: 1-2 tygodnie**

---

## Rekomendacja

| Kiedy | Co wdrożyć |
|---|---|
| Teraz (demo, testy) | Aktualne rozwiązanie z `setup.sh` |
| Pierwsze wdrożenia produkcyjne | **Faza 1** — QR token (1-2 dni) |
| Skalowanie (5+ biur) | **Faza 2** — dedykowany obraz OS |
| Enterprise / brak IT w biurze | **Faza 3** — cloud MQTT |

---

## Quick Win — już teraz

Zanim wdrożysz Fazę 1, zmniejsz ból obecnego procesu:

### Interaktywny skrypt instalacyjny

```bash
#!/bin/bash
# pi-setup-interactive.sh
# Uruchom: curl -fsSL https://get.reserti.pl/gateway | bash

read -p "Adres backendu [https://api.prohalw2026.ovh/api/v1]: " SERVER_URL
SERVER_URL=${SERVER_URL:-https://api.prohalw2026.ovh/api/v1}

read -p "Gateway ID (z panelu Admin): " GATEWAY_ID
read -p "Gateway Secret (z panelu Admin): " GATEWAY_SECRET
read -p "Location ID (z panelu Admin → Biura): " LOCATION_ID
read -p "Hasło MQTT (wymyśl, min 16 znaków): " MQTT_PASSWORD

# Pobierz repo, wygeneruj .env, uruchom
git clone https://github.com/lewski22/desk-gateway.git
cd desk-gateway
cat > .env << ENVEOF
GATEWAY_ID=$GATEWAY_ID
GATEWAY_SECRET=$GATEWAY_SECRET
LOCATION_ID=$LOCATION_ID
SERVER_URL=$SERVER_URL
MQTT_BROKER_URL=mqtt://mosquitto:1883
MQTT_USERNAME=backend
MQTT_PASSWORD=$MQTT_PASSWORD
CACHE_DB_PATH=./data/cache.db
HEARTBEAT_TIMEOUT_MS=90000
MONITOR_INTERVAL_MS=30000
SERVER_SYNC_INTERVAL_MS=60000
ENVEOF

bash scripts/setup.sh
```

Jeden `curl | bash`, kilka pytań, gotowe.

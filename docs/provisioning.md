# Provisioning — Desk Beacon

Instrukcja rejestracji i konfiguracji nowego beacona ESP32.

---

## Przegląd procesu

```
1. Kup / zmontuj hardware (ESP32 + PN532 + WS2812B)
2. Wgraj firmware (PlatformIO)
3. Zarejestruj beacon w panelu Admin → /desks → "+ Paruj beacon"
4. Sflashuj konfigurację przez serial (scripts/flash-config.py)
5. Beacon startuje, łączy się z MQTT, LED → zielony
```

---

## Krok 1 — Hardware

| Komponent | Model | Pin |
|---|---|---|
| Mikrokontroler | ESP32 (WROOM-32) | — |
| NFC/RFID reader | PN532 (I2C) | SDA=21, SCL=22, IRQ=4, RST=5 |
| LED strip | WS2812B | DATA=13 |
| Zasilanie | 5V / min. 1A | — |

Schemat pinów → `desk-firmware/docs/hardware.md`

---

## Krok 2 — Firmware

```bash
git clone https://github.com/reserti/desk-firmware
cd desk-firmware

# Zainstaluj PlatformIO
pip install platformio

# Buduj i wgraj (USB)
pio run --target upload --upload-port /dev/ttyUSB0

# Monitor serial
pio device monitor --port /dev/ttyUSB0 --baud 115200
```

Po wgraniu firmware beacon wyświetla `PROVISIONING` (żółty pulse) i czeka na konfigurację przez serial.

---

## Krok 3 — Rejestracja w panelu Admin

```
Admin Panel → Biurka → wybierz biurko → "+ Paruj beacon"

Wypełnij:
  Hardware ID: d-UNIKALNE-ID  (np. d-warsaw-a01)
  Gateway:     gw-warsaw-1    (wybierz z listy)

→ Utwórz
```

Panel zwróci:
```
DEVICE_ID  = d-warsaw-a01
MQTT_USER  = beacon-d-warsaw-a01
MQTT_PASS  = xxxxxxxxxxxxxxxx   ← JEDNORAZOWO — zapisz!
DESK_ID    = clxxxxxxxxxxxxxxxxxx
```

---

## Krok 4 — Flash konfiguracji

```bash
python3 scripts/flash-config.py \
  --port       /dev/ttyUSB0 \
  --device-id  d-warsaw-a01 \
  --desk-id    clxxxxxxxxxxxxxxxxxx \
  --wifi-ssid  "BiuroWiFi" \
  --wifi-pass  "haslo-wifi" \
  --mqtt-host  192.168.1.100 \
  --mqtt-port  1883 \
  --mqtt-user  beacon-d-warsaw-a01 \
  --mqtt-pass  xxxxxxxxxxxxxxxx
```

Skrypt wysyła przez serial komendę:
```
PROVISION:{"device_id":"d-warsaw-a01","desk_id":"clxxx",...}
```

Beacon odpowiada `PROVISION_OK` i restartuje się.

---

## Krok 5 — Weryfikacja

Po restarcie beacon:
1. LED: żółty pulse (CONNECTING_WIFI)
2. LED: żółty pulse (CONNECTING_MQTT)
3. LED: zielony solid (FREE) ← **sukces**

W panelu Admin → Biurka → beacon powinien pokazać "Online".

---

## Troubleshooting

| Problem | Przyczyna | Rozwiązanie |
|---|---|---|
| LED miga czerwonym stale | ERROR — brak WiFi lub MQTT | Sprawdź hasło WiFi i dane MQTT |
| LED żółty na stałe | Provisioning mode | Wgraj konfigurację przez serial |
| `PROVISION_ERR:json_parse_failed` | Błędny JSON | Sprawdź skrypt flash-config.py |
| `PROVISION_ERR:nvs_write_failed` | Pełna pamięć NVS | Usuń konfigurację: `ERASE_NVS` przez serial |
| Beacon online ale nie check-inuje | Zły desk_id | Sprawdź desk_id w Admin → Biurka |

---

## Reset do factory defaults

```bash
# Przez serial monitor:
ERASE_NVS

# Beacon wróci do żółtego pulse (PROVISIONING mode)
# Ponownie przejdź przez kroki 3-4
```

---

## Provisioning masowy (wiele beaconów)

Dla wdrożeń > 10 beaconów użyj skryptu CSV:

```bash
# Przygotuj plik beacons.csv:
# device_id,desk_id,wifi_ssid,wifi_pass,mqtt_host,mqtt_user,mqtt_pass
d-a01,clxxx1,BiuroWiFi,pass,192.168.1.100,beacon-d-a01,secret1
d-a02,clxxx2,BiuroWiFi,pass,192.168.1.100,beacon-d-a02,secret2

python3 scripts/flash-config.py --csv beacons.csv --port /dev/ttyUSB0
```

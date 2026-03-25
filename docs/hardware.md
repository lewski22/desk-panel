# Hardware — Desk Beacon

## Komponenty

| Komponent | Model | Ilość | Orientacyjna cena |
|---|---|---|---|
| Mikrokontroler | ESP32-WROOM-32 | 1 | ~20 PLN |
| NFC/RFID reader | PN532 (moduł I2C) | 1 | ~25 PLN |
| LED strip | WS2812B (6 LED, 5V) | 1 | ~15 PLN |
| Obudowa | druk 3D / plastikowa | 1 | ~10 PLN |
| Zasilacz | 5V / 2A USB-C | 1 | ~20 PLN |

**Koszt jednego beacona: ~90 PLN**

---

## Schemat połączeń

```
ESP32             PN532
─────             ─────
3.3V    ────────  VCC
GND     ────────  GND
GPIO21  ────────  SDA
GPIO22  ────────  SCL
GPIO4   ────────  IRQ
GPIO5   ────────  RESET

ESP32             WS2812B
─────             ───────
5V      ────────  VCC
GND     ────────  GND
GPIO13  ────────  DIN
```

---

## Konfiguracja pinów (device_config.h)

```cpp
#define PIN_NFC_IRQ    4    // PN532 IRQ
#define PIN_NFC_RESET  5    // PN532 RESET
#define PIN_LED_DATA   13   // WS2812B data
#define LED_COUNT      6    // liczba LED w pasku
```

---

## Kolory LED

| Hex | RGB | Stan |
|---|---|---|
| `#00C800` | (0, 200, 0) | Wolne — zielony |
| `#0050DC` | (0, 80, 220) | Zarezerwowane — niebieski |
| `#DC0000` | (220, 0, 0) | Zajęte / błąd — czerwony |
| `#C8A000` | (200, 160, 0) | Łączenie — żółty |
| `#C8C8C8` | (200, 200, 200) | IDENTIFY flash — biały |

Kolory zdefiniowane w `device_config.h` jako `LED_HEX_*`.

---

## Zużycie energii

| Stan | Prąd ESP32 | Prąd WS2812B (6 LED) | Łącznie |
|---|---|---|---|
| WiFi aktywne | ~80 mA | ~20–120 mA | ~100–200 mA |
| Deep sleep | ~10 µA | 0 | ~0.01 mA |

Zalecane zasilanie: **5V / 2A** (margines dla peak'ów WiFi + LED pełna jasność).

---

## Firmware — wymagania

- PlatformIO CLI lub IDE
- ESP-IDF toolchain (automatycznie przez PlatformIO)
- Biblioteki (platformio.ini):
  - `adafruit/Adafruit PN532`
  - `adafruit/Adafruit NeoPixel`
  - `knolleary/PubSubClient`
  - `bblanchon/ArduinoJson`

---

## Montaż

1. Przylutuj lub podłącz PN532 do ESP32 (I2C: SDA/SCL + IRQ/RST)
2. Podłącz WS2812B do GPIO13 (DATA) + 5V/GND
3. Umieść w obudowie — PN532 powinien być skierowany w górę (lektura kart)
4. Podłącz zasilacz 5V przez USB-C lub złącze barrel

Zalecane: kondensator 1000µF między VCC a GND WS2812B (stabilizacja zasilania).

/**
 * desk-firmware — poprawka timestampów przez NTP
 *
 * PROBLEM:
 *   Obecny kod używa `millis()/1000` jako timestamp w MQTT payload.
 *   millis() resetuje się przy każdym restarcie ESP32, więc timestamp
 *   nie odpowiada rzeczywistemu czasowi — TTL offline queue jest niedokładne.
 *
 * ROZWIĄZANIE:
 *   NTP synchronizacja przez WiFi (ESP32 ma wbudowany NTP stack w IDF).
 *   Używamy `time(nullptr)` — zwraca Unix timestamp po synchronizacji.
 *
 * PLIKI DO EDYCJI:
 *   src/network/wifi_manager.cpp  — dodaj NTP po WiFi connect
 *   src/events/event_queue.cpp    — zmień millis()/1000 → getTimestamp()
 *   src/utils/time_utils.h        — nowy plik pomocniczy
 *
 * ZALEŻNOŚCI:
 *   Brak nowych — ESP32 Arduino ma wbudowany configTime() z ESP-IDF.
 */

// ─────────────────────────────────────────────────────────────────────────────
// NOWY PLIK: src/utils/time_utils.h
// ─────────────────────────────────────────────────────────────────────────────
const char TIME_UTILS_H[] = R"(
#pragma once
#include <time.h>
#include <Arduino.h>

// Serwery NTP — pula + Google jako backup
#define NTP_SERVER_1  "pool.ntp.org"
#define NTP_SERVER_2  "time.google.com"
#define NTP_TIMEOUT_MS 10000   // 10s timeout na sync
#define EPOCH_2024     1704067200UL  // 2024-01-01 00:00:00 UTC

// Inicjalizuje NTP. Wywołaj po WiFi.begin() gdy WiFi.status() == WL_CONNECTED.
inline bool ntpSync() {
    configTime(0, 0, NTP_SERVER_1, NTP_SERVER_2);

    Serial.print("[NTP] Synchronizing...");
    unsigned long start = millis();
    struct tm ti;

    while (!getLocalTime(&ti, 100)) {
        if (millis() - start > NTP_TIMEOUT_MS) {
            Serial.println(" TIMEOUT");
            return false;
        }
        delay(100);
        Serial.print(".");
    }

    time_t now = time(nullptr);
    Serial.printf(" OK — Unix: %lu\n", (unsigned long)now);
    return true;
}

// Zwraca aktualny Unix timestamp.
// Jeśli NTP nie zsynchronizowany → zwraca czas relatywny od bootu
// (millis/1000 + EPOCH_2024 jako fallback, żeby TTL był sensowny).
inline uint32_t getTimestamp() {
    time_t now = time(nullptr);
    if (now > EPOCH_2024) {
        return (uint32_t)now;  // poprawny Unix timestamp
    }
    // Fallback: relatywny czas od bootu przesunięty o 2024
    // Lepszy niż sam millis() — TTL queue nie będzie liczone od 0
    return (uint32_t)(EPOCH_2024 + millis() / 1000);
}

// Sprawdza czy czas jest zsynchronizowany z NTP
inline bool isTimeSynced() {
    return time(nullptr) > EPOCH_2024;
}
)";

// ─────────────────────────────────────────────────────────────────────────────
// PATCH: src/network/wifi_manager.cpp
// Dodaj po WiFi.waitForConnectResult() lub WiFi.status() == WL_CONNECTED:
// ─────────────────────────────────────────────────────────────────────────────
const char WIFI_PATCH[] = R"(
// ← DODAJ ten include na górze pliku:
#include "utils/time_utils.h"

// ← DODAJ po linii gdzie WiFi jest połączony (np. po "WiFi connected"):
bool synced = ntpSync();
if (!synced) {
    Serial.println("[NTP] Using relative timestamps (NTP unavailable)");
}
)";

// ─────────────────────────────────────────────────────────────────────────────
// PATCH: wszędzie gdzie był millis()/1000 — zamień na getTimestamp()
// ─────────────────────────────────────────────────────────────────────────────
const char TIMESTAMP_PATCH[] = R"(
// PRZED (event_queue.cpp, mqtt_handler.cpp itp.):
doc["timestamp"] = millis() / 1000;

// PO:
#include "utils/time_utils.h"
doc["timestamp"] = getTimestamp();
)";

// ─────────────────────────────────────────────────────────────────────────────
// PATCH: Heartbeat payload — dodaj pole "time_synced" dla diagnostyki
// ─────────────────────────────────────────────────────────────────────────────
const char HEARTBEAT_PATCH[] = R"(
// W budowaniu payloadu heartbeat:
doc["timestamp"]  = getTimestamp();
doc["uptime"]     = millis() / 1000;       // uptime od bootu — zostaw millis()
doc["time_synced"] = isTimeSynced();       // ← NOWE: widoczne w dashboardzie
doc["fw_version"] = FW_VERSION;
)";

// ─────────────────────────────────────────────────────────────────────────────
// UWAGI:
//
// 1. configTime(0, 0, ...) — offset 0 = UTC. Jeśli potrzebujesz lokalną
//    strefę: configTime(3600, 3600, ...) dla CET/CEST (Europa Środkowa).
//    Ale lepiej trzymać UTC wszędzie i konwertować na frontendzie.
//
// 2. NTP przez WiFi działa tylko gdy beacon ma dostęp do internetu.
//    Jeśli sieć biurowa blokuje port 123 (UDP) → NTP nie zadziała.
//    W takim przypadku getTimestamp() fallback jest bezpieczny.
//
// 3. Czas po OTA update — po restarcie z nowym firmware NTP syncuje się
//    ponownie automatycznie (configTime() wywołany przy każdym WiFi connect).
//
// 4. Offline NVS queue TTL — po tej poprawce TTL 1h będzie liczony od
//    rzeczywistego czasu, nie od czasu bootu. Eventy sprzed restartu
//    z prawdziwym timestampem nie wygasną zbyt wcześnie.
// ─────────────────────────────────────────────────────────────────────────────

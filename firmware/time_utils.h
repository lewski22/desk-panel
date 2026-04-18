#pragma once
/**
 * desk-firmware/src/utils/time_utils.h
 *
 * Pomocnicze funkcje do zarządzania czasem na ESP32.
 * Używa NTP przez WiFi — działa bez dodatkowego hardware (RTC).
 *
 * Użycie:
 *   #include "utils/time_utils.h"
 *
 *   // Po WiFi connect:
 *   ntpSync();
 *
 *   // Zamiast millis()/1000:
 *   uint32_t ts = getTimestamp();
 */

#include <time.h>
#include <Arduino.h>

// ── Konfiguracja ─────────────────────────────────────────────────────────────
#define NTP_SERVER_1     "pool.ntp.org"
#define NTP_SERVER_2     "time.google.com"
#define NTP_SERVER_3     "time.cloudflare.com"
#define NTP_TIMEOUT_MS   10000UL          // 10s timeout
#define NTP_RETRY_MS     30000UL          // retry co 30s jeśli sync nie powiódł się
#define EPOCH_2024       1704067200UL     // 2024-01-01T00:00:00Z — sentinel dla "czas zsync."

static unsigned long _lastNtpAttempt = 0;
static bool          _ntpSynced      = false;

// ── NTP sync ─────────────────────────────────────────────────────────────────
/**
 * ntpSync() — próba synchronizacji czasu przez NTP.
 *
 * Wywołaj po WiFi.status() == WL_CONNECTED.
 * Bezpieczna do wielokrotnego wywołania — ignoruje kolejne wywołania
 * jeśli sync już się powiódł (chyba że force=true).
 *
 * @return true jeśli synchronizacja się powiodła
 */
inline bool ntpSync(bool force = false) {
  if (_ntpSynced && !force) return true;

  unsigned long now = millis();
  if (!force && (now - _lastNtpAttempt) < NTP_RETRY_MS && _lastNtpAttempt > 0) {
    return false; // Zbyt wcześnie na retry
  }
  _lastNtpAttempt = now;

  // UTC — bez przesunięcia strefy (konwersja na frontendzie)
  configTime(0, 0, NTP_SERVER_1, NTP_SERVER_2, NTP_SERVER_3);

  Serial.print("[NTP] Syncing...");

  struct tm ti;
  unsigned long deadline = millis() + NTP_TIMEOUT_MS;

  while (millis() < deadline) {
    if (getLocalTime(&ti, 200) && time(nullptr) > EPOCH_2024) {
      _ntpSynced = true;
      char buf[32];
      strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &ti);
      Serial.printf(" OK — %s\n", buf);
      return true;
    }
    Serial.print(".");
    delay(200);
  }

  Serial.println(" TIMEOUT — using relative timestamps");
  return false;
}

// ── Timestamp ─────────────────────────────────────────────────────────────────
/**
 * getTimestamp() — zwraca Unix timestamp (sekundy od 1970-01-01).
 *
 * Jeśli NTP zsynchronizowany → dokładny czas UTC.
 * Jeśli nie → czas relatywny od bootu przesunięty o EPOCH_2024.
 * Fallback jest lepszy niż millis()/1000 — TTL offline queue
 * nie będzie liczone od epoki 0.
 */
inline uint32_t getTimestamp() {
  time_t t = time(nullptr);
  if (t > (time_t)EPOCH_2024) {
    return (uint32_t)t; // zsynchronizowany czas
  }
  // Fallback: czas bootu jako offset od EPOCH_2024
  return (uint32_t)(EPOCH_2024 + millis() / 1000);
}

// ── Status ────────────────────────────────────────────────────────────────────
/**
 * isTimeSynced() — czy czas jest zsynchronizowany z NTP.
 * Dodaj do heartbeat payload jako "time_synced" do diagnostyki w Grafanie.
 */
inline bool isTimeSynced() {
  if (_ntpSynced) return true;
  // Też check bezpośredni na wypadek gdyby sync nastąpił poza ntpSync()
  _ntpSynced = (time(nullptr) > (time_t)EPOCH_2024);
  return _ntpSynced;
}

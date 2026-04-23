# To Fix — Lista błędów #3

> Wygenerowano: 2026-04-23
> Projekt: desk-panel (monorepo — `apps/unified` + `backend`)

---

## TODO — wymagają dalszej analizy / decyzji

1. **[TODO][M365] Dwustronna synchronizacja kalendarza sal** — Przy tworzeniu sali i połączeniu konta z Microsoft 365 kalendarz powinien integrować się dwustronnie między systemem a Microsoft. Jeśli zostanie użyty system rezerwacji sal — synchronizacja powinna być trójstronna.

2. **[TODO][DEMO] Instancja demo z hardkodowanymi danymi** — Przygotować instancję demo z samym UI i hardkodowanymi danymi (bez backendu).

---

## Błędy krytyczne

3. **[PROVISIONING] Biały ekran po wejściu w zakładkę Provisioning** ✅ NAPRAWIONE (2026-04-23) — `GatewaySection` nie miał `const { t } = useTranslation()`, przez co wywoływanie `t()` w renderie rzucało `ReferenceError: t is not defined`. Dodano hook + zmieniono `const t = setInterval(...)` na `const timer`.

---

## Wygląd / Spójność

4. **[UI] Kolory statusu pod mapą — niekompletne** ✅ NAPRAWIONE (2026-04-23) — `FloorPlanView.tsx` Legend: `#0ea5e9` → `#f59e0b` (zarezerwowane), `#6366f1` → `#ef4444` (zajęte). `DeskInfoCard` statusLabel: `text-indigo-600` → `text-red-600`, `text-sky-600` → `text-amber-600`.

5. **[I18N] Brak tłumaczeń klucza `layout.nav.integrations` w sidebar** ✅ NAPRAWIONE (2026-04-23) — Dodano `"integrations": "Integracje"` / `"Integrations"` do sekcji `layout.nav` w obu plikach tłumaczeń.

---

## Uprawnienia

6. **[RBAC] Rola OFFICE_ADMIN (Admin) nie może wejść w powiadomienia** ✅ NAPRAWIONE (2026-04-23) — `App.tsx`: guard `/notifications` zmieniony z `SUPER_ONLY` → `ADMIN_ROLES`. Backend: `PUT settings/:type` i `PUT settings` odblokowane dla OFFICE_ADMIN (z ograniczeniem do własnej org). UI: OA widzi pełną listę reguł + może edytować odbiorców dla kategorii rezerwacje; odbiorcy infra/system są tylko do odczytu (SA-managed); zakładka SMTP i test-send ukryte dla OA.

---

## Provisioning — UX sprzętu

7. **[TODO][PROVISIONING] Provisioning Gateway przez USB** — Możliwość provisioningu gateway po podłączeniu przez kabel USB do komputera admina (WebSerial API). Wymaga ustalenia: platforma sprzętowa gateway, czy RPi/Linux obsługuje USB serial, akceptowalność Chrome/Edge only.

8. **[TODO][PROVISIONING] Provisioning Beacon przez USB** — Możliwość provisioningu beacona (ESP32?) przez kabel USB do komputera admina (WebSerial API). Wymaga ustalenia: czy firmware obsługuje komendy konfiguracyjne przez UART, co dokładnie jest przesyłane (credentials MQTT, WiFi, gateway ID).

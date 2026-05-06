# Strefy czasowe — Reserti

> Ostatnia aktualizacja: 2026-05-07 — v0.17.8

Każda lokalizacja (`Location`) przechowuje własną strefę czasową w polu `timezone` (IANA string, np. `Europe/Warsaw`, `Europe/London`, `Asia/Dubai`). Domyślna wartość to `Europe/Warsaw`.

---

## Model danych

```prisma
model Location {
  timezone  String  @default("Europe/Warsaw")
  openTime  String  @default("08:00")   // czas lokalny lokalizacji
  closeTime String  @default("18:00")   // czas lokalny lokalizacji
  ...
}
```

`openTime` i `closeTime` są zawsze **w lokalnym czasie lokalizacji** — nie w UTC. Przy obliczeniach czasowych na backendzie zawsze konwertuj przez `location.timezone`.

---

## Zasady ogólne

### Backend (Node.js)

Serwer działa w UTC (`TZ=UTC` lub domyślnie). Nigdy nie polegaj na systemowej strefie serwera.

**Konwersja UTC → czas lokalny lokalizacji:**
```typescript
const tz = location.timezone; // np. 'Europe/London'

// Aktualna godzina lokalna (format HH:MM:SS)
const localTimeStr = new Date().toLocaleTimeString('sv-SE', { timeZone: tz });
const [h, m] = localTimeStr.split(':').map(Number);
const localMinutes = h * 60 + m;

// Dzisiejsza data lokalna (format YYYY-MM-DD)
const todayLocal = new Date().toLocaleDateString('sv-SE', { timeZone: tz });
```

`'sv-SE'` locale daje format `HH:MM:SS` (24h) i `YYYY-MM-DD` — wygodny do parsowania, działa dla wszystkich stref.

**Okno UTC dla zapytań DB obejmujących dany dzień lokalny:**
```typescript
// Bezpieczne okno ±14h pokrywa każdą możliwą strefę (UTC-12..UTC+14)
const windowStart = new Date(`${dateLocal}T00:00:00Z`);
windowStart.setUTCHours(windowStart.getUTCHours() - 14);
const windowEnd = new Date(`${dateLocal}T23:59:59Z`);
windowEnd.setUTCHours(windowEnd.getUTCHours() + 14);
```

Po pobraniu z DB — filtruj precyzyjnie w pamięci przez `toLocaleDateString('sv-SE', { timeZone: tz })`.

**Nigdy:**
```typescript
// ❌ Hardkodowana strefa
new Date().toLocaleTimeString('sv-SE', { timeZone: 'Europe/Warsaw' })

// ❌ UTC suffix na dacie lokalnej — przesuwa czas o offset strefy
new Date(`${dateLocal}T${hh}:${mm}:00.000Z`)

// ❌ Strefa serwera Node (getHours, getMinutes — zwraca UTC gdy TZ=UTC)
new Date().getHours()
```

### Frontend (React)

Daty z API są w ISO 8601 UTC. Do wyświetlenia używaj `toLocaleTimeString`/`toLocaleDateString` z `timeZone: 'Europe/Warsaw'` jeśli lokalizacja jest znana, albo z timezone pobranym z kontekstu użytkownika.

```typescript
const TZ = 'Europe/Warsaw'; // TODO: pobierać z profilu lokalizacji użytkownika
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
```

> **Znane ograniczenie (v0.17.8):** frontend hardkoduje `Europe/Warsaw` w `MyReservationsPage`, `BookingModal` i kilku innych komponentach. Docelowo `timezone` powinien być przekazywany z danych lokalizacji lub kontekstu sesji użytkownika.

---

## Gdzie jest używane

### `resources.service.ts` — `findAll`

Pobiera `location.timezone` **przed** głównym zapytaniem, używa go do:
- wyznaczenia `todayLocal` (jaki dziś jest dzień w tej lokalizacji)
- filtrowania `currentBooking` (czy booking trwa *teraz* w czasie lokalnym)
- obliczania `nextAvailableSlot` — pierwszy wolny 30-minutowy slot od teraz w czasie lokalnym
- konwersji `startTime`/`endTime` bookingów UTC → minuty lokalne przy porównaniu slotów

### `resources.service.ts` — `getAvailability`

Pobiera `location.openTime`, `location.closeTime` i `location.timezone` do budowania siatki slotów. Sloty są generowane w minutach lokalnych; porównanie z bookingami UTC odbywa się przez `toLocaleTimeString`.

> **Uwaga:** zapytanie DB dla slotów dziennych używa okna ±14h UTC — patrz sekcja wyżej.

### Cron jobs (`reservations.service.ts`)

`expireOldReservations` i `autoCheckout` operują na UTC — działają poprawnie niezależnie od strefy lokalizacji, bo porównują `endTime` (UTC) z `new Date()` (UTC).

---

## Dodawanie nowej lokalizacji z niestandardową strefą

1. W formularzu `OrganizationsPage` wybierz lub wpisz IANA timezone string (np. `America/New_York`).
2. Backend zapisuje go w `Location.timezone`.
3. Żadnych migracji ani restartów nie trzeba — kod czyta `timezone` per-request.

Pełna lista IANA timezone strings: [IANA Time Zone Database](https://www.iana.org/time-zones) lub `Intl.supportedValuesOf('timeZone')` w Node ≥ 18.

---

## Testowanie

Gdy piszesz testy obejmujące logikę czasową:

```typescript
// Zamiast mockować Date.now() — ustaw TZ w środowisku testowym
process.env.TZ = 'UTC'; // serwer zawsze UTC

// Konstruuj daty z jawnym offsetem żeby być precyzyjnym
const booking = { startTime: new Date('2026-05-07T08:00:00+02:00') }; // 08:00 CEST
```

Testuj przynajmniej dwie strefy: `Europe/Warsaw` (CET/CEST, DST) i `UTC` (brak DST) żeby wykryć błędy związane z letnim przestawieniem zegara.

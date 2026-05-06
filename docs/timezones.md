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

Daty z API są w ISO 8601 UTC. Do wyświetlenia używaj `toLocaleTimeString`/`toLocaleDateString` z `timezone` pobranym z danych lokalizacji lub timezone przeglądarki jako fallback.

```typescript
// timezone z danych lokalizacji (preferowane)
const TZ = location.timezone;

// lub timezone przeglądarki jako fallback dla widoków bez kontekstu lokalizacji
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
```

**Reguła:** nigdy nie hardkoduj `'Europe/Warsaw'` w komponentach frontendowych. Jeśli nie ma kontekstu lokalizacji (np. widok admina z wieloma lokalizacjami), użyj `Intl.DateTimeFormat().resolvedOptions().timeZone` (timezone przeglądarki użytkownika).

---

## Gdzie jest używane

### `resources.service.ts` — `findAll`

Pobiera `location.timezone` **przed** głównym zapytaniem, używa go do:
- wyznaczenia `todayLocal` (jaki dziś jest dzień w tej lokalizacji)
- filtrowania `currentBooking` (czy booking trwa *teraz* w czasie lokalnym)
- obliczania `nextAvailableSlot` — pierwszy wolny 30-minutowy slot od teraz w czasie lokalnym
- konwersji `startTime`/`endTime` bookingów UTC → minuty lokalne przy porównaniu slotów

### `resources.service.ts` — `getAvailability`

Pobiera `location.timezone` (oraz `openTime`, `closeTime`) i buduje siatkę slotów w minutach lokalnych. Zapytanie DB używa okna ±14h UTC, a następnie filtruje bookings w pamięci przez `toLocaleDateString(tz)`. Sloty porównywane są przez `toLocalMin()` — analogicznie do `findAll`.

### `desks.service.ts` — `getCurrentStatus`

Pobiera `location.timezone` (wraz z pozostałymi limitami) z `location.findUnique` przed głównym `findMany` — jedno wstępne zapytanie zamiast includowania lokalizacji per-desk.

### `notifications.service.ts`

Formatuje czas powiadomień email (`notifyReservationConfirmed`, `notifyReservationCancelled`) używając `desk.location?.timezone` pobranego z pełnego `include` lokalizacji.

### `graph.service.ts` — `createCalendarEvent` / `updateCalendarEvent`

`CalendarEventInput` ma opcjonalne pole `timezone?`. Caller (`reservations.service.ts`) przekazuje `desk.location?.timezone`. Fallback: `'Europe/Warsaw'`.

### Frontend — `FloorPlanView`

Przyjmuje opcjonalny prop `timezone?: string` (przekazywany przez `DeskMapPage` z `locations` state). Używany w `DeskInfoCard` do formatowania godzin rezerwacji na mapie.

### Frontend — `DeskMapPage` / `DaySlider`

`DeskMapPage` oblicza `activeLocationTz` z `locations.find(l => l.id === locationId)?.timezone` i przekazuje do lokalnego `DaySlider` i `FloorPlanView`. Lokalny `DaySlider` i `todayStr()` akceptują opcjonalny `tz` — fallback: `Intl.DateTimeFormat().resolvedOptions().timeZone`.

### Frontend — `components/ui/DaySlider`

Standalone komponent z opcjonalnym prop `timezone?`. Fallback: timezone przeglądarki.

### Frontend — `ReservationsAdminPage`

Widok admina obejmuje wiele lokalizacji — używa `Intl.DateTimeFormat().resolvedOptions().timeZone` (timezone przeglądarki).

### Frontend — `MyReservationsPage`

`ReservationCard` pobiera `TZ` z `r.desk?.location?.timezone` (zwracanego przez `reservations.service.ts` `findAll`). `bookings` sal pobierają timezone z `b.resource?.location?.timezone` (zwracanego przez `resources.service.ts` `myBookings`).

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

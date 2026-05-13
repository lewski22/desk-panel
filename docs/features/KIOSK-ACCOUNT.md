# Konto techniczne KIOSK

## Cel

Nowa rola `KIOSK` to konto techniczne przeznaczone na urządzenia publiczne
(tablety w biurze, kiosk informacyjny). Dzięki temu staff, OA i SA nie muszą
logować się własnymi poświadczeniami na sprzęcie dostępnym dla wszystkich.

---

## Wymagania funkcjonalne

| # | Wymaganie |
|---|-----------|
| 1 | Nowa wartość enum `UserRole.KIOSK` |
| 2 | Konto KIOSK może zalogować się przez e-mail + hasło **nawet gdy SSO jest wymuszone w organizacji** |
| 3 | SA i OA mogą **tworzyć**, **resetować hasło** i **dezaktywować** konto KIOSK |
| 4 | Po zalogowaniu automatycznie otwiera się widok `/kiosk` z zapisaną lokalizacją |
| 5 | W headerze kiosku pojawia się przycisk **„Ustawienia"** chroniony kodem PIN lokalizacji |
| 6 | Po weryfikacji PIN otwiera się panel: zmiana lokalizacji, piętra, trybu wyświetlania |
| 7 | Konto KIOSK **nie jest widoczne** na liście użytkowników (`GET /users`) |
| 8 | Konto KIOSK **nie może** samodzielnie zmieniać hasła (`changePassword` → 403) |
| 9 | Jedno konto KIOSK na organizację |
| 10 | Refresh token dla KIOSK ważny 30 dni (standardowo 7 dni) |

---

## Architektura — przegląd zmian

```
backend/
  prisma/
    schema.prisma                     ← nowe pole kioskSettings: Json? w User
    migrations/20260513000001_kiosk_role/migration.sql
  src/modules/
    auth/
      auth.service.ts                 ← refresh TTL 30d dla KIOSK; SSO bypass
    kiosk/                            ← NOWY MODUŁ
      kiosk.module.ts
      kiosk.controller.ts
      kiosk.service.ts
      dto/
        create-kiosk-account.dto.ts
        update-kiosk-settings.dto.ts
        update-kiosk-status.dto.ts
    users/
      users.service.ts                ← filtr role ≠ KIOSK w findAll()
    locations/
      locations.controller.ts         ← KIOSK w @Roles dla floors + status

apps/unified/src/
  pages/
    KioskPage.tsx                     ← ładowanie settings; tryb kafelki/mapa
    KioskAccountPage.tsx              ← NOWA strona admina
  components/
    kiosk/
      KioskSettingsPanel.tsx          ← NOWY panel ustawień (PIN-gated)
    floor-plan/
      FloorPlanView.tsx               ← nowy prop activeFloor (controlled mode)
  api/client.ts                       ← sekcja kiosk.*
  types/index.ts                      ← interface KioskSettings, KioskAccount
  locales/pl/translation.json         ← klucze kiosk.settings_* / kiosk.account_*
  locales/en/translation.json
```

---

## Faza A — Backend: Prisma + Auth + KioskModule

### A1. Migracja Prisma

Plik: `backend/prisma/migrations/20260513000001_kiosk_role/migration.sql`

```sql
-- This migration requires no transaction.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'KIOSK';
```

> **KRYTYCZNE:** komentarz w pierwszej linii jest wymagany — PostgreSQL odrzuca
> `ALTER TYPE … ADD VALUE` wewnątrz transakcji. Sprawdź poprzednie migracje enum
> w tym projekcie — używają identycznego wzorca.

### A2. Schema Prisma — nowe pole

W modelu `User` (`backend/prisma/schema.prisma`), po polu `scheduledDeleteAt`:

```prisma
kioskSettings  Json?   // tylko dla role=KIOSK; { locationId, floor, displayMode, columns, refreshInterval }
```

Po edycji: `npx prisma generate` (nie `db push` — migracja SQL już istnieje).

### A3. `auth.service.ts` — refresh token TTL

W metodzie `login()`, przy tworzeniu refresh tokena:

```typescript
const refreshDays = user.role === UserRole.KIOSK ? 30 : 7;
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + refreshDays);
```

### A4. Nowy moduł `kiosk/`

#### `kiosk.service.ts`

| Metoda | Opis |
|--------|------|
| `createAccount(orgId)` | Tworzy konto; email = `kiosk@{slug}.reserti.local`; losowe hasło 20 znaków; domyślne `kioskSettings`; **zwraca plaintextPassword jednorazowo** |
| `resetPassword(orgId)` | Generuje nowe hasło; invaliduje refresh tokeny; **zwraca plaintextPassword jednorazowo** |
| `toggleStatus(orgId, isActive)` | Włącza/wyłącza konto; przy dezaktywacji invaliduje refresh tokeny |
| `getAccount(orgId)` | Zwraca konto bez `passwordHash` |
| `getSettings(userId)` | Zwraca `kioskSettings` |
| `updateSettings(userId, orgId, dto)` | Waliduje `locationId` należy do org; aktualizuje `kioskSettings` |

Domyślna struktura `kioskSettings`:

```json
{
  "locationId": "<first active location>",
  "floor": null,
  "displayMode": "tiles",
  "columns": "auto",
  "refreshInterval": 30
}
```

#### `kiosk.controller.ts`

```
POST   /kiosk/account           → createAccount   @Roles(SA, OA)
GET    /kiosk/account           → getAccount      @Roles(SA, OA)
PATCH  /kiosk/account/password  → resetPassword   @Roles(SA, OA)
PATCH  /kiosk/account/status    → toggleStatus    @Roles(SA, OA)
GET    /kiosk/me/settings       → getSettings     @Roles(KIOSK)
PATCH  /kiosk/me/settings       → updateSettings  @Roles(KIOSK)
```

### A5. Rozszerzenie istniejących endpointów

| Plik | Endpoint | Zmiana |
|------|----------|--------|
| `locations.controller.ts` | `GET /locations/:id/floors` | Dodaj `UserRole.KIOSK` do `@Roles` |
| `locations.controller.ts` | `POST /locations/:id/kiosk/verify-pin` | Dodaj `UserRole.KIOSK` do `@Roles` |
| `desks.controller.ts` | `GET /desks/status/:locationId` | Dodaj `UserRole.KIOSK` do `@Roles` |
| `users.service.ts` | `findAll()` | `where: { role: { not: 'KIOSK' } }` |
| `auth.service.ts` | `changePassword()` | Rzuć `ForbiddenException` jeśli `role === KIOSK` |

---

## Faza B — Frontend: Auth flow + ochrona tras

### B1. Redirect po logowaniu jako KIOSK

Tam, gdzie po `GET /auth/me` ustawiany jest `user`:

```typescript
if (user.role === 'KIOSK') {
  navigate('/kiosk', { replace: true });
  return;
}
```

### B2. Guard tras

Poza `<AppLayout>` — konto KIOSK nie widzi sidebara ani topbara.
Trasa `/kiosk` musi być osobnym wpisem w routerze.

```typescript
if (user?.role === 'KIOSK' && location.pathname !== '/kiosk') {
  return <Navigate to="/kiosk" replace />;
}
```

### B3. Nowe typy (`src/types/index.ts`)

```typescript
export interface KioskSettings {
  locationId:      string;
  floor:           string | null;
  displayMode:     'tiles' | 'map';
  columns:         'auto' | 4 | 6 | 8 | 10;
  refreshInterval: 15 | 30 | 60;
}

export interface KioskAccount {
  id:          string;
  email:       string;
  isActive:    boolean;
  lastLogin:   string | null;
  kioskSettings: KioskSettings | null;
}
```

### B4. `api/client.ts` — sekcja `kiosk`

```typescript
kiosk: {
  createAccount:  () =>
    api.post('/kiosk/account').then(r => r.data),
  getAccount:     () =>
    api.get('/kiosk/account').then(r => r.data),
  resetPassword:  () =>
    api.patch('/kiosk/account/password').then(r => r.data),
  toggleStatus:   (isActive: boolean) =>
    api.patch('/kiosk/account/status', { isActive }).then(r => r.data),
  getSettings:    () =>
    api.get('/kiosk/me/settings').then(r => r.data),
  updateSettings: (dto: KioskSettings) =>
    api.patch('/kiosk/me/settings', dto).then(r => r.data),
},
```

---

## Faza C — KioskPage: Ustawienia + tryb Kafelki z filtrem piętra

### C1. Ładowanie ustawień

```typescript
const [kioskSettings, setKioskSettings] = useState<KioskSettings | null>(null);
const [settingsOpen, setSettingsOpen]   = useState(false);
const isKioskRole = user?.role === 'KIOSK';

useEffect(() => {
  if (!isKioskRole) return;
  appApi.kiosk.getSettings()
    .then(s => setKioskSettings(s))
    .catch(() => {}); // fallback na URL params
}, [isKioskRole]);

// Źródło locationId:
const locationId = kioskSettings?.locationId ?? params.get('location') ?? '';
```

> Istniejący flow przez URL params (`?location=…`) musi działać bez zmian
> dla kont bez roli KIOSK (np. `KioskLinkButton`).

### C2. Filtrowanie biurek po piętrze (tryb Kafelki)

```typescript
const visibleDesks = useMemo(() => {
  if (!kioskSettings?.floor) return desks;
  return desks.filter(d => d.floor === kioskSettings.floor);
}, [desks, kioskSettings?.floor]);
```

### C3. Przycisk „Ustawienia" w headerze

Obok istniejącego przycisku exit (PIN do wyjścia), tylko gdy `isKioskRole`:

```tsx
{isKioskRole && (
  <button
    onClick={() => setPinOpen('settings')}  // rozróżnienie: 'exit' vs 'settings'
    className="text-xs text-zinc-400 hover:text-white transition-colors px-3 py-2
      border border-zinc-700 rounded-xl hover:border-zinc-500 flex items-center gap-1.5"
  >
    ⚙️ {t('kiosk.settings_btn')}
  </button>
)}
```

Flow: klik → modal weryfikacji PIN → po sukcesie `setSettingsOpen(true)`.

Zmodyfikuj `PinModal` (dodaj param `onSuccess`) tak, żeby po weryfikacji
zamiast wylogować — wywołał `onSuccess()`.

### C4. Nowy komponent `KioskSettingsPanel.tsx`

`apps/unified/src/components/kiosk/KioskSettingsPanel.tsx`

```tsx
interface Props {
  current:  KioskSettings;
  onSave:   (updated: KioskSettings) => void;
  onClose:  () => void;
}
```

Sekcje panelu (styl dark, spójny z KioskPage):

```
Lokalizacja  ──  <select> z GET /locations
Piętro       ──  [Wszystkie] [Parter] [1] [2] …  (toggle buttons, GET /locations/:id/floors)
Tryb         ──  [⊞ Kafelki] [🗺 Mapa]
Kolumny      ──  [Auto] [4] [6] [8] [10]  (widoczne tylko dla trybu Kafelki)
Odświeżanie  ──  [15s] [30s] [60s]
             ──  [Anuluj]  [Zapisz]
```

Przy zmianie `locationId` → pobierz nową listę pięter i wyczyść `floor`.

---

## Faza D — KioskPage: tryb Mapy

### D1. `FloorPlanView.tsx` — controlled prop `activeFloor`

```typescript
interface Props {
  // …istniejące…
  activeFloor?: string;   // controlled mode; undefined = stan wewnętrzny
}
```

Gdy `props.activeFloor !== undefined` → ukryj wewnętrzne przyciski wyboru piętra.

```typescript
const [internalFloor, setInternalFloor] = useState<string | null>(null);
const activeFloor = props.activeFloor !== undefined ? props.activeFloor : internalFloor;
```

### D2. `KioskPage.tsx` — renderowanie trybów

```tsx
{kioskSettings?.displayMode !== 'map' && (
  <div className="px-6 py-6">
    {/* istniejący grid kafelków z visibleDesks */}
  </div>
)}

{kioskSettings?.displayMode === 'map' && (
  <div className="flex-1 px-4 py-4">
    <FloorPlanView
      locationId={locationId}
      desks={desks}
      userRole="KIOSK"
      onReserve={undefined}
      activeFloor={kioskSettings.floor ?? undefined}
    />
  </div>
)}
```

---

## Faza E — Panel admina: KioskAccountPage

### E1. `KioskAccountPage.tsx` (lub sekcja w OrganizationsPage)

Dostępna dla: `SUPER_ADMIN`, `OFFICE_ADMIN`.

Stany UI:

| Stan | Widok |
|------|-------|
| Ładowanie | Spinner |
| Brak konta | Przycisk „+ Utwórz konto kiosk" |
| Konto aktywne | Email, status `🟢`, ostatnie logowanie, przyciski Reset hasła / Dezaktywuj |
| Konto nieaktywne | Email, status `🔴`, przycisk Aktywuj |

### E2. Modal jednorazowego hasła

Wyświetlany po `createAccount` i `resetPassword`.

```tsx
<div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full mx-4">
  <p className="text-amber-400 font-semibold mb-3">
    ⚠️ {t('kiosk.account_password_once')}
  </p>
  <div className="flex items-center gap-2 bg-zinc-800 rounded-xl px-3 py-2 mb-4">
    <code className="flex-1 text-white font-mono text-sm">{plaintextPassword}</code>
    <button onClick={() => navigator.clipboard.writeText(plaintextPassword)}>📋</button>
  </div>
  <button onClick={closeModal}>{t('kiosk.account_close')}</button>
</div>
```

---

## i18n — klucze do dodania

Obie lokale: `apps/unified/src/locales/pl/translation.json` i `en/translation.json`,
w sekcji `"kiosk"`:

| Klucz | PL | EN |
|-------|----|----|
| `settings_btn` | Ustawienia | Settings |
| `settings_title` | Ustawienia kiosku | Kiosk settings |
| `settings_location` | Lokalizacja | Location |
| `settings_floor` | Piętro | Floor |
| `settings_floor_all` | Wszystkie piętra | All floors |
| `settings_display_mode` | Tryb wyświetlania | Display mode |
| `settings_mode_tiles` | Kafelki | Tiles |
| `settings_mode_map` | Mapa | Map |
| `settings_columns` | Kolumny siatki | Grid columns |
| `settings_columns_auto` | Auto | Auto |
| `settings_refresh` | Odświeżanie | Refresh |
| `settings_save` | Zapisz | Save |
| `settings_cancel` | Anuluj | Cancel |
| `account_title` | Konto Kiosk | Kiosk Account |
| `account_create` | Utwórz konto kiosk | Create kiosk account |
| `account_reset` | Reset hasła | Reset password |
| `account_deactivate` | Dezaktywuj | Deactivate |
| `account_activate` | Aktywuj | Activate |
| `account_password_once` | Zapisz to hasło — pokazujemy je tylko raz! | Save this password — it will only be shown once! |
| `account_copy` | Kopiuj | Copy |
| `account_close` | Rozumiem, zamknij | Got it, close |

---

## Reguły bezpieczeństwa (obowiązują przez całą implementację)

1. **Konto KIOSK niewidoczne w `GET /users`** — `where: { role: { not: 'KIOSK' } }` w `users.service.ts findAll()`
2. **KIOSK nie zmienia własnego hasła** — `changePassword` → `ForbiddenException` gdy `role === KIOSK`
3. **`POST /kiosk/account` — jedno konto na org** — `ConflictException` jeśli konto już istnieje
4. **Plaintextowe hasło zwracane jednorazowo** — tylko w odpowiedzi na create/resetPassword; nigdy w GET
5. **SSO bypass** — konto KIOSK loguje się wyłącznie przez email+hasło, niezależnie od ustawień SSO organizacji
6. **Każda faza kończy się działającym buildem** — `npx tsc --noEmit` (backend) + `npm run build` (frontend)
7. **Backward compatibility** — istniejący flow `KioskLinkButton` z URL params musi działać bez zmian

---

## Otwarte pytania

- [ ] Czy konto KIOSK powinno być widoczne w logach audytowych?
- [ ] Czy `kioskSettings` (lokalizacja, piętro) powinny być synchronizowane między urządzeniami kiosk tej samej org, czy per-session (localStorage)?
- [ ] Czy dezaktywacja konta KIOSK powinna wylogować aktywne sesje natychmiast przez SSE/WebSocket?

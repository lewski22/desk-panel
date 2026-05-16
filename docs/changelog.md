# Changelog — Reserti Desk Management

> Ostatnia aktualizacja: 2026-05-16 (0.19.5)

---

## [0.20.0] — 2026-05-16 — UI unification sprint, design tokens, org logo + white-label

### Phase A — UI unification (Tabler icons, DS chip-pill, no emoji in JSX)

**`apps/unified/tailwind.config.js`** + **`apps/unified/src/index.css`**
- Zaktualizowano brand: `primary: #B53578`, `hover: #9C2264`, `surface: #FDF4F9`.
- Pliki generowane przez `npm run tokens` z `design/brand.tokens.ts`.

**`apps/unified/src/components/ui.tsx`**
- `EmptyState.icon`: `string` → `React.ReactNode` — wywołania przekazują `<i className="ti ti-X ...">`.

**`apps/unified/src/locales/pl/translation.json`** + **`en/translation.json`**
- Usunięto emoji z kluczy metody rezerwacji: `📡 NFC` → `NFC`, `📷 QR` → `QR`, `✋ Ręczny` → `Ręczny/Manual`.

**`apps/unified/src/components/layout/BottomNav.tsx`**
- `MORE_LINKS`: zmieniono `icon: string` na `tablerIcon: string`; renderowanie przez `<i className="ti ti-X">` zamiast emoji.

**`apps/unified/src/components/reservations/ReservationList.tsx`**
- `METHOD_ICON` mapuje metody na klasy `ti-antenna/ti-qrcode/ti-hand-stop/ti-world`.
- Chip "ALL" i filtry metodą: wzorzec DS chip-pill (`bg-[#FDF4F9] border-[#B53578]` active vs `bg-white border-[#DCD6EA]` inactive).
- Przyciski anulowania i odświeżania: wzorzec `w-7 h-7` icon button z Tabler.

**`apps/unified/src/pages/MyReservationsPage.tsx`**
- Przyciski modala QR, ikony kart, przycisk odświeżania: emoji → Tabler.
- `EmptyState` z `ti-calendar-off`, `ti-building-community`, `ti-parking`.
- Nagłówki sekcji: styl `text-[10px] font-semibold text-[#A898B8] uppercase tracking-[.08em]`.

**`apps/unified/src/pages/ReportsPage.tsx`**
- Wszystkie `EmptyState` emoji → Tabler ReactNode.
- KPI parkingu i nagłówki sekcji: `ti-chart-bar`, `ti-alert-triangle`, `ti-circle-check`, itp.
- Selektor segmentów i pod-zakładki: migrated do wzorca chip-pill DS.
- Dropdown lokalizacji: natywny `<select>` → chip dropdown z `showLocDrop`/`locDropRef` + click-outside handler.

**`apps/unified/src/pages/VisitorsPage.tsx`**
- `STATUS_CFG`: emoji `icon` → `tablerIcon` (`ti-mail`, `ti-building`, `ti-logout`, `ti-x`).
- Akcje wiersza: `opacity-0 group-hover` → zawsze widoczne przyciski `w-7 h-7`.
- Dropdown lokalizacji: natywny `<select>` → chip dropdown.

**`apps/unified/src/pages/QrCheckinPage.tsx`**
- Błąd, piętro, strefa: emoji → ikony `ti-alert-triangle`, `ti-stairs`, `ti-layout-grid`.

**`apps/unified/src/pages/OrganizationsPage.tsx`**
- Footer kart: przyciski tekstowe → ikony `ti-pencil`, `ti-brand-azure`, `ti-antenna`.
- Pasek zakładek modala edycji: emoji → tablerIcons.
- Empty state: `ti-search`, `ti-building`.

---

### Phase B — Design token system

**`design/brand.tokens.ts`** *(nowy plik)*
- Jeden plik źródła prawdy: `BRAND`, `BORDER`, `INK`, `STATUS`, `FONT`, `RADIUS`, `ICON_SIZE`, `ANIMATIONS`, `TAILWIND_COLORS`.

**`design/generate-tokens.ts`** *(nowy plik)*
- Generator uruchamiany przez `npm run tokens` (tsx); regeneruje `tailwind.config.js`, `index.css`, `docs/DESIGN_TOKENS.md`.
- Używa `process.cwd()` jako ROOT (nie `import.meta.url`) — kompatybilny z CJS i ESM.

**`package.json`** (root)
- Dodano `"tokens": "tsx design/generate-tokens.ts"` i `"tsx": "^4.19.2"` w devDependencies.

**`.gitattributes`** *(nowy plik)*
- Oznaczono `tailwind.config.js`, `index.css`, `docs/DESIGN_TOKENS.md` jako `linguist-generated=true`.

**`.github/workflows/check-tokens.yml`** *(nowy plik)*
- CI: weryfikuje że pliki generowane są zsynchronizowane z `brand.tokens.ts`.

**`docs/ai-context.md`**
- Sekcja design system: referencja do `design/brand.tokens.ts`, aktualizacja palety kolorów i ikon.

---

### Phase C — Org logo upload + white-label

**`backend/prisma/schema.prisma`**
- `Organization`: dodano `logoUrl String?`, `logoBgColor String?`, `whitelabelEnabled Boolean @default(false)`.

**`backend/prisma/migrations/20260517000001_org_logo/migration.sql`** *(nowy plik)*
- `ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS ...` dla trzech nowych pól.

**`backend/src/modules/organizations/organizations.controller.ts`**
- `POST /:id/logo` — `@Roles(SUPER_ADMIN, OFFICE_ADMIN)`, walidacja MIME (PNG/SVG/WEBP/JPEG) i rozmiaru (≤ 512 KB).
- `DELETE /:id/logo` — `@Roles(SUPER_ADMIN, OFFICE_ADMIN)`, 204.
- `PATCH /:id/whitelabel` — **`@Roles(OWNER)` wyłącznie**, 204.

**`backend/src/modules/organizations/organizations.service.ts`**
- `uploadLogo()`: zapis do `uploads/logos/`, losowa nazwa hex, usunięcie starego pliku.
- `deleteLogo()`: usuwa plik + nulluje pola DB.
- `setWhitelabel()`: aktualizuje `whitelabelEnabled`.

**`apps/unified/src/api/client.ts`**
- `organizations.findOne(id)` — `GET /organizations/:id`.
- `organizations.uploadLogo(orgId, file, bgColor?)` — raw `fetch` z `FormData` (omija `Content-Type: application/json`).
- `organizations.deleteLogo(orgId)` — `DELETE`.
- `organizations.setWhitelabel(orgId, enabled)` — `PATCH`.

**`apps/unified/src/hooks/useOrgBranding.ts`** *(nowy plik)*
- Interfejs `OrgBranding { name, logoUrl, logoBgColor, whitelabelEnabled }`.
- Fetch z `/organizations/:orgId`; graceful fail dla ról bez dostępu → domyślny branding Reserti.

**`apps/unified/src/components/layout/AppLayout.tsx`**
- Wywołuje `useOrgBranding(user.organizationId)`.
- Logo organizacji wyświetlane gdy `whitelabelEnabled && logoUrl` w 3 miejscach: zwinięty sidebar, rozwinięty sidebar, mobilny topbar.

**`apps/unified/src/pages/OwnerPage.tsx`**
- `handleToggleWhitelabel()` z optimistic update + rollback.
- Nowa kolumna "White-label" (toggle switch) w tabeli organizacji.

**`apps/unified/src/components/org/OrgLogoUpload.tsx`** *(nowy plik)*
- Drop-zone z podglądem, przyciskiem usunięcia, walidacją MIME/rozmiaru po stronie klienta.
- Baner ostrzegawczy gdy `logoUrl && !whitelabelEnabled`.

**`apps/unified/src/pages/OrganizationsPage.tsx`**
- Sekcja `OrgLogoUpload` poniżej `PasswordPolicySection` dla SUPER_ADMIN.

**`apps/unified/src/locales/pl/translation.json`** + **`en/translation.json`**
- Dodano `org.logo.whitelabel_disabled`.

---

## [0.19.5] — 2026-05-16 — Security hardening round 3: SSRF depth, cross-tenant recurring, token leak

### Security — naprawione podatności (audit round 3)

**`backend/src/modules/integrations/providers/webhook-url-guard.ts`** *(nowy plik)*
- Wyekstrahowano `assertPublicWebhookUrl()` do samodzielnego modułu bez zależności NestJS — eliminuje potencjalny import cykliczny między `integrations.service` a `webhook.provider`.
- Rozszerzono SSRF guard o pełne zakresy IPv6: `::` (any), `fc00::/7` (ULA), `fd00::/8` (ULA), `fe80::/10` (link-local), `::ffff:127.x` (IPv4-mapped loopback).
- Zmigrowano `throw new Error(...)` → `throw new BadRequestException(...)` — gwarantuje HTTP 400 zamiast HTTP 500.

**`backend/src/modules/integrations/integrations.service.ts`**
- `upsert()` — dodano SSRF check przy zapisie konfiguracji webhooka (`WEBHOOK_CUSTOM`). Poprzednio guard uruchamiał się wyłącznie przy wysyłce (`_send()`); złośliwy URL mógł być zapisany i odczytany zanim dotarł do dispatch path.

**`backend/src/modules/integrations/providers/webhook.provider.ts`**
- `test()` — zastąpiono wbudowaną walidację (tylko protokół HTTP/HTTPS) przez `assertPublicWebhookUrl()`. Poprzednia implementacja nie blokowała prywatnych adresów IP przy wywołaniu testowym; atakujący mógł ustawić `url=http://169.254.169.254` i wyzwolić SSRF przez przycisk "Test webhook".

**`backend/src/modules/reservations/reservations.service.ts`**
- `cancelRecurring()` — naprawiono duplikat `const groupId` (błąd kompilacji TypeScript). Dodano cross-tenant guard: przed anulowaniem serii sprawdza czy `recurrenceGroupId` należy do org aktora.
- Wszystkie wewnętrzne wywołania `this.cancel()` wewnątrz `cancelRecurring()` przekazują teraz `actorOrgId` — poprzednio endpointem można było anulować indywidualne rezerwacje z obcej org.
- `createRecurring()` — dodano sprawdzenie przynależności `deskId` do org aktora. Parametr `actorOrgId` był akceptowany, ale nigdy nie używany: uwierzytelniony użytkownik mógł tworzyć rezerwacje cykliczne na biurkach innej organizacji.

**`backend/src/modules/auth/auth.controller.ts`**
- `GET /auth/google/callback` — zmieniono redirect z query param `?google_code=` na hash fragment `#google_code=`. Hash nie jest wysyłany do serwerów, nie pojawia się w logach Cloudflare/proxy ani w nagłówku `Referer`.

**`apps/unified/src/pages/LoginPage.tsx`**
- Odczyt exchange code zmieniony z `location.search` na `location.hash.slice(1)` — spójnie z nowym schematem redirectu backendu.

**`apps/unified/src/pages/OrganizationsPage.tsx`**
- Usunięto fallback `?? 'CLIENT_ID'` w legacy Azure SSO modal — literal string trafiał do URL zgody admin OAuth. Gdy `VITE_AZURE_CLIENT_ID` nie jest skonfigurowany, wyświetlane jest ostrzeżenie zamiast uszkodzonego przycisku.

### Jakość kodu

**`backend/src/modules/auth/dto/exchange-google-code.dto.ts`**
- Zacieśniono `@Length(1, 128)` → `@Length(48, 48)` — `randomBytes(24).toString('hex')` generuje dokładnie 48 znaków hex. Poprzedni zakres akceptował arbitralnie krótkie lub długie stringi.

**`backend/tsconfig.json`**
- `noImplicitAny: false` → `true` — wymusza jawne typowanie parametrów funkcji w całym projekcie. Istniejące `as any` i zmienne w blokach `catch` nie są objęte tym wymogiem.

---

## [0.19.4] — 2026-05-16 — Security patch: open redirect, cross-tenant isolation, demo guard

### Security — naprawione podatności (audit 2026-05-16)

**`backend/src/modules/auth/google-auth.service.ts`**
- `_assertSafeRedirectUrl()` — rozszerzono listę zaufanych origins o zmienną środowiskową `ALLOWED_REDIRECT_ORIGINS` (lista rozdzielona przecinkami). Odczyt przez `ConfigService` (spójnie z resztą serwisu).
- Gdy żadne zaufane origin nie jest skonfigurowane, metoda rzuca natychmiast `BadRequestException('OAuth redirect not configured — contact administrator')` zamiast logować ostrzeżenie i kontynuować.
- Komunikat błędu przy próbie open redirect zawiera teraz zablokowane origin: `redirectUrl origin not allowed: https://evil.com`.

**`backend/src/modules/reservations/reservations.controller.ts`**
- `POST /:id/cancel-recurring` — dodano wyznaczenie `actorOrgId` (OWNER → `undefined`, pozostałe role → `organizationId`) i przekazanie do `svc.cancelRecurring()`. Brak tego parametru umożliwiał anulowanie serii rezerwacji z obcej org.

**`backend/src/modules/reservations/reservations.service.ts`**
- `cancelRecurring()` — dodano parametr `actorOrgId?: string` oraz cross-tenant guard: sprawdza przynależność `recurrenceGroupId` do org aktora przed anulowaniem. Guard odpytuje DB tylko gdy `groupId` jest zdefiniowany (uniknięto zbędnego roundtrip przy `scope === 'single'` bez grupy).

**`backend/src/modules/resources/resources.service.ts`** + **`resources.controller.ts`**
- `myBookings()` — dodano filtr `resource.location.organizationId` gdy `actorOrgId` jest obecny. Zabezpiecza przypadek brzegowy przeniesienia użytkownika między organizacjami (stary token → widok cudzych bookingów).

### Jakość kodu

**`backend/src/modules/reservations/reservations.controller.spec.ts`**
- Poprawiono asercje `cancel()`: dodano 4. argument `'org-1'` (actorOrgId) we wszystkich 3 przypadkach testowych — poprzednie testy dawały false-green dla izolacji multi-tenant.
- Poprawiono asercję `findOne()`: `('res-1')` → `('res-1', 'org-1')`.

**`apps/unified/src/components/DemoModeBanner.tsx`**
- Guard produkcyjny przeniesiony z ciała funkcji komponentu na poziom modułu — uruchamia się raz przy imporcie, nie przy każdym renderze.

**`apps/unified/scripts/check-demo-mode.mjs`** *(nowy plik)*
- Wyodrębniony skrypt blokujący build gdy `VITE_DEMO_MODE=true`. Zastąpił inline `node -e "..."` w `package.json` — poprzednia forma była nieczytelna i mogła nie działać na Windows PowerShell.

**`apps/unified/package.json`**
- `build` script: `node scripts/check-demo-mode.mjs && ...` zamiast inline one-liner.

**`backend/.env.example`**
- Dodano `ALLOWED_REDIRECT_ORIGINS=""` z komentarzem po linii `FRONTEND_URL`.

---

## [0.19.3] — 2026-05-15 — Security hardening: SSRF, brute-force, OAuth, type safety

### Security — naprawione podatności

**`backend/src/modules/integrations/providers/webhook.provider.ts`**
- `_send()` — dodano `_assertPublicUrl()` blokujące SSRF: prywatne zakresy IP (`127.x`, `10.x`, `172.16-31.x`, `192.168.x`), link-local i endpoint AWS metadata (`169.254.x`), loopback IPv6 (`::1`), `localhost`, `0.0.0.0`. Każde wywołanie fetch (dispatch + test) przechodzi przez ten check.

**`backend/src/modules/gateways/gateways.controller.ts`**
- `POST /gateway/auth` (HMAC→JWT exchange) — dodano `@Throttle({ default: { ttl: 60_000, limit: 5 } })`. Endpoint bez limitu umożliwiał brute-force sekretu HMAC bramki.

**`backend/src/modules/auth/auth.controller.ts`** + **`dto/exchange-google-code.dto.ts`** *(nowy plik)*
- `POST /auth/google/exchange` — zastąpiono `@Body() body: any` z ręcznym `if (!code)` przez `ExchangeGoogleCodeDto` z `@IsString() @Length(1, 128)`. Walidacja przeniesiona do GlobalValidationPipe.

**`backend/src/modules/locations/dto/upload-floor-plan.dto.ts`**
- `floorPlanUrl` — zmieniono `@IsString()` na `@Matches(/^(https?:\/\/|data:image\/)/)`, odrzuca dowolne stringi niebędące URL-em HTTP/HTTPS ani data URI.

---

### Security — poprzednia sesja (BUG #1–#5)

**`backend/src/modules/auth/google-auth.service.ts`**
- `_assertSafeRedirectUrl()` — walidacja `redirectUrl` sprawdza teraz zarówno `FRONTEND_URL` jak i `ADMIN_URL`; loguje błąd gdy żaden origin nie jest skonfigurowany.

**`backend/src/modules/graph-sync/graph.controller.ts`** + **`graph-sync.module.ts`**
- CSRF state kalendarza Graph przeniesiony z in-memory `Map` (niebezpieczne w środowiskach multi-instance) do `NonceStoreService` (Redis-backed).
- `graph-sync.module.ts` importuje `AuthModule` zamiast duplikować providera `NonceStoreService` — eliminacja dwóch oddzielnych instancji z osobnym stanem.
- Zastąpiono `entry.userId!` jawnym null-checkiem z redirectem na stronę błędu.

**`backend/src/modules/auth/auth.module.ts`**
- `NonceStoreService` dodany do `exports` — umożliwia konsumpcję z `GraphSyncModule` bez duplikowania providera.

**`apps/unified/src/components/integrations/forms/AzureConfigForm.tsx`** + **`AzureStep1Consent.tsx`**
- Usunięto fallback `?? 'AZURE_CLIENT_ID'` — literal string trafiał do URL zgody admin. Gdy `clientId` jest pusty, wyświetlane jest ostrzeżenie zamiast przycisku zgody.

**`apps/teams/scripts/build-manifest.js`** *(nowy plik)* + **`manifest/manifest.example.json`**
- Teams manifest budowany przez skrypt z pliku szablonu `manifest.example.json` (`${VAR}` placeholders). Skrypt waliduje `TEAMS_APP_ID`, `TEAMS_BOT_APP_ID`, `AZURE_CLIENT_ID` i kończy z `process.exit(1)` przy brakach.
- `apps/teams/manifest/manifest.json` dodany do `.gitignore` — hardcoded ID usunięte z VCS.

---

### Refactor — type safety (BUG #8)

**`backend/src/modules/auth/types/jwt-payload.interface.ts`** *(nowy plik)*
- Interfejs `JwtPayload { sub, email, role: UserRole, organizationId: string | null, impersonated?, iat?, exp? }`.

**`backend/src/modules/auth/strategies/jwt.strategy.ts`**
- `validate(payload: any)` → `validate(payload: JwtPayload)`.

**`backend/src/modules/auth/auth.service.ts`**
- Usunięto wszystkie `(user as any).*` — pola istnieją na typie Prisma `User`.

**`backend/src/modules/reservations/reservations.service.ts`**
- `(dto as any).targetUserId` → `dto.targetUserId`; wyekstrahowano zmienną `deskName` z `TODO: backlog #6` na osobnej linii.

---

### Demo mode — nowe fixtures (BUG #13)

**`apps/unified/src/mocks/demoData.ts`**
- `DEMO_RESOURCES` rozszerzono do 8 pozycji (2 sale + 5 miejsc parkingowych LOC1 + 1 LOC2).
- Dodano `DEMO_PARKING_BLOCKS` — 2 aktywne blokady.
- `DEMO_VISITORS` rozszerzono do 4 gości (statusy: INVITED / CHECKED_IN / CANCELLED / CHECKED_OUT).
- Dodano `DEMO_ATTENDANCE` — dane widoku tygodniowego dla 5 osób.

**`apps/unified/src/mocks/demoHandlers.ts`**
- Dodano route `/locations/{id}/attendance` → `DEMO_ATTENDANCE`.
- Dodano route `/resources/{id}/parking-blocks` (anchored regex) → przefiltrowane `DEMO_PARKING_BLOCKS`.

---

## [0.19.2] — 2026-05-14 — Security: org isolation, kiosk PIN, SearchDropdown UX

### Security — naprawione podatności

**`backend/src/modules/notifications/notifications.controller.ts`**
- `GET /notifications/settings` i `PUT /notifications/settings/:type` — usunięto możliwość przekazania `?organizationId=` przez SUPER_ADMIN. Endpoint zawsze używa `req.user.organizationId`. SUPER_ADMIN mógł odczytać i nadpisać ustawienia powiadomień dowolnej organizacji.

**`backend/src/modules/devices/devices.controller.ts`**
- `GET /devices/:id` — dodano `@Roles(SUPER_ADMIN, OFFICE_ADMIN, STAFF)` (endpoint nie miał żadnej roli — każdy zalogowany użytkownik mógł pobrać dane beacona) oraz izolację org przez `assertBelongsToOrg`.
- `POST /devices/provision` — przekazuje `actorOrgId` do serwisu; OFFICE_ADMIN nie może provisionować beacona do lokalizacji innej organizacji.

**`backend/src/modules/devices/devices.service.ts`**
- `provision(dto, actorOrgId?)` — przed rejestracją beacona weryfikuje `gateway → location → organizationId === actorOrgId`. Rzuca `ForbiddenException` przy niezgodności.

**`backend/src/modules/gateways/gateways.controller.ts`**
- `PATCH /gateway/device/:deviceId/heartbeat` — zastąpiono współdzielony nagłówek `x-gateway-provision-key` (jeden klucz dla wszystkich org) przez `GatewayJwtGuard`. Endpoint chroniony tym samym JWT co pozostałe endpointy bramki.

**`backend/src/modules/gateways/gateways.service.ts`**
- `deviceHeartbeat(deviceId, ..., callerGatewayId?)` — weryfikuje `device.gatewayId === callerGatewayId`. Bramka nie może aktualizować statusu beaconów przypisanych do innej bramki.

**`backend/src/modules/insights/insights.controller.ts`**
- `POST /insights/refresh-all` — ograniczono zakres do org aktora (`req.user.organizationId`). OFFICE_ADMIN mógł wyzwolić regenerację insightów dla wszystkich organizacji w systemie.

**`backend/src/modules/insights/insights.service.ts`**
- `cronGenerateAll(orgId?)` — przyjmuje opcjonalny filtr org. Cron dzienny i seed startowy bez parametru (wszystkie org); wywołanie z API z `orgId` aktora.

**`backend/src/modules/visitors/visitors.controller.ts`**
- Poprawiono role check z `'SUPER_ADMIN'` na `'OWNER'` we wszystkich metodach (`findAll`, `invite`, `checkin`, `checkout`, `cancel`). Niespójność z resztą backendu powodowała, że SUPER_ADMIN miał pełny cross-org dostęp do gości.
- Dodano `actorOrgId` do `invite`, `checkin`, `checkout`, `cancel`.

**`backend/src/modules/visitors/visitors.service.ts`**
- Dodano prywatną metodę `assertVisitorInOrg(visitorId, actorOrgId?)` — waliduje `visitor → location → organizationId`.
- `invite` — weryfikuje przynależność lokalizacji do org aktora.
- `checkin`, `checkout`, `cancel` — wywołują `assertVisitorInOrg` przed mutacją.

**`backend/src/modules/desks/desks.controller.ts` / `desks.service.ts`**
- `GET /desks/:id` i `GET /desks/:id/availability` — dodano brakujące `@Roles` + `actorOrgId`.
- `GET /locations/:locationId/desks`, `POST /locations/:locationId/desks`, `DELETE /desks/:id/device` — dodano `actorOrgId`.
- `findAll`, `findOne`, `create`, `getAvailability`, `unassignDevice` — walidacja org w serwisie.

---

### Feature — kiosk PIN per lokalizacja

**`apps/unified/src/pages/KioskAccountPage.tsx`**
- Sekcja zarządzania PIN-em kiosku per lokalizacja: lista aktywnych lokalizacji z polem PIN, przycisk "Ustaw PIN" i "✕ Usuń".
- Input PIN: `type="password"`, filtruje tylko cyfry (`/\D/g`), walidacja regex `/^\d{4,8}$/`.
- Optymistyczny UI z rollbackiem przy błędzie.
- Zamieniono wszystkie `alert()` na `toast()`.

**`apps/unified/src/api/client.ts`**
- Dodano `locations.updateKioskPin(locationId, pin | null)`.

**`backend/src/modules/locations/locations.service.ts`**
- `findAll` i `findOne` — strip `kioskPinHash` z odpowiedzi, eksponują `kioskPinSet: boolean`.
- `update` — obsługuje `kioskPin?: string | null`; hashuje bcrypt lub nulluje.

**`backend/src/modules/kiosk/dto/kiosk-settings.dto.ts`**
- Dodano `@ValidateIf(o => o.floor !== null)` — poprawna obsługa `null` w class-validator.

**`backend/src/modules/kiosk/kiosk.service.ts`**
- Cleanup: `void passwordHash` → `const { passwordHash: _pwd, ...safe }`.

---

### Feature — OrganizationsPage: ukrywanie IoT gdy BEACONS wyłączony

**`apps/unified/src/pages/OrganizationsPage.tsx`**
- `hasBeacons = isEnabled('BEACONS')` — warunkowe renderowanie: przycisk "+ Gateway", zakładka "IoT i WiFi", zawartość zakładki, modal `InstallTokenModal`, licznik bramek w statystykach.
- `useEffect` resetuje `editTab` do `'basic'` gdy `hasBeacons` → `false`.
- Usunięto stary formularz PIN kiosku z zakładki IoT (przeniesiony do `KioskAccountPage`).

---

### UX — GroupDetailPage: SearchDropdown zamiast dual-list

**`apps/unified/src/components/ui/SearchDropdown.tsx`** *(nowy plik)*
- Generyczny `SearchDropdown<T extends { id: string }>` — wyszukiwarka z podpowiedziami (top 5), lokalne filtrowanie, zamykanie po kliknięciu poza komponentem.

**`apps/unified/src/pages/GroupDetailPage.tsx`**
- Rewrite UX: `SearchDropdown` dla użytkowników i parkingów zamiast dual-list modalów.
- Użytkownicy: natychmiastowe API call przy wyborze, lista z avatarem inicjałów i hover-reveal "Usuń".
- Parkingi: zmiany lokalne akumulowane do "Zapisz zmiany" (PUT), toggle `accessMode`, wskaźnik "Niezapisane zmiany".
- Blokady: tabela z `date-fns`, filtr "tylko przyszłe".
- Ładowanie równoległe przez `Promise.all`.

---

### Code review fixes

**`apps/unified/src/components/resources/ParkingQrModal.tsx`**
- Funkcja `esc()` — escape HTML przed wstrzyknięciem do `document.write()` (XSS).
- Fallback błędu QR jako czytelna informacja zamiast ukrytego obrazka.
- Usunięto cast `(import.meta as any).env`.

**`apps/unified/src/types/api.ts`**
- Dodano `location?` do interfejsu `Resource` — usunięcie `as any` w `MyReservationsPage`.

**`apps/unified/src/components/layout/NotificationBell.tsx`**
- Uproszczono catch: usunięto martwy branch `e?.status === 401`.

---

## [0.19.0] — 2026-05-14 — Moduł Parking: grupy, blokady, QR check-in

### Added

- **`ParkingGroup` / `ParkingGroupUser` / `ParkingGroupResource`** — grupy parkingowe org-scoped; użytkownicy przypisani do grupy uzyskują dostęp do miejsc z trybem `GROUP_RESTRICTED` (`parking-groups.service.ts`, `parking-groups.controller.ts`)
- **`ParkingBlock`** — blokady czasowe na konkretne miejsca lub całe grupy; `isBlocked()` sprawdza oba poziomy (`parking-blocks.service.ts`, `parking-blocks.controller.ts`)
- **`accessMode` na `Resource`** — nowe pole `TEXT` (`PUBLIC` | `GROUP_RESTRICTED`); `setAccessMode()` w `ParkingGroupsService` zmienia tryb dostępu pojedynczego miejsca (`parking-groups.service.ts`, `resources.service.ts`)
- **`qrToken` / `qrCheckinEnabled` na `Resource`** — unikalny token UUID generowany automatycznie; `setQrCheckin()` pozwala admin włączyć/wyłączyć QR check-in dla miejsca (`resources.service.ts`, `resources.controller.ts`)
- **`checkedInAt` / `checkedInBy` na `Booking`** — rejestracja momentu i wykonawcy check-in QR (`checkins.service.ts`)
- **`POST /checkins/parking-qr`** — idempotentny check-in przez QR; sprawdza okno grace (`checkinGraceMinutes`), zwraca `alreadyCheckedIn: true` jeśli już zarejestrowany (`checkins.service.ts`, `checkins.controller.ts`)
- **`GET /resources/qr/:token`** — publiczny endpoint (bez auth) zwracający info o miejscu + bieżącą rezerwację dla skanowania QR (`resources.controller.ts`, `resources.service.ts`)
- **`GET /reports/parking`** + **`GET /reports/parking/export`** — raport parkingowy: KPI (total, % QR, no-shows, top spot), wykres dzienny, lista potwierdzonych i niepotwierdzonych rezerwacji, eksport CSV (`reports.service.ts`, `reports.controller.ts`)
- **`maxParkingDaysPerWeek` na `Location`** — opcjonalny limit rezerwacji parkingowych na tydzień per user; egzekwowany przy tworzeniu rezerwacji (`parking-groups.service.ts`)
- **`checkinGraceMinutes` na `Location`** — okno czasowe przed/po rezerwacji w którym QR check-in jest akceptowany (domyślnie 15 min)
- **`ParkingGroupsPage`** — lista grup parkingowych org; create/delete; nawigacja do szczegółów (`ParkingGroupsPage.tsx`)
- **`GroupDetailPage`** — 3 zakładki: Users (dodaj pojedynczego / bulk po emailach, usuń), Parking spots (checkboxy + przełącznik PUBLIC/GROUP_RESTRICTED), Blocks (lista blokad + dodaj blokadę) (`GroupDetailPage.tsx`)
- **`ParkingQrCheckinPage`** — publiczna strona `/parking-checkin/:token`; stany: loading, disabled, login-required, spot-info, confirming, success, error; wibracja przy sukcesie (`ParkingQrCheckinPage.tsx`)
- **`ResourcesPage`** — accessMode badge (🔒 Tylko grupy / 🌐 Publiczny) dla PARKING; toggle QR check-in per miejsce; pole "Notatki" w formularzu edycji; `handleRemove` z obsługą błędu 409 (aktywne rezerwacje) (`ResourcesPage.tsx`)
- **`ReportsPage` — zakładka Parking** — KPI cards, wykres dzienny, tabele confirmed/unconfirmed, eksport CSV z guardem `exporting` (ochrona przed podwójnym kliknięciem) (`ReportsPage.tsx`)
- **`MyReservationsPage`** — przycisk QR wyświetlany tylko dla dzisiejszych rezerwacji parkingowych z włączonym `qrCheckinEnabled` (`MyReservationsPage.tsx`)
- **Nav** — `/parking-groups` w `AppLayout` dla ról SUPER_ADMIN + OFFICE_ADMIN, moduł PARKING (`AppLayout.tsx`)
- **API client** — `appApi.parkingGroups.*` (list, get, create, update, remove, addUser, addUsersBulk, removeUser, setResources, setAccessMode), `appApi.parkingBlocks.*` (list, create, remove), `appApi.checkins.parkingQr()`, `appApi.reports.parking()` / `.parkingExport()` (`client.ts`)
- **i18n** — klucze `parking_groups.*` i `reports.tabs.parking` / `reports.parking.*` (PL + EN)

### Technical

- Migracja `20260515000001_parking_groups_qr` — idempotentna (IF NOT EXISTS / DO $$ BEGIN), directive `-- This migration requires no transaction.`; `accessMode` konwertowany z enum na TEXT jeśli istnieje
- Constraint `Resource_locationId_type_code_key` (trójka) zastępuje stary `Resource_locationId_code_key`
- `resolveOrgId()` zunifikowany — endpoint `GET /reports/export` korzysta teraz z tej samej pomocniczej metody co pozostałe endpointy (fix: SUPER_ADMIN mógł poprzednio podać `orgId` tylko przez `orgId` query, nie przez `resolveOrgId`)
- `safeApiUrl` w `install.controller.ts` — regex zmieniony z blocklist na allowlist `/[^a-zA-Z0-9:/.?=&_-]/g`

### Fixed

- **`install.controller.ts`** — `safeApiUrl` allowlist zamiast blocklist (poprzednia wersja przepuszczała `$`, `` ` ``, `\`, `'`)
- **`reports.controller.ts` export endpoint** — SUPER_ADMIN nie mógł podać `?orgId=` przy eksporcie CSV/XLSX (różna logika niż w pozostałych endpointach); ujednolicono przez `resolveOrgId()`
- **`ReportsPage` ParkingTab** — brak guarda `exporting` na przycisku eksportu (ryzyko podwójnego zapytania)
- **`MyReservationsPage`** — przycisk QR pojawiał się dla przyszłych rezerwacji parkingowych (brak sprawdzenia daty = dzisiaj)

---

## [0.18.0] — 2026-05-13 — Nowy moduł BEACONS: tryb LITE vs FULL dla modułu DESKS

### Added
- **Moduł `BEACONS`** — nowy wpis w systemie `enabledModules`; kontroluje dostęp do całej warstwy IoT (beacony ESP32, bramki Raspberry Pi, NFC check-in, LED, provisioning, OTA) niezależnie od modułu `DESKS` (`useOrgModules.ts`, `owner.controller.ts`)
- **`BEACONS` w `EditOrgModal`** (Owner) — nowy toggle z opisem "Wymagany zakup hardware Reserti", grupowanie modułów w sekcje wizualne (Hardware IoT / Moduły przestrzeni), guard zależności BEACONS→DESKS (`OwnerPage.tsx`)
- **Guard zależności backend** — `setModules(['BEACONS'])` bez `DESKS` rzuca `BadRequestException` (`owner.controller.ts`)
- **`DevicesPage` + `ProvisioningPage` gate** — strony wyświetlają przyjazny komunikat zamiast pustego widoku gdy `!isEnabled('BEACONS')` (`DevicesPage.tsx`, `ProvisioningPage.tsx`)
- **Nav IoT ukryty** gdy `!BEACONS` — `/devices` i `/provisioning` znikają z `AppLayout` i `BottomNav`; `/devices` rozszerzone na role SUPER_ADMIN + OFFICE_ADMIN + STAFF (`AppLayout.tsx`, `BottomNav.tsx`)
- **`DeskMapPage`** — `DeskStats` (live beacon counts) warunkowe pod `hasBeacons` (`DeskMapPage.tsx`)
- **`DesksPage`** — kolumna "Urządzenie" i przycisk "Odepnij" warunkowe pod `hasBeacons` (`DesksPage.tsx`)
- **`DashboardPage`** — KPI "Beacony online" i alert "beacony offline" warunkowe pod `hasBeacons` (`DashboardPage.tsx`)
- **Nowe orgi** tworzone z `enabledModules: ['DESKS']` zamiast `[]` — BEACONS wyłączony domyślnie (`owner.service.ts`)
- **i18n** — klucze `modules.BEACONS.*` i `beacons_gate.*` (PL + EN)
- **Testy** — 3 nowe przypadki w `useOrgModules.test.ts` dla BEACONS

### Technical
- Zero breaking change — istniejące orgi z `enabledModules: []` traktują BEACONS jako aktywny (backward compat)
- `DESKS` pozostaje niezmieniony — kontroluje rezerwacje; `BEACONS` kontroluje wyłącznie hardware IoT
- Nowe orgi mają `enabledModules: ['DESKS']` jako default — BEACONS wymaga ręcznego włączenia przez Owner

---

## [0.17.9] — 2026-05-13 — Fix: MyReservationsPage dla wszystkich ról

### Fixed
- **`/my-reservations` ukryte dla org bez modułu DESKS** — usunięto `module: 'DESKS'` z nav item "Moje rezerwacje" w `AppLayout.tsx` i `BottomNav.tsx`; link jest teraz zawsze widoczny dla zalogowanych użytkowników (moje rezerwacje to funkcja konta, nie modułu)
- **Sekcje sal i parkingów niewidoczne dla SUPER_ADMIN** — `MyReservationsPage` teraz pokazuje sekcję sal/parkingów gdy: użytkownik ma rezerwacje danego typu LUB rola to SUPER_ADMIN/OWNER; pustostany wyświetlane zamiast ukrywania sekcji
- **`findMy` zwracał przeszłe rezerwacje** — dodano filtr `date >= dziś` gdy brak parametru `date`; lista domyślnie pokazuje tylko nadchodzące/bieżące (`reservations.service.ts`)

### Added
- **Puste stany** dla sekcji sal i parkingów na `MyReservationsPage` (widoczne dla SA/OWNER nawet bez rezerwacji)
- **i18n** — klucze `my_reservations.rooms_*`, `my_reservations.parking_*`, `my_reservations.all_day`, `my_reservations.past` (PL + EN)

---

## [0.17.12] — 2026-05-12 — NFC Card Scan Flow + Beacon Boot Fix

### Fixed

- **NFC scan session nigdy nie odbierała karty** — gateway przerywał przetwarzanie skanów bez rezerwacji przed forwarding do backendu (`gateway.py _handle_checkin`). Karty niezarejestrowane (dokładnie te potrzebne przy dodawaniu przez panel admina) nigdy nie trafiały do `NfcScanService.notifyScan()`. Fix: gateway zawsze forwerduje skan do backendu w osobnym wątku, niezależnie od lokalnego cache rezerwacji.

- **MQTT packet size za mały na beaconie** — `PubSubClient` domyślny limit 256 bajtów był przekraczany przez payload checkin (UUID event_id + CUID device_id + CUID desk_id + card_uid + timestamp). `publish()` zwracał `false` po cichu, skan trafiał do offline queue. Heartbeat działał bo jest krótszy. Fix: `_client.setBufferSize(512)` w `MqttService::begin()` (`mqtt_service.cpp`).

- **`/checkins/nfc` używał przestarzałego auth** — endpoint sprawdzał nagłówek `x-gateway-secret`, podczas gdy gateway wysyła `Authorization: Bearer <jwt>` (JWT auth). Fix: zamieniono ręczną weryfikację sekretu na `@UseGuards(GatewayJwtGuard)`; `JwtModule` dodany do exports `GatewaysModule`.

- **Gateway wysyłał snake_case do backendu** — payload beacona używa `card_uid`/`desk_id`, backend `NfcCheckinDto` wymaga `cardUid`/`deskId`. `ValidationPipe` z `transform: true` nie konwertuje automatycznie snake→camel. Fix: jawne mapowanie kluczy w `forward_checkin()`.

- **Gateway wysyłał dodatkowe pola odrzucane przez ValidationPipe** — `gatewayId` i `deviceId` nie są zdefiniowane w `NfcCheckinDto`; `whitelist: true` zwracał 400. Fix: wysyłanie tylko `deskId` + `cardUid`.

- **Beacon WiFi — race condition przy starcie** — `wifi.begin()` jest non-blocking. Natychmiast po wywołaniu `wifi.isConnected()` zwracał `false`, stan był ustawiany na ERROR, MQTT próbował się połączyć bez WiFi. Fix: 15-sekundowa pętla blokująca po `wifi.begin()`, polling co 200ms z resetem watchdoga (`main.cpp`).

- **`urllib` bez User-Agent blokowany przez GitHub CDN** — gateway pobierał assety OTA przez `urllib.request.urlopen` bez nagłówka `User-Agent`; GitHub redirect na `release-assets.githubusercontent.com` zwracał 404. Fix: `urllib.request.Request` z `User-Agent: desk-gateway/<version>` dla pobierania manifestu i pliku.

### Added

- **`NfcCardModal` — DirtyGuard przy zamknięciu** — przypadkowe kliknięcie poza modalem zamykało okno podczas aktywnego skanowania lub wprowadzania UID. Teraz w trybach `scanning`, `manual` i `done` pojawia się `DirtyGuardDialog` z potwierdzeniem (`NfcCardModal.tsx`).

---

## [0.17.11] — 2026-05-12 — Gateway OTA Pipeline

### Added

- **OTA release tooling** — `scripts/ota_release.py` z komendami `genkey` (Ed25519 keypair) i `sign` (podpisanie manifestu). Nowa para kluczy, klucz publiczny zaktualizowany w `gateway.py`.
- **`.gitignore`** dla `desk-gateway-python` — chroni `scripts/ota_private.pem` i `scripts/ota_manifest.json` przed commitem.

### Fixed

- **Beacon WiFi boot** — dodane blokujące oczekiwanie 15s po `wifi.begin()` (`main.cpp`).
- **Gateway OTA User-Agent** — `urllib` teraz wysyła `User-Agent` przy pobieraniu manifestu i `gateway.py` z GitHub releases.

---

## [0.17.10] — 2026-05-08 — Code Review Cleanup

### Fixed

- **`ResourceModal` prop** (`ResourcesPage.tsx`) — `resource?: any` → `resource?: Resource`; TS type narrowing teraz poprawnie w całym modal flow
- **`modal` state** (`ResourcesPage.tsx`) — `useState<'create' | any | null>` → `useState<'create' | Resource | null>`; `| any` pochłaniało union, efektywnie wyłączając typowanie

---

## [0.17.9] — 2026-05-07 — Password Policy, KioskLinkButton, Demo Fixtures

### Added
- **Polityka haseł (Zadanie 6 / #16)** — pełna implementacja:
  - Nowe pola DB: `User.mustChangePassword Boolean @default(false)`, `User.passwordChangedAt DateTime?`, `Organization.passwordExpiryDays Int?`; migracja `20260507000002_password_policy`
  - `_checkPasswordExpiry()` wywołana w `login()` i `getMe()` — automatycznie ustawia `mustChangePassword=true` gdy minęło `passwordExpiryDays` dni od ostatniej zmiany hasła (z wykluczeniem kont SSO)
  - `changePassword()` zapisuje `passwordChangedAt = now()` i zeruje `mustChangePassword`
  - Cron `@Cron('0 7 * * *', { name: 'check-password-expiry' })` w `subscriptions.service.ts` — codziennie o 07:00 bulk-aktualizuje użytkowników z wygasłym hasłem
  - **Trzy endpointy force-reset:**
    - `POST /api/v1/organizations/:id/force-password-reset` — SUPER_ADMIN własnej org + OWNER
    - `POST /api/v1/owner/organizations/:id/force-password-reset` — OWNER, per org
    - `POST /api/v1/owner/force-password-reset` — OWNER, cała platforma
  - `MustChangePasswordGate` w `App.tsx` — redirect na `/change-password` jeśli `mustChangePassword=true`, z wyjątkami dla `/change-password` i `/login`
  - `OwnerPage`: przycisk "🔐 Reset haseł" per org + "🔐 Reset haseł (wszystkie)" w toolbarze
  - `EditOrgModal` w `OwnerPage`: pole `passwordExpiryDays` (1–365 dni lub brak rotacji)
  - Walidacja DTO: `@ValidateIf(o => o.passwordExpiryDays !== null)` + `@IsInt() @Min(1) @Max(365)` — poprawna obsługa `null` przez `@IsOptional()`
- **KioskLinkButton w OrganizationsPage (Zadanie 4 / #11)** — import `KioskLinkButton`, przycisk w sekcji Actions lokalizacji, nowe klucze i18n `kiosk.open_btn` / `kiosk.open_btn_short` w `pl` i `en`
- **Demo fixtures (Zadanie 5 / #12)** — `demoData.ts`: `DEMO_RESOURCES`, `DEMO_VISITORS`, `DEMO_REPORT_CHECKINS_BY_DAY`, `DEMO_REPORT_PER_DESK`, `DEMO_REPORT_PER_USER`, `DEMO_REPORT_METHODS`; `demoHandlers.ts`: stubs dla zasobów, odwiedzających, raportów szczegółowych, floor-plan (null), SMTP, provisioning, beacons + stubs dla 3 endpointów force-password-reset
- **`organizations.update()` whitelist pól** — zmiana z `data: dto` na jawną listę pól (`name`, `plan`, `isActive`) — eliminacja potencjalnego mass-assignment

### Security
- `_assertSameOrg()` w `OrganizationsController` — SUPER_ADMIN i OFFICE_ADMIN ograniczeni do własnej org w endpoincie force-password-reset (OWNER przechodzi bez filtra); osobna od `_assertOrgAccess()` która pozostaje szersza (SSO endpoints)
- Wykluczenie roli `OWNER` z force-reset przez jawny whitelist `role: { in: ['END_USER', 'STAFF', 'OFFICE_ADMIN', 'SUPER_ADMIN'] }` we wszystkich trzech serwisach
- `_checkPasswordExpiry()` w `getMe()` — gate nie do ominięcia przez odświeżenie strony (poprzednio sprawdzał tylko flagę DB, nie przeliczał dat)

---

## [0.17.8] — 2026-05-07 — Custom Amenities per Organization

### Added
- **`customAmenities` field on Organization model** — `String[] @default([])` przechowuje słownik tagów wyposażenia per tenant; idempotentna migracja (`schema.prisma`, `migration.sql`)
- **`GET /organizations/me/amenities`** — zwraca listę własnych tagów (OFFICE_ADMIN + własna org); **`PUT /organizations/me/amenities`** — zastępuje listę, walidacja: max 50 tagów, max 40 znaków, dedup + trim + lowercase (`organizations.service.ts`, `organizations.controller.ts`)
- **Dynamiczne amenities w `ResourceModal`** — zamiast hardkodowanej listy `PRESET_AMENITIES` + custom tagi org; pole tekstowe + "Enter" pozwala dodać nowy tag (fire-and-forget persist do org dictionary) (`ResourcesPage.tsx`)
- **Sekcja zarządzania słownikiem wyposażenia** w `OrganizationsPage` — widoczna dla OFFICE_ADMIN; lista tagów z możliwością usunięcia, input do dodawania (`OrganizationsPage.tsx`)
- **Rozszerzone `AMENITY_ICONS`** w `ResourceCard` — nowe ikony: coffee ☕, espresso ☕, piano 🎹, xbox 🎮, standing 🧍, sofa 🛋️, outdoor 🌿, printer 🖨️, scanner 🖷, ethernet 🔌 (`ResourceCard.tsx`)
- **API client** — `organizations.getAmenities()` i `organizations.updateAmenities()` (`client.ts`)
- **i18n klucze** `resource.form.amenity_placeholder/add/custom` i `org.amenities.title/description/empty/placeholder` w `pl` i `en` (`translation.json`)

---

## [0.17.7] — 2026-05-06 — ROOM Module: Security & UX Improvements

### Security
- **`assertResourceInOrg` guard** — wszystkie endpointy zasobów (`getAvailability`, `createBooking`, `cancelBooking`, `findOne`) weryfikują teraz przynależność zasobu do organizacji aktora; eliminuje cross-tenant access (`resources.service.ts`)
- **`findAll` z filtrem org** — zapytanie list zasobów ograniczone do zasobów org aktora (`resources.service.ts`)

### Fixed
- **UTC bug w `BookingModal`** — czas rezerwacji sali budowany przez `localDateTimeISO()` zamiast ręcznego stringa `${date}T${h}:${m}:00.000Z`; rezerwacje w strefach CET/CEST nie były przesunięte (`BookingModal.tsx`)

### Added
- **"Moje rezerwacje sal" w `MyReservationsPage`** — nowa sekcja z listą `Booking[]`, możliwość anulowania; `GET /users/me/bookings` już istniał, brakowało UI (`MyReservationsPage.tsx`, `client.ts`)
- **`nextAvailableSlot`** w odpowiedzi `findAll` — dla sal ACTIVE oblicza pierwszy wolny 30-min slot od teraz; widoczny na `ResourceCard` (`resources.service.ts`, `ResourceCard.tsx`)
- **Filtry sal** w `DeskMapPage` — filtr pojemności (≥4/8/12/20 os.) i amenities (TV, videoconf, whiteboard, projector) + sortowanie alfabetyczne (`DeskMapPage.tsx`)
- **Wizualny label zakresu** podczas wyboru slotów w `BookingModal` — "⏱ Wybierz koniec: od 09:00…" / "📅 09:00 → 10:30" (`BookingModal.tsx`)
- **Informacja o godzinach pracy** lokalizacji w `BookingModal` (`BookingModal.tsx`, `resources.service.ts`)
- **"Rezerwuj dla kogoś"** w `BookingModal` — OFFICE_ADMIN/SUPER_ADMIN mogą wskazać `targetUserId` (`BookingModal.tsx`, `resources.service.ts`, `CreateBookingDto`)
- **Quick Book "⚡ Teraz"** na `ResourceCard` — pre-wypełnia czas start = teraz (zaokrąglony do 30 min) (`ResourceCard.tsx`, `DeskMapPage.tsx`, `BookingModal.tsx`)
- **i18n klucze** dla nowych funkcji w `pl` i `en` (`translation.json`)

---

## [0.17.6] — 2026-04-27 — Walidacje check-in przez web + logika LED RESERVED

### Changed

- **Web check-in zablokowany wcześniej niż 2h przed `startTime`** rezerwacji — `ForbiddenException` z komunikatem (`checkins.service.ts`)
- **LED RESERVED emitowany przy tworzeniu rezerwacji** tylko gdy: dziś jest dzień rezerwacji, godzina >= `openTime` lokalizacji, biurko nie jest aktualnie OCCUPIED (`reservations.service.ts`)
- **`restoreDeskLed` (reconnect beacona)** stosuje tę samą logikę dnia + godziny otwarcia — poprzednio używał lookahead `startTime <= now+1h` (`gateways.service.ts`)
- **Cron co godzinę `autoReservedLed`** — aktywuje RESERVED dla biurek, których rezerwacja "dojrzała" (przyszła rezerwacja osiągnęła swój dzień i godzinę otwarcia); pomija biurka z aktywnym check-in (`gateways.service.ts`)
- **Po checkout i auto-checkout**: zamiast zawsze emitować FREE, sprawdza czy na tym samym biurku jest kolejna widoczna dziś rezerwacja i emituje RESERVED/GUEST_RESERVED jeśli tak (`checkins.service.ts`)

### Added

- Helper `_isReservationVisibleNow(startTime, openTime, timezone)` — logika widoczności rezerwacji w strefie czasowej biura (`reservations.service.ts`)
- Helper `_deskLedAfterFree(deskId)` — zwraca właściwy stan LED po zwolnieniu biurka (`RESERVED` / `GUEST_RESERVED` / `FREE`) (`checkins.service.ts`)

---

## [0.17.5] — 2026-04-26 — Floor Plan Portal + Notifications List + Reservations Redesign

### Added

- **`DeskInfoCard` w portalu (`createPortal`)** — rozwiązuje clipping w scrollującym kontenerze (`FloorPlanView.tsx`)
- **Mobile bottom sheet vs desktop popover** — pozycjonowanie względem viewport (DOMRect) (`FloorPlanView.tsx`, `DeskPin.tsx`)
- **Nowa zakładka "Moje powiadomienia"** jako domyślna w `NotificationsPage` (`NotificationsPage.tsx`)
- **Redesign karty rezerwacji** — kolorowy pasek statusu, pigułka czasu, usunięcie swipe gesture (`MyReservationsPage.tsx`)
- **Historia rezerwacji zwijana** (toggle "Pokaż wszystkie / Zwiń") (`MyReservationsPage.tsx`)

### Fixed

- **Pinch-to-zoom** — natywne listenery `{ passive: false }` zamiast React props (React rejestruje passive domyślnie, `preventDefault` był ignorowany) (`FloorPlanView.tsx`)
- **`isMobile` odświeżany przy resize okna** — poprzednio liczony raz przy renderze (`FloorPlanView.tsx`)
- **`my-reservations` dostępne dla SUPER_ADMIN i OFFICE_ADMIN** (`AppLayout.tsx`, `BottomNav.tsx`)
- **`unreadCount` badge** nie aktualizował się po oznaczeniu jako przeczytane — `onUnreadChange` callback do `NotificationsList` (`NotificationsPage.tsx`)
- **Przycisk usuń powiadomienie (`×`) niewidoczny na mobile** — `sm:opacity-0 sm:group-hover:opacity-100` (`NotificationsPage.tsx`)
- **`NotificationsList` brak stanu błędu** — silently renderował empty state przy błędzie API (`NotificationsPage.tsx`)
- **`NotificationBell` polling** 30s → 15s + `visibilitychange` refresh przy powrocie z tła (`NotificationBell.tsx`)
- **`isPinching` ref** — martwy kod usunięty (`FloorPlanView.tsx`)
- **Hardcoded polskie stringi** w toggle historii → i18n keys (`MyReservationsPage.tsx`, `locales/*/translation.json`)

---

## [0.17.4] — 2026-04-25 — Bugfix Sprint + UX Mapy + Date Picker

### Fixed (krytyczne K1–K6)

| # | Opis | Plik(i) |
|---|------|---------|
| K1 | QR bez PWA → pętla odświeżania | `QrCheckinPage.tsx`, `LoginPage.tsx` — `sessionStorage` returnTo |
| K2 | Web check-in niemożliwy dla rezerwacji przez web | `checkins.service.ts` — akceptuje CONFIRMED, method=WEB, dedup |
| K3 | Walidacja godzin błędna na kolejny dzień | `reservations.service.ts` — `Intl.DateTimeFormat` + timezone |
| K4 | Przyszłe rezerwacje widoczne jako zajęte dziś | `desks.service.ts` — filtr `date` + `startTime: { lte: now }` |
| K5 | PWA modal pod mapą | `ReservationModal.tsx` — `createPortal(modal, document.body)` |
| K6 | Zaproszony user nie pojawia się na liście | `UsersPage.tsx` — `load()` po invite |

### Fixed (regresje)

- R1 — STAFF dostęp do raportów (routing + nawigacja + `reports.controller.ts`)
- R2 — STAFF miał brak mapy biurek (naprawione przy R1)

### Added (nowe UX)

- Wybór daty na mapie: `GET /locations/:id/desks/status?date=YYYY-MM-DD`, date picker w `DeskMapPage.tsx`, amber banner dla nie-dzisiejszej daty
- N-F1: Domyślne biuro z localStorage (`user_default_location_{userId}`) + przycisk "Domyślne"
- N-F2: Własne rezerwacje w kolorze violet (`'mine'` status) na mapie (`DeskPin.tsx`)
- N-F3: `DeskStats` wydzielony nad mapę (niezależny od viewMode)
- N-F4: Floor + zone w tooltipie `DeskPin`
- N-F5: `/weekly` ukryte z nawigacji END_USER
- N-F7: Zoom controls (−/+/Reset) + Ctrl+scroll w `FloorPlanView`
- N-F8: `TimePicker` — dropdown godziny/minuty co 10 min (`components/ui/TimePicker.tsx`)
- N-F9: `useDirtyGuard` hook + `DirtyGuardDialog` (infrastruktura)

### Changed (zmiany wymagań)

- W1: STAFF widzi raporty (backend guard + routing + nav)
- W2: END_USER nie widzi nazw przy rezerwacjach cudzych (`desks.service.ts` `actorRole` masking)
- W3: END_USER nie widzi statystyk (`DeskMap.tsx`)

### Added (i18n)

`reservations.desks`, `deskmap.set_default`, `dirty_guard.*`, `dashboard.legend.mine` (pl + en)

---

## [0.17.3] — 2026-04-23 — UX Fixes + Rejestracja + Demo Mode + Code Review

### Fixed

| # | Obszar | Opis | Plik |
|---|--------|------|------|
| #1 | MAP | Przycisk "Rezerwuj" nie działał | `DeskMap.tsx` — dodano `onQuickBook` |
| #2 | MAP | Popup biurka — zła pozycja | `FloorPlanView.tsx` — `popupStyle()` w pikselach |
| #3 | REZERWACJE | Check-in widoczny po check-inie | `MyReservationsPage.tsx` — optimistic update |
| #4 | DASHBOARD | Brak danych mimo check-inów | `client.ts` — fix URL `/analytics/extended` |
| #5 | SUPER ADMIN | Błąd wyboru firmy przy dodawaniu biura | `OrganizationsPage.tsx` — pre-fill własna org |
| #6 | MOBILE | Mapa nie znika przy zmianie zakładki | `AppLayout.tsx` — scroll reset |
| #7 | USER | Mapa jako widok domyślny | `DeskMapPage.tsx` — END_USER → `'plan'` |
| #8 | DASHBOARD | Czytelność na telefonie | `DashboardPage.tsx` — mobile breakpoints |
| #9 | UI | Kolory statusów pod mapą | `FloorPlanView.tsx` Legend, `DeskInfoCard` |
| #10 | I18N | Brak klucza `layout.nav.integrations` | dodano do pl/en |
| #11 | BIURO | Obsługa biur wielopiętrowych (frontend) | `FloorPlanEditorPage.tsx` — zakładki + "Dodaj piętro" |
| #12 | RBAC | OFFICE_ADMIN nie mógł wejść w powiadomienia | `App.tsx` guard + backend settings endpoint |
| #13 | PROVISIONING | Biały ekran w zakładce Provisioning | `GatewaySection` — brak `useTranslation()` |

### Fixed (Code Review)

| # | Problem | Plik | Zmiana |
|---|---------|------|--------|
| 1 | Race condition refresh tokena | `client.ts` | Singleton `_refreshPromise` |
| 2 | `getMe()` spam na visibilitychange | `App.tsx` | Debounce 2000ms |
| 3 | Timezone-unsafe date parsing | `MyReservationsPage.tsx` | `parseISO` z date-fns |
| 4 | QR kody przez zewnętrzny serwis | `DesksPage.tsx` | Lokalna biblioteka `qrcode` |
| 5 | Brakujące indeksy DB | `schema.prisma` + migracja | `@@index([deskId, date, status])`, `@@index([deskId, checkedOutAt])` |
| 6 | Silent catch handlers (10x) | Wiele stron | `.catch((e) => console.error(...))` |
| 7 | `scrollTo 'instant'` | `AppLayout.tsx` | → `'auto'` |

Migracja: `20260423000001_add_perf_indexes`

### Added

- Flow rejestracji przez zaproszenie: `POST /auth/invite` + `POST /auth/register` + `RegisterPage.tsx`
- Demo mode: `VITE_DEMO_MODE=true`, `demoData.ts`, `demoHandlers.ts`, `DemoModeBanner.tsx`
- KioskPage: zegar 1s, kolor "zajęte" → `text-red-400`, grid `md:grid-cols-5 2xl:grid-cols-10`

---

## [0.17.2] — 2026-04-22 — Lucide Icons + i18n Audit + Floor Plan Multi-floor + PWA Kiosk

### Added

**Multi-floor plan support (backend)**
- Nowy model `LocationFloorPlan` — każde piętro ma osobny plan (url, wymiary, gridSize)
- Migracja `20260421000001_location_floor_plans` (CREATE TABLE IF NOT EXISTS + unikalne `locationId+floor`)
- `GET /locations/:id/floors` → lista nazw pięter z wgranymy planami
- `GET/POST /locations/:id/floor-plan?floor=` — obsługa per-piętro; bez `?floor` backward-compat z `Location`
- `POST /locations/:id/floor-plan/delete?floor=` — usuwanie planu per-piętro
- Backward compatibility: stary `Location.floorPlanUrl` działa bez zmian gdy `?floor` nie jest podany

**PWA KioskPage — install button (Option A)**
- Przechwytywanie `beforeinstallprompt` (zachowane `preventDefault()`) → `installEvt` state
- Przycisk „Install PWA" / „Zainstaluj PWA" w nagłówku kiosku — widoczny tylko gdy przeglądarka udostępnia event
- Klucze i18n: `kiosk.install_btn` (pl + en)

**Ikony — Lucide React**
- `SidebarIcons.tsx` przepisany: re-eksportuje z `lucide-react` pod identycznymi nazwami (`IconFloorPlan`, `IconCalendar`, `IconDesk` itd.) — zero zmian w konsumentach
- `lucide-react ^0.468.0` dodany do `package.json`

### Fixed / Improved

**FloorPlanEditor — position sync**
- Biurka przestały wracać do poprzedniego układu po zapisie planu (`to_fix_2.md #16`)
- Dodany `useEffect` w `FloorPlanEditor`: gdy `!state.isDirty` wywołuje `reset(freshPositions)` przy zmianie props `desks` / `floor`
- Rozwiązanie: `useReducer` initial state nie reagował na zmianę props — `useEffect` + `reset()` to naprawia

**i18n audit — 100% pokrycie**
- `ChangePasswordModal.tsx` — przepisany z 0% na 100% (używał hardkodowanych stringów PL)
- `AppLayout.tsx` — `ROLE_LABEL` constant usunięty → `t(\`roles.${user.role}\`, user.role)` (dynamic key + raw fallback); banery subskrypcji przetłumaczone (`layout.subscription_*`)
- `OrganizationsPage.tsx` — wszystkie etykiety formularza biura przetłumaczone (`organizations.form.*`)
- `DevicesPage.tsx` — nagłówki tabel beaconów i gatewayów: `t('devices.table.*')`
- Nowe klucze dodane do obu plików (pl + en): `devices.table.{status, hardware_id, firmware, rssi, ip}`, `layout.{subscription_expired_msg, subscription_renew, subscription_expiring_msg, subscription_details}`, `changePassword.errors.generic`, `organizations.form.*` (14 kluczy), `kiosk.install_btn`

---

## [0.17.1] — 2026-04-21 — Security Fixes + Status Colors + Brand Token

### Security (NAPRAWIONE)

- **Privilege escalation** (`to_fix_2.md #13a`) — każdy użytkownik mógł wysłać `targetUserId` w POST `/reservations` i rezerwować biurko dla dowolnej osoby. Naprawka: `reservations.service.ts` sprawdza rolę aktora przed użyciem `targetUserId`
- **IDOR** (`to_fix_2.md #13b`) — OFFICE_ADMIN mógł tworzyć lokalizacje w obcej organizacji. Naprawka: `locations.controller.ts` nadpisuje `organizationId` z JWT dla ról < SUPER_ADMIN/OWNER

### Changed

- **Status colors** — spójne we wszystkich komponentach (DeskPin, DeskToken, DeskCard, KioskPage, DashboardPage): `#10b981` wolne / `#f59e0b` zarezerwowane / `#ef4444` zajęte / `#a1a1aa` offline
- **Brand token** — jeden token (`--brand: #9C2264`) w `index.css` i `tailwind.config.js`; klasy `bg-brand` / `text-brand` / `hover:bg-brand-hover` używane wszędzie

---

## [0.17.0] — 2026-04-19 — Teams Bot + Graph Sync + Integracje + AI Insights

### Added

**Teams App (`apps/teams/`)**
- Samodzielna aplikacja React jako personal tab w Microsoft Teams
- `BookPage`, `HomePage`, `MyBookingsPage` — pełny flow rezerwacji biurka w Teams
- `teamsAuth.ts` — SSO przez Teams SDK (tokeny Entra ID bez ponownego logowania)
- `manifest.json` v1.1.0 — personal tabs + bot commands + messaging extensions

**Teams Bot Framework**
- `TeamsBotService` (extends `TeamsActivityHandler`) — komendy DM: `book`, `reservations`, `cancel <id>`, `help`
- `TeamsBotController` — `POST /bot/messages` (endpoint Azure Bot Service, `@SkipThrottle`)
- Adaptive Cards: formularz rezerwacji, lista rezerwacji, confirmacja, błąd
- Messaging Extensions: `/book` i `/reservations` przez `composeExtension/fetchTask`
- Dodano pakiet `botbuilder ^4.23.3` do backendu

**Microsoft Graph Calendar Sync (dwukierunkowa)**
- `GraphSyncModule` — przechowywanie tokenów OAuth2, sync kalendarza Outlook ↔ Reserti
- Webhook notifications dla zmian czasowych rezerwacji (Outlook → Reserti)
- Retry 1× po 1s przy przejściowych błędach Graph API
- Sprawdzanie konfliktów przed nadpisaniem czasu rezerwacji ze zmiany Outlook

**Integrations module** (per-org)
- `IntegrationsModule` z dostawcami: Slack, Teams, Webhook, Azure AD, Google Workspace
- `IntegrationsPage.tsx` — włącz/wyłącz/konfiguruj każdą integrację
- Szyfrowanie konfiguracji OAuth AES-256-GCM (`integration-crypto.service.ts`)
- Formularze: `SlackConfigForm`, `TeamsConfigForm`, `WebhookConfigForm`, `AzureConfigForm`, `GoogleConfigForm`

**AI Recommendations (Sprint K1)**
- `RecommendationBanner.tsx` — podpowiedzi optymalnego biurka na podstawie historii
- `RecommendationsService` + `GET /recommendations` (ranking według scoring)

**Utilization Insights (Sprint K2)**
- `InsightsWidget.tsx` — wyświetla insighty zajętości (`PEAK_DAY`, `UNDERUTILIZED_ZONE`, `GHOST_DESKS`)
- `InsightsService` z cron job (codzienne obliczanie)
- `GET /insights` — lista insightów dla org/lokalizacji

**Web Push Notifications (VAPID)**
- `PushService` — inicjalizacja `web-push` z kluczami VAPID z env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `generate-vapid-keys.js` — skrypt pomocniczy do jednorazowego wygenerowania kluczy
- Automatyczne usuwanie wygasłych endpointów push

**Auth — `GET /auth/me`**
- Nowy endpoint zwracający świeże dane użytkownika + `enabledModules` bez ponownego logowania
- Frontend (`App.tsx`) odświeża stan po każdym zamontowaniu aplikacji

**Monitoring**
- `monitoring/` — Docker Compose z Prometheus + Grafana
- 4 dashboardy Grafana: `desk-analytics`, `fleet-overview`, `iot-health`, `system-health`

**Owner Panel — Plan Templates**
- Tabela `PlanTemplate` w bazie (starter/trial/pro/enterprise) z edytowalnymi limitami
- Zakładka „Szablony planów" w OwnerPage — edycja limitów biurek, użytkowników, bramek, lokalizacji, flagi OTA/SSO/SMTP/API
- Picker planu przy tworzeniu nowej organizacji

**UI**
- `KioskLinkButton.tsx` — przycisk generowania linku do kiosku na stronie organizacji
- `EntraIdSection.tsx` — sekcja konfiguracji Entra ID w IntegrationsPage
- `ChangePasswordModal.tsx` — zmiana hasła dostępna z sidebara (dla użytkowników bez SSO)
- `CalendarSyncSection.tsx` + `GraphConnectButton.tsx` — UI połączenia kalendarza Microsoft Graph
- `NotificationRulesPage.tsx` — konfiguracja reguł powiadomień in-app

---

### Changed

- **AppLayout.tsx** — dodano właściwość `module` do nav items (DESKS, ROOMS, WEEKLY_VIEW), dzięki czemu filtr `hasModule()` faktycznie działa; poprawiono layout sidebara w trybie collapsed desktop
- **Graph Sync** — `_syncEventToReservation()` sprawdza konflikty na tym samym biurku przed zaktualizowaniem czasu; dodano retry 1× na błędy przejściowe
- **OwnerPage.tsx** — dialog tworzenia org z pickerem planu; nowa zakładka PlanTemplatesTab
- **Azure + Google auth services** — uproszczona logika JIT provisioning
- **NotificationsPage.tsx** — używa `appApi.notifications.getSettings/getLog/saveSettings/testSmtp` (poprzednio brak wsparcia dla org-level settings)
- **Subscriptions service** — wymuszanie limitów planu przy przydzielaniu planu do org

---

### Fixed

- **NotificationBell** — wywoływał `appApi.inapp.*` (nieistniejąca przestrzeń nazw) zamiast `appApi.notifications.*`; powodowało to ciche błędy i brak powiadomień
- **Widoczność modułów** — nav items nie miały ustawionej właściwości `module`, więc pozycje jak `/map` czy `/resources` były zawsze widoczne, nawet gdy moduł był wyłączony przez OWNER
- **Stale enabledModules** — po wyłączeniu modułu przez OWNER zalogowani użytkownicy dalej widzieli moduł do czasu ponownego logowania (naprawione przez `GET /auth/me` przy każdym mount)
- **DevicesPage** — crash gdy `api.devices.list()` zwracało nie-tablicę
- **Floor plan toolbar** — błędy CORS i limitu rozmiaru body przy wgrywaniu planu piętra
- **InAppNotifType migration** — enum tworzony bez `IF NOT EXISTS`, powodujący błąd przy retry migracji (`20260419000001_fix_notiftype_to_text`)
- **botbuilder npm package** — zła nazwa pakietu `@microsoft/botbuilder` (nie istnieje w npm registry) → poprawiono na `botbuilder ^4.23.3`; Docker build kończył się błędem E404

---

## [0.12.0] — 2026-04-17 — Sprinty A–B + naprawa Prisma

### Sprinty zrealizowane

**Sprint A — UI Quick Wins** (`67cbef9`)
- Dashboard: KPI cards z trendem ↑↓%, Quick Actions strip, Today's Issues widget
- Mapa biurek: Location Tabs z live occupancy (kolor <70%/70-89%/≥90%), avatary inicjały
- Tabele: sortowanie URL state (`useSortable`), bulk cancel rezerwacji, OTA progress bar
- Nawigacja: sidebar z grupami (WORKSPACE/ZARZĄDZANIE/ANALITYKA/KONFIGURACJA/OPERATOR)
- Nowe komponenty: `EmptyState`, `TrendBadge`, `SortHeader`

**Sprint D — Floor Plan Editor** (`6276f47`)
- Schema: `Desk.posX/posY/rotation/width/height`, `Location.floorPlanUrl/W/H/gridSize`
- Backend: `PATCH /desks/batch-positions`, `GET|POST /locations/:id/floor-plan`
- Frontend: `useFloorPlanEditor` (reducer: MOVE/ROTATE/UNDO/REDO), `DeskToken` (drag+touch),
  `FloorPlanCanvas`, `FloorPlanToolbar`, `FloorPlanEditor`, `FloorPlanEditorPage`
- Widok: `DeskPin` + `FloorPlanView` (readonly, DeskInfoCard popup), toggle Plan/Karty

**Sprint E — Weekly View + Sale/Parking** (`b2ff6c0`)
- Backend: `getAttendance(locationId, week)` — ISO week, Checkin + Reservation aggregate
- Frontend: `WeeklyViewPage` — siatka 5×N, nawigator tygodnia, KPI, search
- Schema: `Resource` + `Booking` (ROOM/PARKING/EQUIPMENT, conflict detection co 30 min)
- Frontend: `ResourceCard`, `BookingModal` (slot picker), `ResourcesPage` (admin CRUD)
- DeskMapPage: zakładki `[🪑 Biurka] [🏛 Sale] [🅿️ Parking]`

**Owner: Module Management** (`d275d18`)
- Schema: `Organization.enabledModules String[]` ([] = wszystkie aktywne)
- Backend: `PATCH /owner/organizations/:id/modules`, whitelist walidacja
- Frontend: `EditOrgModal` z 5 toggle switches (DESKS/ROOMS/PARKING/FLOOR_PLAN/WEEKLY_VIEW)
- Guards: DeskMapPage tabs, AppLayout nav, ResourcesPage redirect
- Hook: `useOrgModules()` — `isEnabled(AppModule)`
- `login()` zwraca `enabledModules` w odpowiedzi

**Sprint G — Recurring + PWA Push** (`467c053`)
- Schema: `Reservation.recurrenceRule/recurrenceGroupId`, `PushSubscription`
- Backend: `createRecurring()` z RRULE parserem (bez bibliotek), `cancelRecurring(scope)`
- Frontend: `RecurringToggle` — preset buttons + custom builder + preview dat
- Backend: `PushService` (dynamic import web-push, graceful fallback), `PushController`
- Frontend: `PushOptIn` (compact + card mode, Web Push API)

**Sprint H — Mobile UX** (`467c053`)
- `BottomNav.tsx` — 4 przyciski mobile, badge aktywnych rezerwacji, safe-area-inset
- `KioskPage.tsx` — `/kiosk?location=&pin=`, fullscreen, auto-refresh 30s, NumPad PIN exit

**Sprint H2 — Swipe Gestures** (`ead8e05`)
- `useSwipe.ts` hook (zero bibliotek), touch events z threshold + drift detection
- `MyReservationsPage` z swipe-left → reveal Anuluj (iOS Mail pattern), real-time translateX

**Sprint I — Vitest Tests** (`ead8e05`)
- Konfiguracja: Vitest + @testing-library/react + jsdom + coverage
- `src/__tests__/setup.ts` — mocki i18n/router/localStorage/appApi
- 48 testów: ui.test, useFloorPlanEditor.test, useOrgModules.test, useSortable.test, UsageBar.test

**Sprint J — Visitor Management** (`ead8e05`)
- Schema: `Visitor` (INVITED→CHECKED_IN→CHECKED_OUT, qrToken unique)
- Backend: `VisitorsService` + 6 endpointów (invite, checkin, checkinByQr, checkout, cancel)
- Frontend: `VisitorsPage` — KPI row, tabela hover-reveal, `InviteModal`, route `/visitors`

**Sprint B — Subscriptions** (`b2b85f4`)
- Schema: `Organization` +7 pól billing/limits, `SubscriptionEvent`, InAppNotifType +4 wartości
- Backend: `SubscriptionsService` — `PLAN_LIMITS` stała, `getStatus()`, `getDashboard()`
- Crony: `checkExpiringSubscriptions()` (0 8 * * *) + `checkResourceLimits()` (0 */6 * * *)
- Frontend: `PlanBadge`, `UsageBar` (semantic color), `SubscriptionPage`
- `ExpiryBanner` w AppLayout — polling co 5min, dismiss localStorage
- OwnerPage: zakładki `[🏢 Firmy] [💳 Subskrypcje]`, MRR KPI, `SubPlanModal` z historią

### Naprawa migracji Prisma (`a78fa0d`, `b047d02`, `d97b4ad`)

**Problemy zdiagnozowane:**
- Duplikat folderu `20260417000004` (dwa foldery z tym samym numerem — P3009)
- `COMMIT; ALTER TYPE; BEGIN;` trick — zostawia migrację w stanie failed przy retry
- `DO $$ BEGIN ALTER TYPE ... END $$` — nie działa w transakcji PostgreSQL
- `CREATE TYPE/TABLE` bez `IF NOT EXISTS` — fail przy idempotentnym retry

**Rozwiązanie:**
- 6 osobnych migracji sprintów zastąpiono jedną: `20260417000001_sprints_schema`
- `-- This migration requires no transaction.` jako pierwsza linia przy ALTER TYPE
- Wszystkie `CREATE TYPE` w `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`
- Wszystkie `CREATE TABLE` z `IF NOT EXISTS`
- `ON CONFLICT DO NOTHING` dla lookup table inserts
- `entrypoint.sh` z auto-resolve failed migrations (UPDATE SET rolled_back_at)

---

## [0.11.0] — 2026-04-15 — i18n + PWA + Testy + OTA + Notyfikacje

- i18n PL/EN — 427 kluczy, 100% pokrycie, 0 `alert()` w kodzie produkcyjnym
- PWA: manifest, service worker (Workbox), ikony SVG, skróty, offline cache
- Testy: 178 (P1 64 unit + P2 63 gateway + P3 51 integration)
- OTA firmware: 4 fazy — GitHub Actions CI, status tracking, org isolation, panel trigger
- Powiadomienia email: 8 typów, SMTP per org AES-256-GCM, deduplikacja
- Powiadomienia in-app: dzwoneczek, reguły per rola, ogłoszenia OWNER

---

## [0.10.1] — 2026-04-07 — Code Review Fixes + Security

- 10+ security fixes: multi-tenant isolation, org guards, MQTT ACL
- LED event bus: LedEventsService (rxjs Subject, zero circular dep)
- Auto-assign NFC: 60s listening session dla UNAUTHORIZED_SCAN
- Limity rezerwacji: maxDaysAhead, maxHoursPerDay per lokalizacja
- Rotacja kluczy gateway: 15-minutowe okno nakładki (stary + nowy klucz)
- `prisma migrate deploy` zamiast `db push` (baseline migration `20260407000000_init`)

---

## [0.10.0] — 2026-04-07 — LED Flow + Mobile

- LED event bus: circular dependency fix przez SharedModule @Global
- QR check-in: timezone fix, walkin + checkin z rezerwacji
- Mobile: hamburger sidebar drawer, session warning (5min timeout)
- Date utils: `localDateStr()`, `localDateTimeISO()` (lokalna strefa, nie UTC)

---

## [0.9.0] — 2026-04-01 — Unified Panel

- `apps/unified/` — scalenie admin/staff/owner ról w jednej aplikacji
- MyReservationsPage, ChangePasswordPage, DeskMapPage z location picker
- Owner Panel: impersonacja, stats per org, health

---

## [0.8.0] — 2026-03-31 — Gateway Python + Provisioning

- `desk-gateway-python`: Cache, SyncService, MqttBridge, DeviceMonitor, MqttAdmin
- Gateway provisioning: tokeny jednorazowe (24h) + InstallController + bash script

---

## [0.7.0] — 2026-03-15 — Entra ID SSO

- Azure JWKS validation, JIT provisioning, `AzureConfigModal`

---

## [0.6.0] — 2026-03-01 — Owner Panel

- `OwnerModule`: CRUD org, impersonacja (JWT 30min), stats, health

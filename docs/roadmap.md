# Roadmap — Reserti Desk Management System

## Aktualny stan (v0.8.0 — 2026-03-31)

✅ Firmware ESP32 (NFC + LED + offline queue)  
✅ Gateway per-biuro (Python, systemd, auto-install)  
✅ Backend NestJS (REST API + MQTT + PostgreSQL)  
✅ Panel Admin (biurka, użytkownicy, provisioning, raporty)  
✅ Panel Staff (mapa zajętości)  
✅ Panel Owner (klienci, health, statystyki, impersonacja)  
✅ M1 — Entra ID SSO (Admin + Staff + Outlook Add-in)  
✅ M3 — Outlook Add-in  
✅ Deploy: Proxmox LXC + Coolify + Cloudflare Tunnel  
✅ P1-P3 — code review, rate limiting, enum, vite-env, indeksy  

---

## Planowane — P2

## Panel OWNER — Plan implementacji

> Owner = poziom ponad SUPER_ADMIN. To operator platformy Reserti (Ty).
> Zarządza wszystkimi klientami (firmami), ich stanem technicznym i kontami.
> Ostatnia aktualizacja: 2026-03-31

---

### Czym jest Owner vs SUPER_ADMIN

| | SUPER_ADMIN | OWNER |
|---|---|---|
| Kim jest | Admin konkretnej firmy-klienta | Operator platformy Reserti |
| Widzi | Jedną organizację (swoją) | Wszystkie organizacje |
| Tworzy | Biura, biurka, użytkowników w swojej org | Nowe firmy-klientów, przypisuje SUPER_ADMIN |
| Widzi urządzenia | Swoje gateway i beacony | Wszystkich klientów — pełny monitoring |
| Billing | Nie ma dostępu | Zarządza planami i płatnościami |
| Domena | admin.prohalw2026.ovh | owner.prohalw2026.ovh (nowa) |

Owner **nie ingeruje** w dane firmy bez powodu — tylko podgląd techniczny i zarządzanie strukturą.

---

### Architektura dostępu

```
OWNER (ty)
  │  owner.prohalw2026.ovh
  │  osobny frontend — nie Admin Panel
  ▼
Backend NestJS
  /owner/*  ← nowy prefix, guard OwnersGuard
  │
  ├── GET /owner/organizations        ← lista wszystkich firm
  ├── POST /owner/organizations       ← utwórz nową firmę
  ├── GET /owner/organizations/:id    ← szczegóły firmy
  ├── PATCH /owner/organizations/:id  ← edytuj (plan, isActive)
  ├── GET /owner/health               ← stan wszystkich gateway i beaconów
  ├── GET /owner/health/:orgId        ← stan gateway/beaconów jednej firmy
  └── GET /owner/stats                ← metryki platformy
```

---

### Nowa rola w Prisma schema

```prisma
enum UserRole {
  OWNER        // ← NOWE — operator platformy
  SUPER_ADMIN  // admin firmy-klienta
  OFFICE_ADMIN
  STAFF
  END_USER
}
```

OWNER to rola przypisywana ręcznie w bazie — nie przez żaden UI.
W produkcji: jeden lub kilka kont z tą rolą.

---

### Nowe pola w Organization

```prisma
model Organization {
  // istniejące pola...

  // NOWE:
  plan           String    @default("starter")  // starter | pro | enterprise
  planExpiresAt  DateTime?                       // null = bezterminowy
  isActive       Boolean   @default(true)        // false = dostęp zablokowany
  trialEndsAt    DateTime?                       // okres próbny
  notes          String?                         // notatki wewnętrzne Ownera
  contactEmail   String?                         // główny kontakt techniczny
  createdBy      String?                         // userId Ownera który stworzył
}
```

---

### Nowy moduł backend: `OwnerModule`

```
src/modules/owner/
  owner.module.ts
  owner.controller.ts      ← @Controller('owner'), @UseGuards(OwnerGuard)
  owner.service.ts
  owner-health.service.ts  ← agregacja stanu gateway i beaconów
  guards/
    owner.guard.ts         ← sprawdza role === OWNER (nie RolesGuard)
  dto/
    create-organization.dto.ts
    update-organization.dto.ts
```

#### `owner.controller.ts` — endpointy

```
GET  /owner/organizations
  → lista wszystkich firm z metrykami (liczba biur, biurek, gateway online/offline)
  → filtry: ?isActive=true, ?plan=pro, ?search=nazwaFirmy

POST /owner/organizations
  → tworzy firmę + przypisuje pierwszego SUPER_ADMIN
  → body: { name, slug, plan, contactEmail, adminEmail, adminName }

GET  /owner/organizations/:id
  → pełne dane firmy: biura, gateway, beacony, użytkownicy, ostatnia aktywność

PATCH /owner/organizations/:id
  → edytuje: plan, isActive, planExpiresAt, notes, contactEmail

DELETE /owner/organizations/:id
  → soft delete (isActive=false), nie usuwa danych

GET /owner/health
  → stan wszystkich gateway i beaconów w całym systemie
  → grupowane per organizacja
  → filtr: ?status=offline, ?orgId=xxx

GET /owner/health/:orgId
  → stan gateway i beaconów konkretnej firmy

GET /owner/stats
  → metryki platformy:
     - łączna liczba firm (aktywne / nieaktywne / trial)
     - łączna liczba gateway (online / offline)
     - łączna liczba beaconów (online / offline)
     - liczba check-inów ostatnie 24h / 7 dni
     - firmy które nie miały aktywności > 7 dni (podejrzane)

POST /owner/organizations/:id/impersonate
  → generuje tymczasowy JWT z rolą SUPER_ADMIN dla tej org
  → Owner może wejść w panel klienta bez znajomości hasła
  → token ważny 30 min, logowany w Events
```

---

### Nowy frontend: `apps/owner/`

Osobna aplikacja React pod `owner.prohalw2026.ovh`.
**Nie łączyć z Admin Panel** — inny cel, inne ograniczenia dostępu.

```
apps/owner/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx
    ├── App.tsx                   ← routing, OwnerLayout
    ├── components/
    │   ├── OwnerLayout.tsx       ← sidebar: Klienci | Health | Statystyki
    │   ├── StatusBadge.tsx       ← Online/Offline/Problem z ikoną
    │   ├── OrgCard.tsx           ← karta klienta z key metrics
    │   └── ui.tsx                ← wspólne komponenty (jak w Admin Panel)
    ├── pages/
    │   ├── LoginPage.tsx         ← email/password, tylko OWNER ma dostęp
    │   ├── ClientsPage.tsx       ← lista wszystkich firm
    │   ├── ClientDetailPage.tsx  ← szczegóły firmy: biura, gateway, beacony
    │   ├── NewClientPage.tsx     ← formularz tworzenia nowego klienta
    │   ├── HealthPage.tsx        ← mapa stanu całej infrastruktury
    │   └── StatsPage.tsx         ← metryki platformy + wykresy
    └── api/
        └── client.ts             ← calls do /owner/* endpointów
```

---

### Widoki szczegółowe

#### `ClientsPage.tsx` — lista klientów

Tabela z kolumnami: Firma | Plan | Biura | Gateway (online/total) | Beacony (online/total) | Ostatnia aktywność | Status

Filtry: aktywne / trial / nieaktywne / wszystkie

Akcje per wiersz: Szczegóły | Impersonate | Edytuj plan | Dezaktywuj

#### `ClientDetailPage.tsx` — szczegóły firmy

Cztery sekcje:

1. **Informacje ogólne** — nazwa, plan, daty, kontakt, notatki Ownera
2. **Biura i gateway** — tabela biur z listą gateway per biuro + status Online/Offline/Problem
3. **Beacony** — lista wszystkich beaconów firmy: Hardware ID | Biurko | Gateway | Status | Ostatni heartbeat | RSSI
4. **Aktywność** — ostatnie 20 zdarzeń (check-iny, provisioning, błędy)

Przycisk **"Wejdź jako Admin"** (impersonate) → otwiera panel Admin w nowej karcie z tokenem SUPER_ADMIN tej firmy.

#### `HealthPage.tsx` — monitoring całej infrastruktury

Widok globalny — wszystkie firmy jednocześnie.

Grupy firm z kolorowym wskaźnikiem:
- 🟢 Wszystkie gateway online
- 🟡 Część gateway offline / problem z heartbeat
- 🔴 Wszystkie gateway offline

Dla każdej firmy: liczba beaconów offline, ostatni kontakt gateway.

Filtr: "Pokaż tylko problemy" — ukrywa zdrowe firmy.

Odświeżanie co 30 sekund bez przeładowania strony.

#### `NewClientPage.tsx` — tworzenie klienta

Formularz dwu-krokowy:

**Krok 1 — Dane firmy:**
- Nazwa organizacji
- Slug (auto-generowany z nazwy, edytowalny)
- Plan (starter / pro / enterprise)
- Okres próbny (dni) lub data wygaśnięcia planu
- Email kontaktowy (techniczny)
- Notatki wewnętrzne

**Krok 2 — Pierwszy Super Admin:**
- Imię i nazwisko
- Email (będzie używany do logowania)
- Opcja: wyślij email z zaproszeniem (link do ustawienia hasła)

Po zapisaniu: redirect do `ClientDetailPage` nowej firmy.

---

### Funkcja impersonation (wejście w panel klienta)

Krytyczna funkcja dla supportu i onboardingu.

**Flow:**
```
1. Owner klika "Wejdź jako Admin" przy firmie
2. POST /owner/organizations/:id/impersonate
3. Backend:
   a. Sprawdza role === OWNER
   b. Tworzy Event (typ: OWNER_IMPERSONATION, payload: { ownerId, orgId, ip })
   c. Generuje JWT z rolą SUPER_ADMIN, organizationId=orgId, ważny 30 min
   d. Dodaje flagę impersonated: true do JWT payload
4. Frontend otwiera https://admin.prohalw2026.ovh/auth/impersonate?token=...
5. Admin Panel przyjmuje token, zapisuje w localStorage jako admin_access
6. Owner widzi baner: "Jesteś zalogowany jako SUPER_ADMIN firmy [Nazwa]"
7. Po 30 min lub ręcznym wylogowaniu → powrót do Owner Panel
```

**Bezpieczeństwo:**
- Każda impersonacja logowana w Events
- Token ma flagę `impersonated: true` — nie można przedłużyć
- Admin Panel pokazuje baner z firmą (Owner pamięta gdzie jest)

---

### Guard i middleware

```typescript
// src/modules/owner/guards/owner.guard.ts
@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    return user?.role === 'OWNER';
  }
}
```

Wszystkie endpointy `/owner/*` używają `OwnerGuard` zamiast `RolesGuard`.

---

### Deploy

Nowa aplikacja w Coolify: `front-owner`
- Build: `apps/owner/`
- Domena: `owner.prohalw2026.ovh`
- Cloudflare Tunnel: automatyczny HTTPS

Zmienne środowiskowe:
```env
VITE_API_URL=https://api.prohalw2026.ovh/api/v1
VITE_ADMIN_URL=https://admin.prohalw2026.ovh
```

---

### Kolejność implementacji

| Krok | Co | Czas |
|---|---|---|
| 1 | Schema: rola OWNER + nowe pola Organization | 1h |
| 2 | OwnerGuard + OwnerModule skeleton | 2h |
| 3 | Endpointy CRUD organizacji (`/owner/organizations`) | 4h |
| 4 | Endpoint health (`/owner/health`, `/owner/health/:orgId`) | 3h |
| 5 | Endpoint stats (`/owner/stats`) | 2h |
| 6 | Impersonation (`/owner/.../impersonate` + Admin Panel handler) | 4h |
| 7 | Frontend: scaffold + ClientsPage + NewClientPage | 1 dzień |
| 8 | Frontend: ClientDetailPage + HealthPage | 1 dzień |
| 9 | Frontend: StatsPage + auto-refresh | 0.5 dnia |
| 10 | Deploy Coolify + testy | 0.5 dnia |

**Łącznie: ~4-5 dni roboczych**

---

### Czego NIE robić w Owner Panel

| ❌ Nie | ✅ Zamiast |
|---|---|
| Edytować dane biurek / rezerwacji klienta | Użyj impersonation → Admin Panel |
| Dawać Ownerowi dostępu do hashy haseł | Tylko impersonation token |
| Mieszać Owner UI z Admin Panel | Osobna aplikacja, osobna domena |
| Pozwalać Ownerowi tworzyć rezerwacje za klienta | To rola SUPER_ADMIN po impersonation |



---

## Planowane — P3

### PWA mobilna (End User)

- Tworzenie i anulowanie rezerwacji
- QR check-in (aparat telefonu)
- Podgląd dostępności biurek w czasie rzeczywistym
- Push notyfikacje (via `user/{userId}/event` MQTT → WebSocket → PWA)
- Instalacja jako aplikacja na telefon (service worker)

### OTA aktualizacje firmware

- Serwer OTA: endpoint `GET /firmware/latest` + `GET /firmware/:version/binary`
- Beacon sprawdza wersję przy każdym heartbeat
- Automatyczne pobranie i wgranie przez ESP HTTP OTA
- Rollback po nieudanej aktualizacji

### NFC — wyższy poziom bezpieczeństwa

Aktualnie: UID karty (łatwy do skopiowania)  
Planowane: NDEF challenge-response lub MIFARE DESFire AES

### Monitoring i alerty

- Dashboard Grafana/Prometheus dla metryk gateway
- Alert gdy beacon offline > N minut
- Alert gdy gateway offline
- Weekly raport emailowy do Office Admin

### Integracje

- **Microsoft Entra ID (Azure AD)** — SSO dla użytkowników korporacyjnych
- **Google Workspace** — SSO + import users
- **Slack** — powiadomienia o rezerwacjach i check-inach
- **Webhook API** — zewnętrzne systemy mogą subskrybować eventy

---

## Planowane — P4

### Multi-region

Dla klientów z biurami w różnych krajach:
- Gateway w każdym kraju łączy się z regionalnym MQTT
- Dane rezerwacji replikowane między regionami
- GDPR compliance — dane UE nie opuszczają UE

### Zaawansowana analityka

- Heatmapy zajętości per strefa/piętro
- Predykcja popytu (ML na historii rezerwacji)
- Rekomendacje optymalnego rozmieszczenia biurek
- Eksport raportów do Excel/PDF

### Hardware v2

- Wyświetlacz E-ink (imię rezerwującego + godziny)
- Przycisk fizyczny (check-in bez NFC)
- PoE zamiast USB-C (jedno okablowanie)
- Szyfrowanie NFC (MIFARE DESFire)

---

## Moduł integracji Microsoft 365

### Architektura ogólna

```
Użytkownik (Outlook / Teams)
  │
  ▼
M365 App (Teams Tab + Outlook Add-in)
  │  OAuth2 / Entra ID SSO
  ▼
Reserti Backend (NestJS API)
  │  Microsoft Graph API (sync)
  ▼
Urządzenia (ESP32 beacony)
```

---

### Komponenty

#### 1. Microsoft Teams App

Aplikacja Teams to hostowana aplikacja webowa (React) zarejestrowana w Microsoft
przez plik `manifest.json`. Użytkownik widzi ją jako zakładkę lub panel boczny w Teams.

**Zakres UI:**
- Mapa biura z kolorami odpowiadającymi stanom LED beaconów
- Lista wolnych / zajętych / zarezerwowanych biurek
- Szybka rezerwacja — wybór biurka + godziny
- Check-in przyciskiem (zastępstwo dla NFC przy pracy zdalnej)
- Historia własnych rezerwacji

**Technologia:**
- React (można współdzielić komponenty z istniejącym Staff Panel)
- Teams JS SDK (`@microsoft/teams-js`)
- Manifest `manifest.json` zarejestrowany w Microsoft Teams Admin Center
- Hosting: ten sam Coolify (nowa aplikacja `front-teams`)

#### 2. Outlook Add-in

Dodatek do kalendarza Outlook umożliwia rezerwację biurka bezpośrednio
podczas tworzenia spotkania. Użytkownik nie musi wychodzić z Outlooka.

**Zakres:**
- Panel boczny przy tworzeniu/edycji spotkania
- Wybór biurka z listy (filtracja po wolnych w danym terminie)
- Automatyczne potwierdzenie — biurko rezerwuje się na czas spotkania
- Widok potwierdzenia z detalami biurka

**Technologia:**
- Office Add-in API (Fluent UI React)
- Manifest XML lub JSON zarejestrowany w Microsoft 365 Admin
- Hosting: ten sam Coolify (`front-outlook`)

#### 3. Synchronizacja z Microsoft Graph API

Graph API jest kluczowym elementem integracji. Backend odpytuje Graph w obu kierunkach.

**Pull — backend ← Graph:**
- Pobieranie wydarzeń kalendarza użytkownika (`GET /me/events`)
- Mapowanie event → rezerwacja biurka (po metadanych lub subject)
- Sync co 5 minut lub przez webhook (Graph Change Notification)

**Push — backend → Graph:**
- Tworzenie zdarzenia kalendarza przy rezerwacji przez Teams App
- Anulowanie zdarzenia przy rezygnacji z biurka
- Aktualizacja lokalizacji spotkania (pole `location` w kalendarzu)

**Resource Mailbox (opcjonalnie):**
- Każde biurko jako zasoby Exchange (`desk-a01@firma.pl`)
- Rezerwacja biurka = zaproszenie zasobu do spotkania
- Outlook natywnie obsługuje konflikty zasobów
- Backend subskrybuje zmiany w resource mailboxach przez Graph

#### 4. Autentykacja — Microsoft Entra ID (Azure AD)

Użytkownik loguje się raz przez SSO — ta sama tożsamość w Teams, Outlook i Reserti.

**Flow OAuth2 (Authorization Code + PKCE):**
```
User → Teams/Outlook → Azure AD (logowanie SSO)
  → access token (scope: User.Read, Calendars.ReadWrite)
  → Reserti Backend verifies token
  → mapuje Azure AD objectId / email → User w bazie
```

**Backend changes:**
- Nowa strategia Passport.js: `AzureADStrategy`
- Endpoint `POST /auth/azure` przyjmuje token od Teams/Outlook
- Mapowanie `azureObjectId` → `User.id` w bazie (nowe pole w schema)
- Zachowanie istniejącego JWT flow — Azure auth generuje ten sam JWT

**Prisma schema — nowe pole:**
```prisma
model User {
  // ... istniejące pola
  azureObjectId  String? @unique   // Azure AD object ID
  azureTenantId  String?           // tenant organizacji
}
```

---

### Przepływy danych

#### Rezerwacja przez Teams App

```
1. User otwiera Teams → zakładka "Desk Booking"
2. Teams App wywołuje GET /locations/:id/desks/status
3. User wybiera biurko i godziny → POST /reservations
4. Backend tworzy rezerwację + opcjonalnie wydarzenie w kalendarzu Graph
5. Backend publikuje MQTT: desk/{id}/command SET_LED #0050DC (reserved)
6. Beacon zmienia LED na niebieski
```

#### Rezerwacja przez Outlook

```
1. User tworzy spotkanie w Outlook
2. Outlook Add-in pokazuje panel boczny z wolnymi biurkami
3. User wybiera biurko → Add-in wywołuje POST /reservations
4. Backend tworzy rezerwację
5. Add-in dodaje biurko do pola "Lokalizacja" spotkania
6. (opcjonalnie) Backend zaprasza resource mailbox biurka
```

#### Sync Graph → Backend (webhook)

```
1. Backend rejestruje Graph subscription na kalendarze użytkowników
2. Outlook event tworzony / zmieniany / usuwany
3. Graph wysyła webhook POST /integrations/graph/notify
4. Backend przetwarza: tworzy / aktualizuje / anuluje rezerwację
5. Odpowiedź MQTT do beacona — aktualizacja LED
```

---

### Planowany zakres backendu (nowe moduły)

```
backend/src/modules/
  integrations/
    microsoft/
      microsoft.module.ts
      graph.service.ts          # Graph API client (axios + token refresh)
      graph-webhook.controller.ts  # odbiera notyfikacje Graph
      azure-auth.strategy.ts    # Passport Azure AD strategy
      graph-sync.service.ts     # scheduled sync co 5 min
```

**Nowe endpointy:**
```
POST /auth/azure              ← Teams/Outlook token exchange
POST /integrations/graph/notify  ← Graph webhook receiver
GET  /integrations/graph/status  ← stan synchronizacji
POST /integrations/graph/sync    ← ręczne wymuszenie sync (Admin)
```

---

### Ograniczenia i ryzyka

| Obszar | Ograniczenie | Mitigacja |
|---|---|---|
| Graph API rate limits | 10 000 req/10 min per app | Batching, caching, delta queries |
| Outlook ≠ real-time | Webhook może mieć opóźnienie do 5 min | MQTT pozostaje primary, Outlook jako backup |
| Teams App hosting | Musi być dostępna publicznie (HTTPS) | Już rozwiązane przez Coolify + Cloudflare |
| Resource Mailbox | Wymaga licencji Exchange Online | Opcjonalne — można bez resource mailbox |
| Token refresh | Access token wygasa po 1h | Backend zarządza refresh tokenami Graph |
| Multi-tenant | Każda firma ma osobny tenant | azureTenantId w User model, per-tenant app registration |

---

### Priorytety implementacji

**Faza 1 — Autentykacja SSO (P2)**
- Azure App Registration
- `AzureADStrategy` w Passport.js
- Pole `azureObjectId` w User
- SSO w istniejącym Admin/Staff Panel (opcja logowania przez Microsoft)

**Faza 2 — Teams App (P2)**
- React app z Teams SDK
- Mapa biurek + szybka rezerwacja
- Auth przez Entra ID SSO

**Faza 3 — Graph Sync (P3)**
- `graph.service.ts` — klient Graph API
- Pobieranie wydarzeń kalendarza → tworzenie rezerwacji
- Graph webhook dla real-time sync

**Faza 4 — Outlook Add-in (P3)**
- Office Add-in manifest
- Panel boczny przy tworzeniu spotkania
- Wybór biurka z dostępnością

**Faza 5 — Resource Mailbox (P4)**
- Konfiguracja Exchange resource mailboxes per biurko
- Pełna integracja z natywnym flow Outlooka

---

### Decyzje do podjęcia przed implementacją

1. **Czy firmy korzystają z Microsoft 365?** — integracja wymaga licencji M365/Exchange Online
2. **Single-tenant vs Multi-tenant** — jedna rejestracja aplikacji Azure dla wszystkich firm
   vs osobna per tenant. Multi-tenant wymaga weryfikacji Microsoft (publisher verification)
3. **Resource Mailbox** — wymaga konfiguracji po stronie IT firmy klienta; prostsze
   podejście to tylko Graph Events bez mailboxów
4. **Czy Teams zastępuje Staff Panel?** — jeśli tak, Staff Panel można
   zredukować do wersji mobilnej PWA, a Teams staje się głównym interfejsem użytkownika

---

## Integracja M365 — finalne decyzje i plan implementacji

### Decyzje projektowe

| Obszar | Decyzja | Uzasadnienie |
|---|---|---|
| Licencje | Klient ma M365 | Pełen dostęp do Graph API, Entra ID, Teams, Outlook |
| Rejestracja Azure | Per firma (osobna App Registration) | Prostszy onboarding, izolacja tenantów, brak weryfikacji publishera |
| Główny interfejs | Outlook Add-in | Rezerwacja w momencie planowania spotkania — najwyższa adopcja |
| Resource Mailbox | Opcjonalne | Możliwe bez Exchange resource; Graph Events wystarczy dla MVP |
| MVP scope | SSO + Outlook Add-in + Graph Sync | Bez Teams App w MVP — dodać w P3 |

---

### Architektura MVP

```
Outlook Calendar (Web / Desktop / Mobile)
  │
  ├── Outlook Add-in (panel boczny przy spotkaniu)
  │     │  Entra ID SSO (OAuth2 PKCE)
  │     ▼
  │   Reserti API (/auth/azure, /reservations, /desks)
  │     │
  │     ├── PostgreSQL (rezerwacje, User.azureObjectId)
  │     ├── Graph API → tworzy/aktualizuje event w kalendarzu
  │     └── MQTT → beacon LED (niebieski = reserved)
  │
  └── Graph Webhook (/integrations/graph/notify)
        │  Outlook event zmieniony / usunięty
        ▼
      Reserti API → aktualizuje rezerwację → MQTT → LED
```

---

### Fazy implementacji

#### Faza 1 — Entra ID SSO (tydzień 1)

**Co powstaje:**
- Azure App Registration per firma (skrypt konfiguracyjny)
- `AzureADStrategy` (Passport.js) w backendzie
- Nowe pole `azureObjectId` i `azureTenantId` w tabeli User
- Endpoint `POST /auth/azure` — wymiana tokenu Azure → JWT Reserti
- Logowanie przez Microsoft w istniejącym Admin i Staff Panel (przycisk "Zaloguj przez Microsoft")

**Nowe pliki backend:**
```
src/modules/auth/strategies/azure-ad.strategy.ts
src/modules/auth/dto/azure-auth.dto.ts
```

**Schema change:**
```prisma
model User {
  azureObjectId  String?  @unique
  azureTenantId  String?
}
```

**Azure App Registration — wymagane uprawnienia (API Permissions):**
```
Microsoft Graph (Delegated):
  User.Read              ← profil użytkownika
  Calendars.ReadWrite    ← tworzenie/edycja wydarzeń
  offline_access         ← refresh token
```

---

#### Faza 2 — Outlook Add-in (tydzień 2–3)

**Co powstaje:**
Aplikacja webowa (React + Fluent UI) hostowana na Coolify (`front-outlook`),
zarejestrowana jako Outlook Add-in przez manifest XML.

**Flow użytkownika:**
```
1. User tworzy spotkanie w Outlook
2. Add-in ładuje się w panelu bocznym
3. Logowanie SSO (silent — jeśli już zalogowany przez Teams/Outlook)
4. Add-in pobiera GET /desks/available?date=X&start=HH:MM&end=HH:MM
5. User wybiera biurko z listy (filtr: piętro, strefa)
6. Klik "Zarezerwuj" → POST /reservations
7. Add-in wyświetla potwierdzenie
8. Backend opcjonalnie aktualizuje pole "Lokalizacja" spotkania przez Graph
9. Beacon zmienia LED na niebieski
```

**Nowe pliki frontend:**
```
apps/outlook/
  manifest.xml            ← rejestracja Add-in w M365
  package.json
  vite.config.ts
  src/
    App.tsx               ← główny komponent Add-in
    api/client.ts         ← API calls do Reserti backend
    components/
      DeskPicker.tsx      ← lista biurek z filtrowaniem
      BookingConfirm.tsx  ← potwierdzenie rezerwacji
      SSOLogin.tsx        ← logowanie przez Entra ID
```

**Nowy endpoint backend:**
```
GET /desks/available?locationId=X&date=YYYY-MM-DD&startTime=HH:MM&endTime=HH:MM
```

**Manifest Add-in (kluczowe fragmenty):**
```xml
<OfficeApp Type="MailApp">
  <Hosts><Host Name="Mailbox"/></Hosts>
  <FormSettings>
    <Form xsi:type="ItemEdit">
      <DesktopSettings>
        <SourceLocation DefaultValue="https://outlook.reserti.pl"/>
      </DesktopSettings>
    </Form>
  </FormSettings>
</OfficeApp>
```

---

#### Faza 3 — Graph API Sync (tydzień 4)

**Co powstaje:**
Dwukierunkowa synchronizacja między kalendarzem Outlook a rezerwacjami Reserti.

**Pull — Graph → Reserti (scheduled, co 5 min):**
```
Graph: GET /me/calendarView?startDateTime=X&endDateTime=Y
  → znajdź eventy z rozszerzonym atrybutem "reserti:deskId"
  → utwórz / zaktualizuj / anuluj rezerwację w bazie
```

**Push — Reserti → Graph (na żądanie):**
```
Przy tworzeniu rezerwacji (nie tylko przez Add-in):
  Graph: PATCH /me/events/{eventId}
    → ustaw location.displayName = "Biurko A-01, Piętro 2"
    → dodaj rozszerzony atrybut "reserti:deskId" = "clxxx"
```

**Webhook — Outlook event zmieniony/usunięty:**
```
Graph: POST /subscriptions (rejestracja subskrypcji)
  → callbackUrl: https://api.reserti.pl/integrations/graph/notify
  → changeTypes: created, updated, deleted
  → resource: /me/events

Incoming POST /integrations/graph/notify:
  → znajdź rezerwację po eventId
  → updated → zaktualizuj godziny
  → deleted → anuluj rezerwację → MQTT → LED zielony
```

**Nowe pliki backend:**
```
src/modules/integrations/
  integrations.module.ts
  microsoft/
    graph.service.ts          ← klient Graph API (axios + token cache)
    graph-webhook.controller.ts ← odbiera notyfikacje
    graph-sync.service.ts     ← scheduled task (co 5 min)
    graph-token.service.ts    ← zarządzanie tokenami per user
```

**Nowe tabele Prisma:**
```prisma
model GraphToken {
  id           String   @id @default(cuid())
  userId       String   @unique
  accessToken  String
  refreshToken String
  expiresAt    DateTime
  tenantId     String
  user         User     @relation(...)
}

model GraphSubscription {
  id             String   @id @default(cuid())
  subscriptionId String   @unique  ← ID z Graph API
  userId         String
  expiresAt      DateTime
  resource       String
}
```

---

### Onboarding nowej firmy — checklist

Przy podłączeniu nowego klienta (firma ma M365):

```bash
# 1. Azure App Registration (jeden raz per firma)
#    Azure Portal → App registrations → New registration
#    Redirect URI: https://api.reserti.pl/auth/azure/callback
#    API Permissions: User.Read, Calendars.ReadWrite, offline_access
#    → Skopiuj: Client ID, Client Secret, Tenant ID

# 2. Dodaj do Reserti (Admin Panel → Biura → edytuj)
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_TENANT_ID=...

# 3. Zainstaluj Outlook Add-in w firmie
#    M365 Admin Center → Integrated apps → Deploy add-in
#    Wgraj manifest.xml
#    Assign to: wszyscy lub wybrana grupa

# 4. Opcjonalnie: Resource Mailbox per biurko
#    Exchange Admin → Resources → Add room
#    desk-a01@firma.pl → przypisz do biurka w Reserti
```

---

### Zmiany w istniejącym kodzie

**backend/prisma/schema.prisma:**
- `User`: dodaj `azureObjectId`, `azureTenantId`
- Nowe modele: `GraphToken`, `GraphSubscription`

**backend/src/modules/auth/:**
- `auth.module.ts`: zarejestruj `AzureADStrategy`
- `auth.controller.ts`: nowy endpoint `POST /auth/azure`
- `auth.service.ts`: metoda `loginWithAzure(token, tenantId)`

**backend/src/modules/desks/:**
- `desks.service.ts`: nowa metoda `findAvailable(locationId, date, start, end)`
- `desks.controller.ts`: nowy endpoint `GET /desks/available`

**apps/admin i apps/staff:**
- Przycisk "Zaloguj przez Microsoft" na stronie logowania
- Przekierowanie na `/auth/azure/redirect` (Azure OAuth2 flow)

---

### Ryzyka i mitigacje

| Ryzyko | Mitigacja |
|---|---|
| Graph token wygasa co 1h | GraphTokenService odświeża automatycznie (refresh token) |
| Graph webhook wygasa co 4320 min | Cron job odnawia subskrypcje co 3 dni |
| Graph rate limit (10k req/10min) | Delta queries + cache + batching |
| Add-in nie ładuje się w Outlook Desktop | Testuj na Outlook Web (OWA) — pełne wsparcie gwarantowane |
| Firma wymaga Conditional Access | App Registration musi przejść tenant admin consent |
| Offline (brak internetu) | NFC check-in przez gateway działa niezależnie od M365 |

---

## Zaktualizowana architektura M365 — Single Source of Truth

### Kluczowa zasada

**Backend Reserti = jedyne źródło prawdy. M365 i Teams tylko się synchronizują.**

```
Admin Panel
    │  POST /desks (dodaj biurko)
    ▼
Backend (API + DB)
    │
    ├── PostgreSQL ← source of truth
    ├── MQTT → beacony (LED)
    ├── Graph API → M365 resource mailbox (opcjonalnie, auto)
    └── Teams App ← pobiera GET /desks
```

Zasady:
- Teams App **nie ma własnej bazy biurek** — tylko wyświetla dane z backendu
- Biurka **nie są tworzone ręcznie** w Teams ani Outlook
- Każda zmiana w Admin Panel → automatycznie propaguje do wszystkich warstw

---

### Zrewidowany flow dodawania biurka

Gdy Office Admin doda biurko w panelu:

```
POST /locations/:locId/desks
  { name, code, floor, zone }

Backend wykonuje równolegle:
  1. INSERT do tabeli Desk (PostgreSQL)
  2. (jeśli firma ma M365) Graph API:
       POST /places/microsoft.graph.room
       lub POST /users (resource mailbox)
       → zapisuje m365ResourceId w tabeli Desk
  3. MQTT publish: gateway/+/config (opcjonalnie)

Response:
  { id, name, code, m365ResourceId, mqttUsername, ... }
```

**Nowe pole w schema:**
```prisma
model Desk {
  // ... istniejące pola
  m365ResourceId   String?  // ID zasobu w M365 (room/resource mailbox)
  m365ResourceEmail String? // np. desk-a01@firma.pl
}
```

---

### Zrewidowane priorytety MVP

Na podstawie analizy — **Teams App jako główny UI użytkownika jest prostszym MVP**
niż Outlook Add-in, bo nie wymaga manifest XML i zatwierdzenia przez M365 Admin Center.

**Zmieniona kolejność (względem poprzednich decyzji):**

| Faza | Co | Czas | Dlaczego |
|---|---|---|---|
| **1** | SSO (Entra ID) | tydzień 1 | Fundament — bez tego nic nie działa |
| **2** | Teams App (UI) | tydzień 2–3 | Główny interfejs użytkownika, brak zależności od Exchange |
| **3** | Auto M365 resource przy tworzeniu biurka | tydzień 3 | Backend tworzy resource mailbox automatycznie przez Graph |
| **4** | Outlook Add-in | tydzień 4–5 | Rezerwacja przy tworzeniu spotkania |
| **5** | Graph webhook sync | tydzień 5–6 | Sync zmian z kalendarza → backend |

Decyzja o kolejności Fazy 2 vs 4 zależy od klienta:
- Użytkownicy **żyją w Teams** → zacznij od Fazy 2
- Użytkownicy **żyją w Outlook** → zacznij od Fazy 4

---

### Architektura docelowa (pełna)

```
┌─────────────────────────────────────────────────┐
│                  Admin Panel                    │
│         Biurka / Users / Provisioning           │
└──────────────────────┬──────────────────────────┘
                       │ POST /desks
                       ▼
┌─────────────────────────────────────────────────┐
│              Backend (NestJS API)               │
│                Source of Truth                  │
│  PostgreSQL · MQTT · Graph API · JWT + Azure    │
└──────┬──────────────┬──────────────┬────────────┘
       │              │              │
       ▼              ▼              ▼
┌─────────┐   ┌──────────────┐   ┌──────────────┐
│  Teams  │   │   Outlook    │   │   Beacony    │
│   App   │   │  Add-in +    │   │   ESP32      │
│  (Tab)  │   │  Calendar    │   │   MQTT/LED   │
│         │   │  resource    │   │              │
│GET /desks│  │  mailbox     │   │ SET_LED cmd  │
│POST /res │  │  Graph sync  │   │ heartbeat    │
└─────────┘   └──────────────┘   └──────────────┘
```

---

### Co Teams App wyświetla (dane z backendu)

Teams App = React SPA z Teams SDK. Nie ma własnej bazy. Każdy widok = API call do backendu:

```
GET /locations/:id/desks/status     ← mapa z kolorami (jak Staff Panel)
GET /desks/available?date=X&...     ← wolne biurka na termin
POST /reservations                  ← rezerwacja
PATCH /checkins/:id/checkout        ← zwolnienie biurka
GET /reservations?userId=me         ← moje rezerwacje
```

Komponenty do współdzielenia z istniejącym Staff Panel (React):
- `DeskMap` — mapa zajętości z kolorami LED
- `DeskCard` — karta pojedynczego biurka
- `ReservationList` — lista rezerwacji

---

### Czego NIE robić (anti-patterns)

| ❌ Nie | ✅ Zamiast |
|---|---|
| Trzymać listy biurek w Teams | GET /desks z backendu |
| Tworzyć rezerwacje tylko w Outlook | Backend = master, Outlook = UI |
| Ręczny sync admin → M365 | Auto-create resource przy POST /desks |
| Polegać wyłącznie na Outlook (offline) | NFC + gateway = fallback zawsze działa |
| Osobna baza dla Teams App | Jeden backend, wiele frontendów |

---

## Auto-Provisioning ESP32 przez USB — plan implementacji

### Cel

Zero konfiguracji ręcznej. Admin podłącza ESP32 do komputera, klika jeden przycisk
w panelu admina → firmware wgrywa się automatycznie z predeklarowaną konfiguracją.

### Faza 1 — Web Serial API (bez instalacji czegokolwiek)

Przeglądarki Chrome/Edge obsługują Web Serial API — można pisać na port COM
bezpośrednio z JavaScript w przeglądarce.

**Flow:**
1. Admin Panel → Provisioning → + Nowe biurko → "Flash przez USB"
2. Panel generuje konfigurację (device_id, mqtt_host, mqtt_pass, etc.)
3. Użytkownik klika "Połącz ESP32" → przeglądarka otwiera dialog wyboru portu COM
4. JavaScript wysyła komendę `PROVISION:{...}` przez Web Serial
5. ESP32 odpowiada `PROVISION_OK` → panel pokazuje sukces

**Techniczne:**
- `navigator.serial.requestPort()` — dialog wyboru COM
- `port.open({ baudRate: 115200 })` — otwarcie połączenia
- `writer.write(new TextEncoder().encode('PROVISION:...\n'))` — wysłanie
- Czytanie odpowiedzi przez `reader.read()` — walidacja

**Wymagania:**
- Chrome/Edge 89+ (brak wsparcia Firefox)
- HTTPS (Web Serial wymaga bezpiecznego kontekstu)
- Firmware już wgrany na ESP32 (lub użytkownik robi `pio upload` osobno)

### Faza 2 — Electron desktop app (pełna automatyzacja)

Aplikacja desktopowa `reserti-provisioner`:
1. Wykrywa podłączony ESP32 automatycznie
2. Pobiera config z API panelu (po zalogowaniu)
3. Flashuje firmware (esptool.py w bundlu)
4. Wysyła PROVISION komendę
5. Weryfikuje połączenie z MQTT

**Wymagania:** Electron + node-serialport + esptool.py

### Faza 3 — Dedicated provisioning station

Raspberry Pi z ekranem dotykowym + stałym USB hubem.
Fizycznie podłączasz ESP32 → ekran pokazuje postęp → gotowe.

### Rekomendacja na teraz (MVP)

Zaimplementuj **Faza 1** (Web Serial) — zero instalacji, działa z aktualnym
frontendem React, wystarczy dodać stronę `/provisioning/flash`.

Szacowany czas implementacji: 2-3 dni.

---

## Moduł M365 / Entra ID — Plan implementacji (skonsolidowany)

> Poprzednie sekcje tego pliku zawierają architekturę i decyzje projektowe.
> Ten rozdział to **wykonalny plan pracy** — elementy do zakodowania krok po kroku.
> Ostatnia aktualizacja: 2026-03-31

---

### Zasady fundamentalne (nie zmieniają się)

1. **Backend Reserti = jedyne źródło prawdy.** M365 tylko wyświetla i synchronizuje.
2. **Istniejący JWT flow nie zmienia się.** Azure auth generuje ten sam JWT co email/password.
3. **NFC + gateway działa offline** niezależnie od M365 — to nie może się zepsuć.
4. **Per-firma Enterprise Application w Entra ID** — każda organizacja ma własną
   Enterprise App (nie tylko App Registration). Różnica jest istotna:
   - **App Registration** = definicja aplikacji (Client ID, scopes, redirect URIs)
   - **Enterprise Application** = instancja tej aplikacji w konkretnym tenant Entra ID,
     z pełną kontrolą kto ma dostęp, widocznością w portalu użytkownika (myapps.microsoft.com),
     wsparciem Conditional Access i User Assignment per tenant.
   Każda firma-klient rejestruje Reserti jako Enterprise App w swoim tenant — IT Admin
   zatwierdza uprawnienia i zarządza dostępem bez angażowania Reserti.
5. **Logowanie przez Microsoft jest OPCJONALNE w Fazie 1.** Email/password pozostaje
   aktywne i dostępne równolegle. Są dwa niezależne sposoby logowania:
   - Przycisk "Zaloguj przez Microsoft" → Azure SSO flow
   - Formularz email + hasło → istniejący flow (bez zmian)
   Wyłączenie logowania hasłem dla konkretnej organizacji to oddzielna funkcja,
   planowana na późniejszy etap (np. gdy firma wymaga wymuszenia SSO przez Conditional Access).

---

### Przegląd faz

| Faza | Nazwa | Zależności | Szac. czas |
|---|---|---|---|
| **M1** | Entra ID SSO | brak | 3-4 dni |
| **M2** | Teams App | M1 | 4-5 dni |
| **M3** | Outlook Add-in | M1 | 4-5 dni |
| **M4** | Graph Sync (rezerwacje ↔ kalendarz) | M1 + M2 lub M3 | 5-7 dni |
| **M5** | Auto-tworzenie resource mailbox | M4 | 2-3 dni |

**MVP rekomendowany: M1 + M3** (SSO + Outlook Add-in) — 7-9 dni roboczych.

---

### M1 — Entra ID SSO

**Co robi:** Na stronie logowania pojawia się drugi przycisk "Zaloguj przez Microsoft"
obok istniejącego formularza email/password. Oba sposoby działają równolegle —
użytkownik wybiera który preferuje. Azure SSO generuje ten sam JWT Reserti co
email/password — reszta systemu nie widzi różnicy.

#### Ważne: Enterprise App vs App Registration

W Entra ID są dwa powiązane pojęcia:

| | App Registration | Enterprise Application |
|---|---|---|
| Gdzie | Tenant Reserti (jeden globalny) | Tenant każdego klienta (per firma) |
| Co definiuje | Client ID, scopes, redirect URIs | Kto ma dostęp, Conditional Access, widoczność w myapps.microsoft.com |
| Kto zarządza | Reserti (my) | IT Admin firmy-klienta |
| Consent | Raz, przy rejestracji | Admin consent przy pierwszym użyciu |

**Flow dla nowej firmy:**
1. Reserti ma jedną globalną App Registration (Client ID znany z góry)
2. IT Admin firmy klika "Grant admin consent" w swoim tenant → tworzy Enterprise App
3. Enterprise App daje IT Adminowi pełną kontrolę: kto może się logować, MFA, Conditional Access
4. IT Admin kopiuje Tenant ID do panelu Reserti — gotowe

To oznacza **brak Client Secret per firma** — używamy jednego globalnego Client ID
z Reserti App Registration, a autentykacja odbywa się przez tenant użytkownika.

#### Ważne: SSO jest opcjonalne (Faza 1)

W Fazie 1 logowanie hasłem **pozostaje aktywne** dla wszystkich.
Nie ma żadnej flagi "wymuś SSO" — to planowane na późniejszy etap.

Scenariusze:
- Firma bez M365 → tylko email/password (bez zmian)
- Firma z M365, ale IT Admin nie skonfigurował → tylko email/password
- Firma z M365, IT Admin zatwierdził → oba sposoby dostępne równolegle
- Przyszłość: flaga `ssoRequired: true` w Organization → ukrywa formularz hasła

#### Wymagania (Faza 1)

- Organizacja musi mieć aktywny Microsoft 365 lub Azure AD
- IT Admin firmy zatwierdza consent dla Reserti Enterprise App w swoim tenant
- Użytkownik musi istnieć w Reserti z tym samym emailem **LUB** jest tworzony automatycznie przy pierwszym SSO logowaniu (JIT provisioning)
- Logowanie hasłem pozostaje aktywne i niezmienione

#### Nowe zmienne środowiskowe (backend)

```env
# Globalne — dla Reserti App Registration (jeden dla wszystkich firm)
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  # Client ID Reserti App Registration
AZURE_CLIENT_SECRET=                                   # Client Secret Reserti App Registration
AZURE_REDIRECT_URI=https://api.prohalw2026.ovh/auth/azure/callback
AZURE_SECRET_ENCRYPTION_KEY=32-byte-hex               # szyfrowanie tokenów w DB
```

#### Zmiany w Prisma schema

```prisma
model Organization {
  # NOWE pola:
  azureTenantId      String?   # Tenant ID firmy-klienta (kopiowany przez IT Admina)
  azureEnabled       Boolean   @default(false)  # czy SSO aktywne dla tej org
  # NIE ma azureClientId/Secret per firma — używamy globalnego App Registration
}

model User {
  # NOWE pola:
  azureObjectId      String?   @unique   # Azure AD object ID (oid z tokenu)
  azureTenantId      String?             # tenant użytkownika
}
```

}
```

#### Nowe pliki backend

```
src/modules/auth/strategies/azure-ad.strategy.ts
  - Passport strategy używająca passport-azure-ad (BearerStrategy)
  - Waliduje token od Azure, wyciąga oid + email
  - JIT: jeśli user nie istnieje → tworzy z rolą END_USER

src/modules/auth/dto/azure-login.dto.ts
  - { idToken: string, tenantId: string }

src/modules/auth/azure-auth.service.ts  (nowy)
  - validateAzureToken(idToken, tenantId): sprawdza podpis, mapuje na User
  - getOrCreateUserFromAzure(oid, email, name, tenantId)
  - findOrgByTenantId(tenantId): mapuje tenant → Organization
```

#### Zmiany w istniejących plikach backend

```
src/modules/auth/auth.controller.ts
  + POST /auth/azure          → { idToken, tenantId } → { accessToken, refreshToken, user }
  + GET  /auth/azure/redirect → redirect do Azure OAuth2 login page (dla web flow)
  + GET  /auth/azure/callback → odbiór kodu autoryzacyjnego od Azure

src/modules/auth/auth.module.ts
  + Zarejestruj AzureADStrategy, AzureAuthService

src/modules/organizations/organizations.service.ts
  + updateAzureConfig(orgId, { clientId, clientSecret, tenantId })
  + getAzureConfig(orgId): zwraca config per firma (potrzebny do strategy)
```

#### Zmiany w panelach (Admin + Staff)

```
apps/admin/src/pages/LoginPage.tsx
  + Przycisk "Zaloguj przez Microsoft" (obok email/password)
  + onClick → redirect do GET /auth/azure/redirect

apps/staff/src/pages/LoginPage.tsx
  + To samo

apps/admin/src/pages/OrganizationsPage.tsx
  + Sekcja "Integracja Microsoft 365" przy edycji biura
  + Formularz: Client ID, Tenant ID, Client Secret (masked)
  + Przycisk "Testuj połączenie"

apps/admin/src/api/client.ts
  + adminApi.auth.loginAzure(idToken, tenantId)
  + adminApi.organizations.updateAzureConfig(orgId, config)
```

#### Nowe zależności npm (backend)

```json
"passport-azure-ad": "^4.3.5",
"@azure/msal-node": "^2.6.0",
"jsonwebtoken": "^9.0.0"  // już istnieje
```

#### Testowanie M1

Weryfikacja poprawności przed przejściem do M2:
- [ ] Logowanie przez Microsoft działa na Admin Panel
- [ ] Token Azure → JWT Reserti → auth header działa
- [ ] JIT provisioning: nowy user Azure → automatyczny User w Reserti
- [ ] Istniejący user email/password nadal działa bez zmian
- [ ] azureObjectId zapisany w DB po pierwszym logowaniu

---

### M2 — Teams App

**Co robi:** Zakładka w Microsoft Teams → użytkownik widzi dostępne biurka, rezerwuje, sprawdza swoje rezerwacje. React SPA identyczny ze Staff Panel, dostosowany do okna Teams.

#### Wymagania

- M1 musi działać (SSO przez Teams SDK)
- Nowa aplikacja webowa `apps/teams/` w monorepo
- Zarejestrowana jako Teams App przez manifest (JSON, nowy format)
- Hostowana pod nową domeną `teams.prohalw2026.ovh` w Coolify

#### Nowe pliki (apps/teams/)

```
apps/teams/
  package.json
  vite.config.ts
  tsconfig.json
  manifest/
    manifest.json       ← Teams App manifest (tab + bot konfiguracja)
    color.png           ← ikona 192x192
    outline.png         ← ikona 32x32
  src/
    main.tsx
    App.tsx             ← Teams SDK init + auth silent SSO
    pages/
      HomePage.tsx      ← lista biurek dziś, moje rezerwacje
      BookPage.tsx      ← wybór biurka na konkretny dzień/godzinę
      MyBookingsPage.tsx← moje aktywne rezerwacje + przycisk anulowania
    components/
      TeamsLogin.tsx     ← microsoftTeams.authentication.authenticate()
      DeskGrid.tsx       ← siatka biurek z kolorami statusu
      TimeSlotPicker.tsx ← wybór godziny rezerwacji
    api/client.ts        ← calls do Reserti backend (reużywa logiki Staff)
```

#### Nowe endpointy backend (dla Teams App)

```
GET /desks/available?locationId=X&date=YYYY-MM-DD&startTime=HH:MM&endTime=HH:MM
  → lista biurek wolnych na dany slot czasowy
  → Roles: END_USER+

GET /reservations/my?date=YYYY-MM-DD
  → moje rezerwacje na dany dzień
  → Roles: END_USER+

GET /locations/my
  → lokalizacje do których użytkownik ma dostęp
  → Roles: END_USER+
```

#### manifest.json (Teams App — kluczowe pola)

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.17/MicrosoftTeams.schema.json",
  "manifestVersion": "1.17",
  "id": "AZURE_APP_CLIENT_ID",
  "name": { "short": "Reserti", "full": "Reserti Desk Booking" },
  "staticTabs": [{
    "entityId": "desks",
    "name": "Biurka",
    "contentUrl": "https://teams.prohalw2026.ovh",
    "scopes": ["personal", "team"]
  }],
  "validDomains": ["teams.prohalw2026.ovh", "api.prohalw2026.ovh"],
  "webApplicationInfo": {
    "id": "AZURE_APP_CLIENT_ID",
    "resource": "api://teams.prohalw2026.ovh/AZURE_APP_CLIENT_ID"
  }
}
```

#### Nowe zależności npm (apps/teams)

```json
"@microsoft/teams-js": "^2.22.0",
"@azure/msal-browser": "^3.10.0"
```

---

### M3 — Outlook Add-in

**Co robi:** Panel boczny przy tworzeniu spotkania w Outlook → wybierz biurko → zarezerwuj → informacja pojawia się w polu "Lokalizacja" spotkania.

#### Wymagania

- M1 musi działać
- Nowa aplikacja webowa `apps/outlook/` w monorepo
- Zarejestrowana przez manifest XML (Outlook wymaga XML, nie JSON)
- Hostowana pod `outlook.prohalw2026.ovh`
- Wdrożenie w firmie: M365 Admin Center → Integrated Apps (IT Admin robi raz)

#### Nowe pliki (apps/outlook/)

```
apps/outlook/
  package.json
  vite.config.ts
  manifest.xml          ← Outlook Add-in manifest (wymagany XML)
  src/
    main.tsx
    App.tsx             ← Office.js init
    pages/
      TaskpaneApp.tsx   ← główny widok panelu bocznego
      LoginPage.tsx     ← SSO login jeśli nie zalogowany
    components/
      DeskPicker.tsx    ← lista wolnych biurek z filtrowaniem
      BookingForm.tsx   ← data/godzina z eventów Outlooka (auto-fill)
      BookingSuccess.tsx← potwierdzenie + lokalizacja ustawiona w event
    api/client.ts
    utils/office.ts     ← helpery dla Office.js API (czytaj event subject, dates)
```

#### manifest.xml (kluczowe fragmenty)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  Type="MailApp" Version="1.1">
  <Id>GUID</Id>
  <DisplayName DefaultValue="Reserti Desk Booking"/>
  <Hosts>
    <Host Name="Mailbox"/>
  </Hosts>
  <Requirements>
    <Sets><Set Name="Mailbox" MinVersion="1.3"/></Sets>
  </Requirements>
  <FormSettings>
    <Form xsi:type="ItemEdit">
      <DesktopSettings>
        <SourceLocation DefaultValue="https://outlook.prohalw2026.ovh"/>
        <RequestedHeight>300</RequestedHeight>
      </DesktopSettings>
    </Form>
  </FormSettings>
  <Permissions>ReadWriteItem</Permissions>
</OfficeApp>
```

#### Nowe endpointy backend

```
GET /desks/available
  → ten sam endpoint co dla Teams App (M2)

PATCH /reservations/:id/link-event
  → { outlookEventId: string }
  → zapisuje powiązanie rezerwacji z event Outlook
```

#### Nowe zależności npm (apps/outlook)

```json
"@microsoft/office-js": "^1.1.93",
"@azure/msal-browser": "^3.10.0"
```

---

### M4 — Graph API Sync

**Co robi:** Dwukierunkowa synchronizacja. Reserti → tworzy/aktualizuje event w kalendarzu użytkownika. Outlook → webhook gdy event usunięty → anuluje rezerwację w Reserti.

#### Wymagania

- M1 + M3 muszą działać
- Backend musi przechowywać tokeny OAuth2 per użytkownik (GraphToken)
- Publiczny endpoint dla webhooków Microsoft (HTTPS, weryfikacja podpisów)

#### Nowe tabele Prisma

```prisma
model GraphToken {
  id           String   @id @default(cuid())
  userId       String   @unique
  accessToken  String   @db.Text
  refreshToken String   @db.Text
  expiresAt    DateTime
  tenantId     String
  scopes       String   @default("Calendars.ReadWrite")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model GraphSubscription {
  id              String   @id @default(cuid())
  subscriptionId  String   @unique   # ID z Microsoft Graph API
  userId          String
  resource        String              # np. "/me/events"
  changeTypes     String              # "created,updated,deleted"
  expiresAt       DateTime
  createdAt       DateTime @default(now())
}

model Desk {
  # NOWE pola:
  m365ResourceId    String?   # Graph resource ID
  m365ResourceEmail String?   # np. desk-a01@firma.pl
}

model Reservation {
  # NOWE pole:
  outlookEventId    String?   # powiązany event w Outlook
}
```

#### Nowe pliki backend

```
src/modules/integrations/
  integrations.module.ts

  microsoft/
    graph.service.ts
      - getClient(userId): zwraca axios z aktualnym access tokenem
      - refreshTokenIfNeeded(userId)
      - createCalendarEvent(userId, reservation): POST /me/events
      - updateCalendarEvent(userId, eventId, data): PATCH /me/events/{id}
      - deleteCalendarEvent(userId, eventId): DELETE /me/events/{id}
      - registerWebhook(userId): POST /subscriptions
      - renewWebhooks(): odnawianie wygasających subskrypcji

    graph-token.service.ts
      - saveTokens(userId, tokens)
      - getValidToken(userId): auto-refresh jeśli wygasło
      - revokeTokens(userId)

    graph-sync.service.ts
      - @Cron('0 */5 * * * *') syncUserEvents(): pull z Graph co 5 min
      - @Cron('0 0 */3 * * *') renewWebhooks(): odnów subskrypcje co 3 dni

    graph-webhook.controller.ts
      - POST /integrations/graph/notify
        → walidacja X-Ms-Signature
        → dispatch: created/updated/deleted
        → updated → zaktualizuj godziny rezerwacji
        → deleted → anuluj rezerwację → MQTT SET_LED free
```

#### Zmiany w istniejących plikach

```
src/modules/reservations/reservations.service.ts
  + Po create: jeśli user ma GraphToken → graph.createCalendarEvent()
  + Po cancel: jeśli outlookEventId → graph.deleteCalendarEvent()

src/modules/desks/desks.service.ts
  + POST /desks: jeśli org.azureEnabled → tworzy resource mailbox (M5)
```

#### Nowe zmienne środowiskowe

```env
GRAPH_WEBHOOK_SECRET=random-32-chars  # do walidacji podpisów MS webhooków
```

---

### M5 — Auto resource mailbox

**Co robi:** Gdy Office Admin doda biurko w panelu → backend automatycznie tworzy resource mailbox w Exchange (`desk-a01@firma.pl`) przez Graph API. Rezerwacja biurka = wpis w kalendarzu zasobu.

#### Wymagania

- M4 musi działać
- App Registration musi mieć uprawnienie `Place.ReadWrite.All` (Application, nie Delegated)
- Wymaga Exchange Online w firmie

#### Zmiany

```
src/modules/desks/desks.service.ts
  + _provisionM365Resource(desk, org): POST /places (Graph API)
  + Zapisuje m365ResourceId i m365ResourceEmail w Desk

src/modules/integrations/microsoft/graph.service.ts
  + createRoomResource(name, email, capacity, floor)
  + deleteRoomResource(resourceId)
```

---

### Onboarding klienta — checklist

Gdy nowa firma chce M365 (model Enterprise App — jeden Client ID dla wszystkich firm):

**Krok 1: IT Admin firmy zatwierdza Reserti w swoim tenant (~5 min)**

```
Sposób A — przez link zgody (najprostszy):
  IT Admin otwiera:
  https://login.microsoftonline.com/{TENANT_ID}/adminconsent
    ?client_id={RESERTI_CLIENT_ID}
    &redirect_uri=https://api.prohalw2026.ovh/auth/azure/callback

  → Loguje się jako Global Admin / Application Admin
  → Zatwierdza uprawnienia: User.Read, Calendars.ReadWrite
  → Reserti pojawia się w Enterprise Applications tenant firmy

Sposób B — przez Azure Portal:
  Azure Portal → Enterprise Applications → New application
  → Search: wyszukaj "Reserti" (jeśli opublikowane w Gallery)
    lub: + Create your own application → Non-gallery
  → Grant admin consent
  → Skopiuj Tenant ID (Directory ID)
```

**Krok 2: Konfiguracja w Reserti Admin Panel**

```
Admin Panel → Organizacje → [Firma] → Edytuj → Integracja M365
  Azure Tenant ID: [wklej Tenant ID firmy]
  → Zapisz → Testuj połączenie
  (Client ID i Secret są globalne — zarządza nimi tylko Reserti)
```

**Krok 3: Wdrożenie Outlook Add-in (IT Admin, ~5 min)**

```
M365 Admin Center → Settings → Integrated apps → Add-in → Deploy
  → Wgraj manifest.xml
  → Assign: All users lub wybrana grupa
```

**Krok 4: Weryfikacja**

```
- Zaloguj przez Microsoft na Admin Panel ✓  (email/password nadal działa)
- Otwórz Outlook → tworzenie spotkania → Add-in widoczny ✓
- Zarezerwuj biurko → event pojawia się w kalendarzu ✓
- Beacon zmienia LED na niebieski ✓
```

---

### Ryzyka i mitigacje

| Ryzyko | Prawdopodobieństwo | Wpływ | Mitigacja |
|---|---|---|---|
| Graph token wygasa co 1h | Pewne | Wysoki | GraphTokenService auto-refresh przez refresh token |
| Graph webhook wygasa co 72h | Pewne | Średni | Cron job co 3 dni odnawia subskrypcje |
| Graph rate limit (10k req/10min) | Średnie | Średni | Delta queries + debounce + request batching |
| Add-in nie ładuje się w Outlook Desktop | Wysokie | Średni | Testuj na OWA — pełne wsparcie, Desktop czasem quirky |
| Tenant admin consent odmówiony | Niskie | Wysoki | Przygotuj dokumentację uprawnień dla IT Admina firmy |
| Client Secret wygasa (co 2 lata) | Średnie | Wysoki | Alert emailowy 60 dni przed wygaśnięciem |
| Conditional Access blokuje app | Niskie | Wysoki | App Registration musi przejść tenant-level consent |
| Firma nie ma Exchange Online | Niskie | Wysoki | M5 wymaga Exchange — dokumentuj wyraźnie |

---

### Zależności zewnętrzne do zainstalowania

```bash
# Backend
npm install passport-azure-ad @azure/msal-node

# Frontend (apps/teams + apps/outlook)
npm install @microsoft/teams-js @microsoft/office-js @azure/msal-browser

# Scheduler (Graph sync co 5 min)
npm install @nestjs/schedule  # jeśli nie zainstalowany
```

---

### Środowiska testowe

**Azure:** Można stworzyć bezpłatne Azure AD Free tier na czas developmentu.

**Outlook Add-in:** Office Add-in Debugger w VS Code + testowanie na OWA (office.com).

**Teams App:** Microsoft Teams Toolkit dla VS Code + sideloading do własnego tenant.

---

### Co NIE zmienia się przy implementacji M365

- Istniejące JWT flow (email/password) — nadal działa bez zmian
- NFC check-in przez gateway — niezależny od M365
- Struktura bazy danych poza dodanymi polami
- Deployment (Coolify + Cloudflare Tunnel) — tylko nowe serwisy
- MQTT i beacony — bez zmian

---

## Code Review — Plan poprawek

> Wyniki przeglądu kodu z 2026-03-31.
> Poprawki 1, 2, 3, 4 (docs), 5 wykonane w tym samym commicie.

### Wykonane

| # | Problem | Status |
|---|---|---|
| 1 | OAuth2 Implicit Flow → MSAL PKCE popup | ✅ |
| 2 | `findAvailable` brak scoping do org | ✅ |
| 3 | `GET /locations/:id` brak scoping OFFICE_ADMIN | ✅ |
| 4 (docs) | M365 — tylko SUPER_ADMIN i OFFICE_ADMIN (własna org) | ✅ |
| 5 | JIT passwordHash pusty → marker `AZURE_SSO_ONLY` | ✅ |

---

### Do wykonania — Priorytet 1 (bezpieczeństwo)

**P1-A: Rate limiting na endpointach auth**
Zainstalować `@nestjs/throttler`. Priorytety:
- `POST /auth/login` — 5 req/min per IP
- `POST /auth/azure` — 10 req/min per IP
- `GET /auth/azure/check` — 20 req/min per IP (publiczny, podatny na enumeration)

```bash
npm install @nestjs/throttler
```

Zmiany: `app.module.ts` + `ThrottlerGuard` globalnie lub per endpoint.

**P1-B: Admin API client — auto-refresh tokenu przy 401**
`apps/admin/src/api/client.ts` — przy 401 wylogowuje natychmiast.
Staff panel ma `tryRefresh()`. Admin powinien robić to samo.
Zmiana: dodać `tryRefresh()` i retry po odświeżeniu, dokładnie jak w `apps/staff/src/api/client.ts`.

**P1-C: `hardDelete` nie czyści `azureObjectId`**
`users.service.ts` — po anonimizacji konta `azureObjectId` zostaje.
JIT provisioning znajdzie stary rekord i nie stworzy nowego.
Zmiana: dodać `azureObjectId: null, azureTenantId: null` do danych `hardDelete`.

---

### Do wykonania — Priorytet 2 (logika)

**P2-A: Brak `@Cron` dla `expireOld()` rezerwacji**
`reservations.service.ts` ma metodę `expireOld()` ale nic jej nie wywołuje.
Zainstalować `@nestjs/schedule`, dodać `@Cron` w serwisie lub nowym `SchedulerModule`.

```bash
npm install @nestjs/schedule
```

**P2-B: Walk-in — data w strefie UTC może dać poprzedni dzień**
`checkins.service.ts:187` — `startOfDay` to UTC midnight, w UTC+1 to 23:00 poprzedniego dnia.
Zmiana: `const startOfDay = new Date(new Date(now).toDateString())` (local date).

**P2-C: `findAvailable` — brak walidacji `startTime < endTime`**
Gdy klient wyśle `startTime >= endTime`, zapytanie zwróci wszystkie biurka (puste okno).
Zmiana: dodać `if (startDt >= endDt) throw new BadRequestException(...)` na początku metody.

**P2-D: `reservations/my` — brak paginacji**
Nowy endpoint zwraca wszystkie aktywne rezerwacje bez limitu.
Zmiana: dodać `take: 50` i opcjonalny `@Query('limit')`.

**P2-E: Outlook Add-in — brak refresh tokenu**
`apps/outlook/src/api/client.ts` — przy 401 rzuca błąd bez próby odświeżenia.
W Add-in sesja może wygasnąć w trakcie spotkania.
Zmiana: dodać `tryRefresh()` analogicznie do staff panelu, z sessionStorage.

---

### Do wykonania — Priorytet 3 (jakość i utrzymanie)

**P3-A: `manifest.xml` — placeholder GUID**
`apps/outlook/manifest/manifest.xml:10` — `a1b2c3d4-...` musi być unikalny.
Zmiana: wygenerować UUID (`crypto.randomUUID()` lub online), podmienić przed wdrożeniem.
Dodać do dokumentacji jako krok onboardingu.

**P3-B: `_notifyGateway` — `process.env` zamiast `ConfigService`**
`devices.service.ts` — niespójne z resztą kodu, trudniejsze do testowania.
Zmiana: wstrzyknąć `ConfigService` do `DevicesService`, użyć `this.config.get('GATEWAY_PROVISION_KEY')`.

**P3-C: `install.controller.ts` — hardcoded GitHub URL**
`_buildScript()` wskazuje na `lewski22/desk-gateway-python`.
Zmiana: przenieść do zmiennej środowiskowej `GATEWAY_INSTALL_SCRIPT_URL`.

**P3-D: `ReservationStatus` — string literals zamiast enum**
`reservations.service.ts:cancel()` — `'CANCELLED', 'COMPLETED'` jako string.
Zmiana: `ReservationStatus.CANCELLED, ReservationStatus.COMPLETED`.

**P3-E: Brak `vite-env.d.ts` w admin app**
`import.meta.env.VITE_AZURE_CLIENT_ID` bez typowania TypeScript.
Zmiana: dodać `apps/admin/src/vite-env.d.ts` z `interface ImportMetaEnv`.

**P3-F: Staff panel — brak SSO**
`apps/staff/src/pages/LoginPage.tsx` — brak przycisku Microsoft.
Użytkownicy z rolą `STAFF`/`END_USER` w firmie z `azureEnabled = true` muszą używać hasła.
Zmiana: dodać analogiczne `checkSso` + przycisk jak w Admin Panelu.

**P3-G: `GatewaySetupToken` — brak indeksu na `locationId`**
`listTokens(locationId)` robi full table scan.
Zmiana: dodać `@@index([locationId])` do modelu w schema.prisma.

---

## Scalenie Admin + Staff Panel — Plan implementacji

> Ostatnia aktualizacja: 2026-03-31
> Status: PLANOWANE — żaden plik nie jest jeszcze modyfikowany

### Cel

Dwa osobne frontendy (`apps/admin/` i `apps/staff/`) pod różnymi domenami
zastąpić **jedną aplikacją React** dostępną pod jedną domeną (`app.prohalw2026.ovh`),
która po zalogowaniu automatycznie renderuje odpowiedni interfejs zależnie od roli użytkownika.

---

### Dlaczego to ma sens

| Problem dziś | Po scaleniu |
|---|---|
| Dwa oddzielne buildy, dwie domeny, dwie CI/CD konfiguracje | Jeden build, jedna domena, jedna konfiguracja Coolify |
| Użytkownik z rolą OFFICE_ADMIN musi wiedzieć o istnieniu dwóch URL-i | Jeden link — system sam pokazuje właściwy widok |
| Duplikacja: Auth, EntraID modal, API client, komponenty UI | Współdzielony kod w `src/shared/` |
| Przy zmianie hasła/tokenu — dwie osobne localStorage | Jedna sesja, jeden token |
| Staff nie ma dostępu do rezerwacji z poziomu mapy biurek | Można płynnie przejść między widokami Staff ↔ Admin |

---

### Architektura docelowa

```
app.prohalw2026.ovh/           ← jedna domena, jeden Docker
  /login                       ← wspólna strona logowania (email + Entra ID)
  /                            ← redirect po roli
  /map                         ← widok Staff: mapa biurek, rezerwacje
  /admin/dashboard             ← widok Admin: dashboard
  /admin/desks                 ← widok Admin: biurka
  /admin/users                 ← widok Admin: użytkownicy
  /admin/reservations          ← widok Admin: rezerwacje
  /admin/provisioning          ← widok Admin: provisioning
  /admin/organizations         ← widok Admin: biura i organizacje
  /admin/reports               ← widok Admin: raporty
  /checkin/:token              ← publiczny QR check-in (bez auth)
```

---

### Podział ról → widoki

| Rola | Po zalogowaniu redirect | Ma dostęp do |
|---|---|---|
| `SUPER_ADMIN` | `/admin/dashboard` | Wszystkie widoki `/admin/*` + `/map` |
| `OFFICE_ADMIN` | `/admin/dashboard` | Wszystkie widoki `/admin/*` (scoped do org) + `/map` |
| `STAFF` | `/map` | `/map`, `/admin/reservations` (tylko podgląd) |
| `END_USER` | `/map` | `/map` (mapa + własne rezerwacje) |

Próba wejścia na niedostępny widok → redirect do właściwego ekranu.

---

### Struktura katalogów po scaleniu

```
apps/unified/                      ← nowa aplikacja (zastąpi admin/ i staff/)
├── package.json                   ← zależności obu paneli
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx                    ← routing + guard per rola
│   │
│   ├── shared/                    ← kod wspólny dla wszystkich ról
│   │   ├── api/
│   │   │   └── client.ts          ← połączony API client (admin + staff)
│   │   ├── auth/
│   │   │   ├── AuthContext.tsx    ← React Context: user, login, logout, loginAzure
│   │   │   └── EntraIDModal.tsx   ← wyciągnięty z App.tsx, jeden dla wszystkich
│   │   ├── components/
│   │   │   └── ui.tsx             ← wspólne komponenty (Btn, Modal, Card itp.)
│   │   └── hooks/
│   │       └── index.ts           ← useDesks, useReservations, useAuth itp.
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx          ← wspólna strona logowania
│   │   ├── QrCheckinPage.tsx      ← publiczny QR (bez auth)
│   │   │
│   │   ├── staff/                 ← widoki dla STAFF i END_USER
│   │   │   ├── DeskMapPage.tsx
│   │   │   └── ReservationsPage.tsx
│   │   │
│   │   └── admin/                 ← widoki dla OFFICE_ADMIN i SUPER_ADMIN
│   │       ├── DashboardPage.tsx
│   │       ├── DesksPage.tsx
│   │       ├── UsersPage.tsx
│   │       ├── ReservationsAdminPage.tsx
│   │       ├── ProvisioningPage.tsx
│   │       ├── OrganizationsPage.tsx
│   │       └── ReportsPage.tsx
│   │
│   └── layouts/
│       ├── StaffLayout.tsx        ← górny pasek dla mapy
│       └── AdminLayout.tsx        ← sidebar dla panelu admin
```

---

### Routing i guard

```typescript
// App.tsx — logika po zalogowaniu
function RoleRedirect({ user }: { user: any }) {
  const adminRoles = ['SUPER_ADMIN', 'OFFICE_ADMIN'];
  if (adminRoles.includes(user.role)) return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/map" replace />;
}

// Guard — chroni widoki /admin/*
function AdminRoute({ user, children }: { user: any; children: ReactNode }) {
  const allowed = ['SUPER_ADMIN', 'OFFICE_ADMIN'];
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed.includes(user.role)) return <Navigate to="/map" replace />;
  return <>{children}</>;
}
```

---

### Kolejność migracji (zalecana)

| Krok | Co | Czas |
|---|---|---|
| 1 | Utwórz `apps/unified/` — skopiuj zależności z obu package.json | 1h |
| 2 | Wyciągnij `AuthContext` + `EntraIDModal` do `shared/` | 2h |
| 3 | Skopiuj i połącz API clienty w `shared/api/client.ts` | 2h |
| 4 | Migruj `LoginPage` do `pages/` (jeden, wspólny) | 1h |
| 5 | Migruj wszystkie strony admin → `pages/admin/` | 3h |
| 6 | Migruj wszystkie strony staff → `pages/staff/` | 2h |
| 7 | Implementuj `App.tsx` z routingiem i guardami per rola | 2h |
| 8 | Nowe Dockerfile + Coolify (`front-unified`) | 1h |
| 9 | Testy wszystkich ról, QR check-in, Entra ID | 1 dzień |
| 10 | Wyłącz stare serwisy `front-admin` i `front-staff` | 0.5h |

**Łącznie: 3-4 dni robocze**

---

### Czego NIE robić podczas migracji

| ❌ Nie | ✅ Zamiast |
|---|---|
| Przepisywać logikę komponentów | Kopiować 1:1, tylko zmieniać import paths |
| Zmieniać backend | Zero zmian w API — tylko frontend |
| Deployować w połowie migracji | Najpierw przetestować lokalnie, potem jeden deploy |
| Usuwać stare `apps/admin/` i `apps/staff/` przed testami | Zostawić jako backup, usunąć dopiero po potwierdzeniu |

---

## Panel Owner — Plan szczegółowy

> Ostatnia aktualizacja: 2026-03-31
> Szczegółowy kontekst techniczny: `docs/AI_OWNER_CONTEXT.md`
> Status: ✅ ZAIMPLEMENTOWANY — commit e0fcf1d

### Cel operacyjny

Panel Owner to narzędzie Ciebie jako operatora platformy Reserti.
Daje Ci pełną widoczność wszystkich klientów, ich infrastruktury IoT
oraz możliwość wejścia w panel konkretnej firmy bez znajomości hasła.

---

### Co Panel Owner robi, czego nie mają inne panele

| Funkcja | SUPER_ADMIN | OWNER |
|---|---|---|
| Widzi swoją organizację | ✅ | ✅ |
| Widzi WSZYSTKIE organizacje | ❌ | ✅ |
| Tworzy nową firmę-klienta | ❌ | ✅ |
| Zarządza planami i subskrypcjami | ❌ | ✅ |
| Widzi stan gateway i beaconów wszystkich firm | ❌ | ✅ |
| Wchodzi w panel firmy bez hasła (impersonation) | ❌ | ✅ |
| Widzi notatki wewnętrzne o kliencie | ❌ | ✅ |

---

### Zakres MVP (Priorytet 1)

**Ekran 1 — Lista klientów (`/clients`)**
- Tabela: Firma | Plan | Biura | Gateway online/total | Beacony online/total | Ostatnia aktywność | Status
- Filtry: aktywne / trial / nieaktywne / wszystkie
- Szybkie akcje: Szczegóły | Impersonuj | Dezaktywuj
- Przycisk: `+ Nowy klient` → formularz tworzenia

**Ekran 2 — Szczegóły klienta (`/clients/:id`)**
- Sekcja 1: Dane firmy (nazwa, plan, daty, kontakt, notatki Ownera)
- Sekcja 2: Biura i gateway (tabela: biuro → lista gateway + status Online/Offline/Problem)
- Sekcja 3: Beacony (hardware ID, biurko, gateway, status, heartbeat, RSSI)
- Sekcja 4: Ostatnia aktywność (20 najnowszych zdarzeń: check-in, provisioning, błędy)
- Przycisk: `Wejdź jako Admin` → impersonation

**Ekran 3 — Health (`/health`)**
- Globalny monitoring wszystkich gateway i beaconów
- Auto-refresh co 30 sekund
- Kolorowanie firm: 🟢 wszystkie online / 🟡 część offline / 🔴 wszystkie offline
- Filtr: "Pokaż tylko problemy"

**Ekran 4 — Nowy klient (`/clients/new`)**
- Krok 1: Dane firmy (nazwa, slug auto, plan, email kontaktowy, notatki, trial)
- Krok 2: Pierwszy Super Admin (imię, email, opcja: wyślij zaproszenie)
- Po zapisaniu: redirect do `/clients/:id` nowej firmy

---

### Zakres MVP (Priorytet 2 — można dodać po uruchomieniu)

- Ekran Statystyki (`/stats`): metryki platformy, wykresy, firmy bez aktywności
- Edycja planu i dat subskrypcji
- Historia impersonacji (audit log)
- Eksport listy klientów do CSV

---

### Backend — nowe elementy

```
Nowa rola w UserRole enum:
  OWNER  ← dodać PRZED SUPER_ADMIN

Nowe pola w Organization:
  plan           String   @default("starter")
  planExpiresAt  DateTime?
  trialEndsAt    DateTime?
  notes          String?
  contactEmail   String?
  createdBy      String?

Nowy moduł: src/modules/owner/
  owner.module.ts
  owner.controller.ts   ← /owner/* endpoints, tylko OWNER
  owner.service.ts      ← CRUD organizacji, tworzenie klientów
  owner-health.service.ts ← agregacja stanu gateway + beaconów
  guards/owner.guard.ts ← sprawdza user.role === 'OWNER'

Nowe endpointy:
  GET  /owner/organizations           ← lista firm z metrykami
  POST /owner/organizations           ← utwórz firmę + SUPER_ADMIN
  GET  /owner/organizations/:id       ← szczegóły firmy
  PATCH /owner/organizations/:id      ← edytuj plan, status, notatki
  DELETE /owner/organizations/:id     ← soft delete (isActive=false)
  GET  /owner/health                  ← globalny stan infrastruktury
  GET  /owner/health/:orgId           ← stan jednej firmy
  GET  /owner/stats                   ← metryki platformy
  POST /owner/organizations/:id/impersonate ← JWT 30min jako SUPER_ADMIN
```

---

### Frontend — nowa aplikacja

```
apps/owner/                         ← nowa aplikacja React
  Domena: owner.prohalw2026.ovh
  Port dev: 3005
  Deploy: nowy serwis w Coolify (front-owner)
```

Osobna aplikacja — **nie łączyć z Admin/Staff/Unified** ze względu na:
- Inny poziom uprawnień (OWNER — tylko 1-2 konta w całym systemie)
- Inny cel (operacja platformy vs użytkowanie platformy)
- Izolacja bezpieczeństwa (wyciek Owner JWT = dostęp do wszystkich firm)

---

### Impersonation — mechanizm

```
Owner klika "Wejdź jako Admin" przy firmie
  ↓
POST /owner/organizations/:id/impersonate
  ↓
Backend:
  1. Weryfikuje role === 'OWNER'
  2. Loguje Event(OWNER_IMPERSONATION, { ownerId, orgId, ip, at })
  3. Generuje JWT z payload:
     { sub: adminUserId, role: 'SUPER_ADMIN', orgId, impersonated: true }
     ważny 30 minut, nieprzedłużalny
  ↓
Owner Panel otwiera admin.prohalw2026.ovh/auth/impersonate?token=...
  ↓
Admin Panel (lub Unified Panel):
  - zapisuje token jako admin_access
  - pokazuje baner: "Jesteś zalogowany jako SUPER_ADMIN: NazwaFirmy"
  - po 30 min lub ręcznym wylogowaniu → powrót
```

Każda impersonacja jest logowana w Events — Owner nie może ukryć swojej aktywności.

---

### Kolejność implementacji Owner Panel

| Krok | Co | Czas |
|---|---|---|
| 1 | Schema: rola OWNER + nowe pola Organization + prisma db push | 1h |
| 2 | OwnerGuard + OwnerModule skeleton | 2h |
| 3 | Endpointy CRUD organizacji | 4h |
| 4 | Endpoint health (globalny + per org) | 3h |
| 5 | Endpoint impersonation | 3h |
| 6 | Frontend: scaffold apps/owner/ + LoginPage | 3h |
| 7 | Frontend: ClientsPage + ClientDetailPage | 1 dzień |
| 8 | Frontend: HealthPage z auto-refresh | 4h |
| 9 | Frontend: NewClientPage (wizard 2-krokowy) | 3h |
| 10 | ImpersonatePage w Admin/Unified Panel | 2h |
| 11 | Deploy Coolify + baner impersonation | 2h |
| 12 | Testy i seed konta OWNER | 2h |

**Łącznie: 5-6 dni roboczych**

---

### Priorytet względem scalenia Admin+Staff

Rekomendacja: **Panel Owner PRZED scaleniem Admin+Staff**.

Uzasadnienie:
- Panel Owner to osobna aplikacja — zero zależności od scalenia
- Scalenie Admin+Staff to duży refactor z ryzykiem regresji
- Owner Panel daje Ci narzędzie do zarządzania klientami na produkcji
- Scalenie można zrobić stopniowo, Owner Panel to greenfield


---

## MFA / 2FA — Plan implementacji

> Status: PLANOWANE — nie zaimplementowane
> Priorytet: P3 — po stabilizacji produkcji

### Zakres

Dotyczy wyłącznie kont **email + hasło** (nie SSO — Microsoft zarządza MFA samodzielnie przez Entra ID).
Użytkownicy kont SSO nie widzą żadnych zmian.

### Metody uwierzytelniania (plan)

| Metoda | Trudność | Opis |
|---|---|---|
| **TOTP** (Google Authenticator, Authy) | ★★☆ | RFC 6238 — rekomendowane jako pierwsze |
| Email OTP | ★☆☆ | Jednorazowy 6-cyfrowy kod na email |
| SMS OTP | ★★★ | Wymaga dostawcy SMS (Twilio, smsapi.pl) |

**Rekomendacja MVP: TOTP** — nie wymaga zewnętrznych serwisów, szeroka adopcja aplikacji.

### Biblioteki backendowe

```
speakeasy   ← generowanie/weryfikacja TOTP + backup codes
qrcode      ← generowanie QR code do skanowania przez aplikację
```

### Zmiany w schemacie

```prisma
model User {
  // ...istniejące...
  mfaEnabled    Boolean  @default(false)
  mfaSecret     String?  // zaszyfrowany klucz TOTP (AES-256)
  mfaBackupCodes String[] // 10 jednorazowych kodów zapasowych (bcrypt)
}
```

### Flow aktywacji

```
1. Użytkownik → Profil → Włącz 2FA
2. Backend generuje secret (speakeasy.generateSecret())
3. Frontend wyświetla QR code (do zeskanowania przez Authenticator)
4. Użytkownik wpisuje pierwszy kod TOTP → weryfikacja
5. Backend: mfaEnabled=true, zapisuje zaszyfrowany secret
6. Frontend: pokazuje 10 backup codes — "zapisz teraz, nie będą pokazane ponownie"
```

### Flow logowania z MFA

```
POST /auth/login → {email, password}
  → jeśli mfaEnabled: nie zwraca JWT, zwraca { mfaRequired: true, mfaToken: shortJWT(2min) }
  → Frontend: ekran "Podaj kod z aplikacji"
POST /auth/mfa → { mfaToken, code }
  → weryfikacja TOTP lub backup code
  → jeśli OK: zwraca pełny JWT (access + refresh)
```

### Nowe endpointy

```
POST /auth/mfa                    ← weryfikacja kodu TOTP (public, wymaga mfaToken)
GET  /auth/mfa/setup              ← generuje QR + secret (JWT required)
POST /auth/mfa/setup/confirm      ← potwierdza i aktywuje MFA
DELETE /auth/mfa                  ← dezaktywacja MFA (wymaga kodu TOTP)
GET  /auth/mfa/backup-codes       ← regeneracja kodów zapasowych
```

### Frontend — zmiany

- Strona logowania: dodatkowy krok "Podaj kod 2FA" gdy backend zwróci `mfaRequired: true`
- `ChangePasswordPage` / Profil: sekcja "Bezpieczeństwo" → Włącz/Wyłącz 2FA
- Ekran setup: wyświetl QR, pole weryfikacyjne, backup codes

### Uwagi

- Secret TOTP przechowywać zaszyfrowany (AES-256, klucz w env `MFA_ENCRYPTION_KEY`)
- Okno czasowe TOTP: ±1 krok (30s) tolerancji
- Po wyczerpaniu backup codes → użytkownik kontaktuje się z adminem organizacji
- Admin/SUPER_ADMIN może wymusić MFA dla całej organizacji (pole `Organization.mfaRequired`)


---

## Beacon Provisioner — desktopowy instalator

> Status: PLANOWANE — nie zaimplementowane  
> Priorytet: P3 — po stabilizacji produkcji

### Cel

Eliminacja ręcznego kopiowania komendy `PROVISION:{...}` przez technika.  
Technik podłącza beacon USB, wkleja token z panelu, klika jeden przycisk.

### Stack

- **Python + tkinter** — wbudowany w każdą instalację Pythona, zero dodatkowych zależności GUI
- **pyserial** — komunikacja z ESP32 przez port COM/ttyUSB
- **pyinstaller** — dystrybucja jako jeden plik `.exe` (Windows) lub bin (Linux/Mac)

### Interfejs (GUI)

```
┌─────────────────────────────────────────┐
│  🔴 Reserti Beacon Provisioner          │
├─────────────────────────────────────────┤
│  Komenda PROVISION (wklej z panelu):    │
│  ┌─────────────────────────────────┐    │
│  │ PROVISION:{...}                 │    │
│  └─────────────────────────────────┘    │
│  Hardware ID:  esp-1  (auto z komendy)  │
│                                         │
│  Port:  [COM3 - CP2102  ▼] [Odśwież]   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ [23:11] Szukam ESP32...         │    │
│  │ [23:11] Znaleziono: COM3        │    │
│  │ [23:12] ✓ MQTT Connected!       │    │
│  └─────────────────────────────────┘    │
│         [  Wyślij do beacona  ]         │
└─────────────────────────────────────────┘
```

### Flow użytkownika

1. Technik otwiera aplikację
2. Wkleja komendę `PROVISION:{...}` skopiowaną z panelu Admin → Provisioning
3. Aplikacja automatycznie wykrywa port ESP32 (CP210x, CH340, FTDI, USB Serial)
4. Opcjonalnie wybiera port ręcznie z dropdownu
5. Klika "Wyślij do beacona"
6. Aplikacja wysyła komendę i czeka na potwierdzenie (`[MQTT] Connected` lub `FREE`)
7. Po sukcesie: dialog "Beacon skonfigurowany! Dodać kolejny?"
   - **Tak** → nowa sesja z info o konieczności podłączenia nowego beacona
   - **Nie** → zamknij aplikację

### Auto-detekcja portu

- Skanuj wszystkie porty COM/ttyUSB
- Filtruj po opisie: `CP210x`, `CH340`, `FTDI`, `USB Serial`
- Autoselect pierwszego pasującego
- Przycisk "Odśwież" reskanuje

### Timeout i błędy

- Czeka 30s na odpowiedź od ESP32
- Sukces: `[MQTT] Connected` lub `[STATE].*FREE` w logu serialnym
- Błąd: `Failed` / `Error` w logu → komunikat dla technika

### Pliki do stworzenia

```
beacon-provisioner/
├── provisioner.py        ← główna aplikacja GUI
├── requirements.txt      ← pyserial
├── build.bat             ← pyinstaller → .exe (Windows)
├── build.sh              ← pyinstaller → bin (Linux/Mac)
└── README.md
```

### Zmiany w panelu Admin

- Po przypisaniu biurka do beacona — przycisk "Kopiuj komendę PROVISION"
  już istnieje w Provisioning → wystarczy wskazać użytkownikowi

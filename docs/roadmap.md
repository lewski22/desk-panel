# Roadmap — Reserti Desk Management System

## Aktualny stan (v1.0)

✅ Firmware ESP32 (NFC + LED + offline queue)  
✅ Gateway per-biuro (MQTT bridge + SQLite cache)  
✅ Backend NestJS (REST API + MQTT + PostgreSQL)  
✅ Panel Admin (biurka, użytkownicy, provisioning, raporty)  
✅ Panel Staff (mapa zajętości)  
✅ Deploy: Proxmox LXC + Coolify + Cloudflare Tunnel  

---

## Planowane — P2

### Panel OWNER (nowy poziom uprawnień)

Obecnie najwyższą rolą jest `SUPER_ADMIN` zarządzający platformą.  
Planowany poziom **OWNER** będzie zarządzał firmami (organizacjami) — to tenant root.

**Zakres panelu Owner:**
- Tworzenie i zarządzanie firmami (tenantami)
- Przypisywanie Super Adminów do firm
- Podgląd statystyk wszystkich firm
- Zarządzanie planami (starter / pro / enterprise)
- Billing i rozliczenia

**Otwarte pytania do analizy:**

#### A. Izolacja środowisk — oddzielny backend per firma vs współdzielony

| | Oddzielne backend per firma | Współdzielony backend |
|---|---|---|
| Izolacja danych | Pełna (osobna baza) | Row-level security |
| Koszt | Wyższy (wiele instancji) | Niższy |
| Wdrożenie | Złożone (Coolify multi-project) | Prostsze |
| Skalowanie | Niezależne per firma | Wspólna pula zasobów |
| Migracje | Niezależne | Jeden deployment |
| Compliance (GDPR) | Łatwiejsze | Wymaga dokładnego RLS |

**Rekomendacja:** Współdzielony backend z RLS (`organizationId` na każdej tabeli) dla < 50 firm. Powyżej — rozważyć sharding per firma.

#### B. Połączenie panelu Admin + Staff

Obecnie: dwie oddzielne aplikacje React pod różnymi domenami.

**Opcja 1: Jeden panel z routingiem per rola**
```
https://app.reserti.pl/
  → logowanie → wykrycie roli → redirect do odpowiedniego widoku
  SUPER_ADMIN / OFFICE_ADMIN → /admin/*
  STAFF                      → /staff/*
  END_USER                   → /user/* (nowy)
```
Zalety: jeden codebase, jedna domena, spójny login flow  
Wady: większy bundle, wymaga refactoru obu aplikacji

**Opcja 2: Zachowanie oddzielnych aplikacji + SSO**
```
https://admin.reserti.pl  → Admin Panel
https://staff.reserti.pl  → Staff Panel
https://app.reserti.pl    → PWA mobilna (nowa)
```
Zalety: mniejsze bundle, niezależny deploy  
Wady: duplikacja kodu (auth, komponenty), dwa URL-e do pamiętania

**Rekomendacja:** Opcja 1 — jeden panel z lazy-loaded modułami per rola. Frontend pod jedną domeną.

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

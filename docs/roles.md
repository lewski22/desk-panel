# Role użytkowników — Reserti Desk Management

> Aktualizacja: 2026-04-15

---

## Przegląd ról

System ma 5 ról w hierarchii. Każde konto ma dokładnie jedną rolę.

| Rola | Identyfikator | Kto to jest |
|------|---------------|-------------|
| **Owner** | `OWNER` | Operator platformy Reserti (właściciel SaaS) |
| **Super Admin** | `SUPER_ADMIN` | Administrator firmy-klienta |
| **Office Admin** | `OFFICE_ADMIN` | Administrator konkretnego biura |
| **Staff** | `STAFF` | Pracownik recepcji / helpdesk |
| **Użytkownik** | `END_USER` | Zwykły pracownik korzystający z biurek |

---

## OWNER — operator platformy

Konto z najwyższymi uprawnieniami. Reprezentuje firmę Reserti.
Jeden na całą platformę — nie należy do żadnej organizacji.

### Co może:
- Tworzyć, edytować i dezaktywować organizacje (firmy-klientów)
- Wchodzić do panelu każdej firmy jako SUPER_ADMIN tej firmy (impersonacja 30min)
- Widzieć globalne statystyki: liczba org, gateway online, beacony, check-iny
- Zarządzać subskrypcjami klientów: plan, ważność, limity, MRR
- Widzieć health wszystkich gateway i beaconów we wszystkich firmach

### Czego nie może:
- Widzieć treści rezerwacji i danych osobowych bez impersonacji

**Konto testowe:** `owner@reserti.pl` / `Owner1234!`

---

## SUPER_ADMIN — administrator firmy

Osoba zarządzająca całą firmą-klientem. Widzi wszystkie biura swojej organizacji.

### Co może (wszystko co OFFICE_ADMIN + poniżej):
- Zarządzać wszystkimi biurami (Locations) w swojej org
- Tworzyć i zarządzać OFFICE_ADMIN i innymi SUPER_ADMIN
- Konfigurować SSO Entra ID (Azure Tenant ID) dla swojej org
- Konfigurować własną skrzynkę SMTP (OrganizationSmtpConfig)
- Konfigurować reguły powiadomień email i in-app
- **Widzieć stan subskrypcji: plan, ważność, limity zasobów (v0.12.0)**

### Konto testowe: `superadmin@reserti.pl` / `Admin1234!`

---

## OFFICE_ADMIN — administrator biura

Administrator jednego lub kilku biur w firmie.

### Co może:
- Pełny Admin Panel dla swojej organizacji
- CRUD biurek (tworzenie, edycja, dezaktywacja, trwałe usunięcie)
- CRUD użytkowników (z wyjątkiem nadawania SUPER_ADMIN)
- Rejestrowanie beaconów i gateway (provisioning)
- Przypisywanie kart NFC do użytkowników
- OTA aktualizacje firmware beacon
- Generowanie kodów QR dla biurek
- Raporty i analityka zajętości
- Anulowanie i ręczny check-in/out rezerwacji

### Czego nie może:
- Zarządzać innymi organizacjami
- Nadawać roli SUPER_ADMIN

**Konto testowe:** `admin@demo-corp.pl` / `Admin1234!`

---

## STAFF — pracownik recepcji

Osoba przy recepcji lub helpdesku, obsługuje check-iny fizycznie.

### Co może (wszystko co END_USER + poniżej):
- Ręczny check-in dowolnego użytkownika przy dowolnym biurku
- Ręczny check-out dowolnego biurka
- Przeglądać wszystkie rezerwacje na dziś (z filtrami)
- Widzieć stan urządzeń (DevicesPage)

**Konto testowe:** `staff@demo-corp.pl` / `Staff1234!`

---

## END_USER — zwykły pracownik

Domyślna rola każdego nowego użytkownika. Korzysta z biurek.

### Co może:
- Mapa biurek — wszystkie aktywne (zajęte też rezerwowalne)
- Rezerwacja biurka przez panel (ReservationModal)
- QR check-in / checkout przez kod na biurku
- NFC check-in kartą przy beaconie
- Lista swoich rezerwacji (aktywne + historia)
- Anulowanie własnych rezerwacji

**Konto testowe:** `user@demo-corp.pl` / `User1234!`

---

## Tabela uprawnień

| Akcja | END_USER | STAFF | OFFICE_ADMIN | SUPER_ADMIN | OWNER |
|-------|:--------:|:-----:|:------------:|:-----------:|:-----:|
| Mapa biurek | ✅ | ✅ | ✅ | ✅ | — |
| Rezerwacja własna | ✅ | ✅ | ✅ | ✅ | — |
| QR / NFC check-in | ✅ | ✅ | ✅ | ✅ | — |
| Checkout własny | ✅ | ✅ | ✅ | ✅ | — |
| Moje rezerwacje | ✅ | ✅ | ✅ | ✅ | — |
| Zmiana hasła | ✅ | ✅ | ✅ | ✅ | — |
| Ręczny check-in/out (cudzy) | ❌ | ✅ | ✅ | ✅ | — |
| Wszystkie rezerwacje (filtr) | ❌ | ✅ | ✅ | ✅ | — |
| Stan urządzeń | ❌ | ✅ | ✅ | ✅ | — |
| CRUD biurek | ❌ | ❌ | ✅ | ✅ | — |
| CRUD użytkowników | ❌ | ❌ | ✅ | ✅ | — |
| Provisioning beaconów | ❌ | ❌ | ✅ | ✅ | — |
| OTA firmware | ❌ | ❌ | ✅ | ✅ | — |
| Raporty i analityka | ❌ | ❌ | ✅ | ✅ | — |
| Konfiguracja SMTP | ❌ | ❌ | ❌ | ✅ | — |
| Konfiguracja SSO (Entra ID) | ❌ | ❌ | ❌ | ✅ | — |
| **Stan subskrypcji (v0.12)** | ❌ | ❌ | ❌ | ✅ | — |
| Zarządzanie org (CRUD) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Nadawanie SUPER_ADMIN | ❌ | ❌ | ❌ | ✅ | ✅ |
| Zarządzanie subskrypcjami | ❌ | ❌ | ❌ | ❌ | ✅ |
| Impersonacja SUPER_ADMIN | ❌ | ❌ | ❌ | ❌ | ✅ |
| Stats globalne platformy | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Zmiana roli

**Admin Panel → Użytkownicy → Edytuj → Rola**

Ograniczenia:
- Rolę `SUPER_ADMIN` może nadać tylko inny SUPER_ADMIN lub OWNER
- `OFFICE_ADMIN` może zmieniać role między `END_USER`, `STAFF`, `OFFICE_ADMIN`
- Rola `OWNER` jest unikalna — przypisana tylko raz w seedzie, nie zmieniana przez UI

---

## SSO Entra ID

Użytkownicy zalogowani przez Microsoft (Entra ID) mają:
- `passwordHash = 'AZURE_SSO_ONLY'` — nie mogą się zalogować hasłem lokalnym
- `azureObjectId` — unikalny identyfikator w Azure AD
- JIT provisioning — konto tworzone automatycznie przy pierwszym logowaniu SSO

Aktualnie SSO działa dla ról OFFICE_ADMIN i SUPER_ADMIN.
Dla STAFF i END_USER planowane w przyszłej wersji.
